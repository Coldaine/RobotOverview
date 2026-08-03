#!/usr/bin/env python3
import os
import re
import time
import yaml
import threading

import pyttsx3
import pygame
import rclpy
from rclpy.node import Node
from std_msgs.msg import Bool
from rcl_interfaces.msg import ParameterDescriptor

from .kws_sherpa_onnx import kws_sherpa_onnx
from .asr_sherpa_ncnn import asr_sherpa_ncnn
from .ollama_llm_chat import ollama_llm_chat
from .tts_sherpa_onnx import tts_sherpa_onnx


# ================== Language Config ==================
LANG_CONFIG = {
    "zh": {
        "kws_model": "sherpa-onnx-kws-zipformer-wenetspeech-3.3M-2024-01-01",
        "asr_model": "sherpa-ncnn-streaming-zipformer-bilingual-zh-en-2023-02-13",
        "wake_prompt": "我在，你说",
        "no_hear_prompt": "没有听清，请再说一遍",
    },
    "en": {
        "kws_model": "sherpa-onnx-kws-zipformer-gigaspeech-3.3M-2024-01-01",
        "asr_model": "sherpa-ncnn-streaming-zipformer-bilingual-zh-en-2023-02-13",
        "wake_prompt": "I'm listening",
        "no_hear_prompt": "Sorry, I didn't catch that",
    }
}


class VoiceChat(Node):
    def __init__(self):
        super().__init__('voice_chat')

        # ---------- Config ----------
        this_path = os.path.dirname(os.path.realpath(__file__))
        config_path = os.path.join(this_path, "../config/voice_config.yaml")
        with open(config_path, "r") as f:
            self.config = yaml.safe_load(f)

        # ---------- Language ----------
        self.declare_parameter(
            "language",
            "zh",
            ParameterDescriptor(description="Language: zh or en")
        )
        self.language = self.get_parameter("language").value

        self.declare_parameter(
            "server_url",
            "http://192.168.9.130:11434/api/chat",
            ParameterDescriptor(description="Server url")
        )
        self.server_url = self.get_parameter("server_url").value

        if self.language not in LANG_CONFIG:
            self.get_logger().warn(
                f"Unsupported language '{self.language}', fallback to zh"
            )
            self.language = "zh"

        lang_cfg = LANG_CONFIG[self.language]

        # ---------- Audio ----------
        pygame.mixer.init()
        pygame.mixer.music.set_volume(
            self.config['audio_config']['default_volume']
        )
        self.min_time_between_play = self.config['audio_config']['min_time_bewteen_play']
        self.usb_connected = True

        # ---------- KWS ----------
        kws_model_dir = os.path.join(
            this_path, "models", "kws", lang_cfg["kws_model"]
        )
        self.kws = kws_sherpa_onnx(kws_model_dir)
        self.kws_enabled = True
        self.kws.start()

        # ---------- ASR ----------
        asr_model_dir = os.path.join(
            this_path, "models", "asr", lang_cfg["asr_model"]
        )
        self.asr = asr_sherpa_ncnn(asr_model_dir)

        # ---------- LLM ----------
        self.declare_parameter(
            "prompt_file",
            os.path.join(this_path, "prompt.txt"),
        )
        self.declare_parameter("llm_model", "qwen3:8b")
        prompt_path = self.get_parameter("prompt_file").value
        self.system_prompt = ""
        if os.path.isfile(prompt_path):
            with open(prompt_path, "r", encoding="utf-8") as f:
                self.system_prompt = f.read().strip()
            self.get_logger().info(f"Loaded prompt ({len(self.system_prompt)} chars)")
        else:
            self.get_logger().warn(f"prompt file not found: {prompt_path}")
        llm_model = self.get_parameter("llm_model").value
        self.llm = ollama_llm_chat(self.server_url, model=llm_model)

        tts_model_dir = os.path.join(this_path, "models/sherpa-onnx-vits-zh-ll")
        self.tts = tts_sherpa_onnx(tts_model_dir)

        self.engine = pyttsx3.init()
        self.engine.setProperty(
            'rate',
            self.config['audio_config']['speed_rate']
        )

        # ---------- Threads & Topics ----------
        threading.Thread(target=self.kws_loop, daemon=True).start()

        self.kws_subscription = self.create_subscription(
            Bool,
            '/kws',
            self.kws_callback,
            10
        )

        self.play_audio_event = threading.Event()

    # ================== KWS Loop ==================
    def kws_loop(self):
        while True:
            if self.kws_enabled and self.kws.get_result():
                self.get_logger().info("KWS wake trigger")
                self.kws_enabled = False
                self.handle_wakeup_flow()
            time.sleep(0.1)

    # ================== KWS Topic ==================
    def kws_callback(self, msg):
        if msg.data and self.kws_enabled:
            self.get_logger().info("/kws wake trigger")
            self.kws_enabled = False
            self.handle_wakeup_flow()

    # ================== Wakeup Flow ==================
    def handle_wakeup_flow(self):
        lang_cfg = LANG_CONFIG[self.language]

        # Step1: Wake prompt
        self.play_speech(lang_cfg["wake_prompt"])

        # Step2: Stop KWS
        self.kws.stop()

        # Step3: Start ASR
        self.asr.start()
        self.get_logger().info("Start ASR")

        text = None
        start_time = time.time()

        while time.time() - start_time < 10:
            result = self.asr.get_result()
            if result:
                text = result
                break
            time.sleep(0.05)

        if not text:
            self.play_speech(lang_cfg["no_hear_prompt"])
        else:
            self.get_logger().info(f"ASR: {text}")
            reply = self.llm.ask(text)
            self.get_logger().info(f"LLM: {reply}")
            self.play_speech(reply)

        # Step4: Restore
        self.asr.stop()
        self.kws.start()
        self.kws_enabled = True
        self.get_logger().info("Wakeup flow finished")

    # ================== Utils ==================
    def contains_chinese(self, text):
        return bool(re.search('[\u4e00-\u9fff]', text))

    def play_audio(self, filepath):
        if not self.usb_connected or not os.path.exists(filepath):
            return
        try:
            pygame.mixer.music.load(filepath)
            pygame.mixer.music.play()
            while pygame.mixer.music.get_busy():
                time.sleep(0.05)
        except Exception as e:
            self.get_logger().error(f"Play audio failed: {e}")
        time.sleep(self.min_time_between_play)

    def play_speech(self, input_text):
        filename = 'audio-say.wav'
        if not self.usb_connected:
            return
        try:
            if self.contains_chinese(input_text):
                filename = self.tts.synthesize(
                    input_text,
                    output_wav="/home/ws/ugv_ws/tts_cn.wav"
                )
                self.play_audio(filename)
            else:
                filename = "/home/ws/ugv_ws/tts_en.wav"
                self.engine.save_to_file(input_text, filename)
                self.engine.runAndWait()
                if os.path.exists(filename) and os.path.getsize(filename) > 0:
                    self.play_audio(filename)
        except Exception as e:
            self.get_logger().error(f"[play failure] {e}")
        finally:
            if filename and os.path.exists(filename):
                try:
                    os.remove(filename)
                except Exception:
                    pass
            self.play_audio_event.clear()


# ================== Main ==================
def main(args=None):
    rclpy.init(args=args)
    node = VoiceChat()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    node.destroy_node()
    rclpy.shutdown()