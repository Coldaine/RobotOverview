#!/usr/bin/env python3
import threading
import subprocess
import numpy as np
import sherpa_ncnn
import sherpa_onnx
import queue
import os
import time

class asr_sherpa_ncnn:
    def __init__(self, model_dir):
        self.recognizer = sherpa_ncnn.Recognizer(
            tokens=os.path.join(model_dir, "tokens.txt"),
            encoder_param=os.path.join(model_dir, "encoder_jit_trace-pnnx.ncnn.param"),
            encoder_bin=os.path.join(model_dir, "encoder_jit_trace-pnnx.ncnn.bin"),
            decoder_param=os.path.join(model_dir, "decoder_jit_trace-pnnx.ncnn.param"),
            decoder_bin=os.path.join(model_dir, "decoder_jit_trace-pnnx.ncnn.bin"),
            joiner_param=os.path.join(model_dir, "joiner_jit_trace-pnnx.ncnn.param"),
            joiner_bin=os.path.join(model_dir, "joiner_jit_trace-pnnx.ncnn.bin"),
            num_threads=4,
            enable_endpoint_detection=True,
            decoding_method="modified_beam_search",
        )

        self.rate = 16000
        self.chunk = 1600            
        self.audio_queue = queue.Queue(maxsize=30)

        self.running = False
        self.lock = threading.Lock()

        self.final_text = None
        self.last_final_sent = ""
        self.pending_final = False  

        vad_config = sherpa_onnx.VadModelConfig()
        vad_config.silero_vad.model = (
            "/home/ws/ugv_ws/src/ugv_main/ugv_voice/ugv_voice/models/asr/silero_vad.onnx"
        )
        vad_config.sample_rate = 16000
        self.vad = sherpa_onnx.VoiceActivityDetector(
            vad_config, buffer_size_in_seconds=10
        )

        self.speaking = False
        self.last_speech_time = 0.0
        self.silence_timeout = 0.7  

        self.reset_cooldown = 0.15
        self.last_reset_time = 0.0

        self.audio_proc = None
        self.audio_thread = None
        self.run_thread = None

    def start(self):
        if self.running:
            return

        print("[ASR] Start")
        self.running = True

        with self.lock:
            self.final_text = None
            self.pending_final = False
            self.last_final_sent = ""

        self.audio_thread = threading.Thread(target=self.audio_capture, daemon=True)
        self.audio_thread.start()

        self.run_thread = threading.Thread(target=self.run, daemon=True)
        self.run_thread.start()

    def stop(self):
        print("[ASR] Stop")
        self.running = False

        if self.audio_proc:
            try:
                self.audio_proc.terminate()
                self.audio_proc.wait(timeout=1)
            except Exception:
                pass
            self.audio_proc = None

        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break

        with self.lock:
            self.final_text = None
            self.pending_final = False
            self.last_final_sent = ""

        self.recognizer.reset()
        self.last_reset_time = time.time()

    def audio_capture(self):
        cmd = [
            "arecord",
            "-D", "plughw:2,0",
            "-f", "S16_LE",
            "-c", "1",
            "-r", "16000",
            "-t", "raw",
        ]
        self.audio_proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=0)

        while self.running:
            if self.audio_queue.full():
                time.sleep(0.01)
                continue

            data = self.audio_proc.stdout.read(self.chunk * 2)
            if data:
                self.audio_queue.put(data)

    def run(self):
        print("[ASR] Run thread started")
        while self.running:
            try:
                pcm = self.audio_queue.get(timeout=0.1)
            except queue.Empty:
                continue

            audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0

            self.recognizer.accept_waveform(self.rate, audio)

            try:
                self.vad.accept_waveform(audio)
            except:
                pass

            try:
                vad_speech = self.vad.is_speech_detected()
            except:
                vad_speech = False

            if vad_speech:
                self.speaking = True
                self.last_speech_time = time.time()

            else:
                if self.speaking and (time.time() - self.last_speech_time > self.silence_timeout):
                    final_text = self.recognizer.text

                    if time.time() - self.last_reset_time < self.reset_cooldown:
                        self._reset_asr_safely()
                        continue

                    if final_text:
                        self._set_final_text(final_text)

                    self._reset_asr_safely()
                    self.speaking = False
                    self.last_speech_time = 0.0

            time.sleep(0.001)

    def _set_final_text(self, txt):
        with self.lock:
            if self.pending_final:
                print("[ASR] Drop new final (pending exists)")
                return
            if txt == self.last_final_sent:
                print("[ASR] Duplicate final ignored:", txt)
                return

            self.final_text = txt
            self.pending_final = True
            print("[ASR] FINAL:", txt)

    def _reset_asr_safely(self):
        self.recognizer.reset()
        self.last_reset_time = time.time()

    def get_result(self):
        with self.lock:
            if self.pending_final and self.final_text:
                text = self.final_text
                self.last_final_sent = text
                self.final_text = None
                self.pending_final = False
                return text
        return None
