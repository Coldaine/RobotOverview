import threading
import subprocess
import numpy as np
import queue
import sherpa_onnx
import time

class kws_sherpa_onnx:
    def __init__(self, model_dir):
        self.keyword_spotter = sherpa_onnx.KeywordSpotter(
            tokens=f"{model_dir}/tokens.txt",
            encoder=f"{model_dir}/encoder-epoch-12-avg-2-chunk-16-left-64.onnx",
            decoder=f"{model_dir}/decoder-epoch-12-avg-2-chunk-16-left-64.onnx",
            joiner=f"{model_dir}/joiner-epoch-12-avg-2-chunk-16-left-64.onnx",
            keywords_file=f"{model_dir}/keywords.txt",
            num_threads=2,
            max_active_paths=4,
            num_trailing_blanks=1,
            keywords_score=2.0,
            keywords_threshold=0.25,
            provider="cpu",
        )

        self.stream = None
        self.audio_queue = queue.Queue(maxsize=20)  
        self.running = False
        self.last_detect = False
        self.lock = threading.Lock()  
        self.proc = None
        self.audio_thread = None
        self.run_thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self.stream = self.keyword_spotter.create_stream()

        self.audio_thread = threading.Thread(target=self.audio_capture, daemon=True)
        self.audio_thread.start()

        self.run_thread = threading.Thread(target=self.run, daemon=True)
        self.run_thread.start()

    def stop(self):
        self.running = False

        if self.proc is not None:
            try:
                self.proc.terminate()
                self.proc.wait(timeout=1)
            except Exception:
                pass
            self.proc = None

        while not self.audio_queue.empty():
            try:
                self.audio_queue.get_nowait()
            except queue.Empty:
                break

        with self.lock:
            self.last_detect = False

    def audio_capture(self):
        cmd = [
            "arecord",
            "-D", "plughw:2,0",
            "-f", "S16_LE",
            "-c", "1",
            "-r", "16000",
            "-t", "raw",
        ]
        self.proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, bufsize=0)

        while self.running:
            if self.audio_queue.full():
                time.sleep(0.01)
                continue
            pcm = self.proc.stdout.read(1600 * 2)
            if pcm:
                self.audio_queue.put(pcm)

    def run(self):
        sample_rate = 16000
        while self.running:
            try:
                pcm = self.audio_queue.get(timeout=0.1)
            except queue.Empty:
                continue
            audio = np.frombuffer(pcm, dtype=np.int16).astype(np.float32) / 32768.0
            self.stream.accept_waveform(sample_rate, audio)

            while self.keyword_spotter.is_ready(self.stream):
                self.keyword_spotter.decode_stream(self.stream)
                result = self.keyword_spotter.get_result(self.stream)
                if result:
                    with self.lock:
                        self.last_detect = True
                    self.keyword_spotter.reset_stream(self.stream)

    def get_result(self):
        with self.lock:
            if self.last_detect:
                self.last_detect = False
                return True
        return False
