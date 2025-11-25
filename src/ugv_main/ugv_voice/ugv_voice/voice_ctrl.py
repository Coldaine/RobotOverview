#!/usr/bin/env python3
import os
import re
import time
import yaml
import random
import threading
import tempfile

import pyttsx3
import pygame
import rclpy
from rclpy.node import Node
from std_msgs.msg import String

from .tts_sherpa_onnx import tts_sherpa_onnx

import subprocess

class VoiceCtrl(Node):
    def __init__(self):
        super().__init__('voice_ctrl')

        this_path = os.path.dirname(os.path.realpath(__file__))
        config_path = os.path.join(this_path, "../config/voice_config.yaml")
        with open(config_path, "r") as yaml_file:
            self.config = yaml.safe_load(yaml_file)

        pygame.mixer.init()
        pygame.mixer.music.set_volume(self.config['audio_config']['default_volume'])

        tts_model_dir = os.path.join(this_path, "models", "sherpa-onnx-vits-zh-ll")
        self.tts = tts_sherpa_onnx(tts_model_dir)
        self.engine = pyttsx3.init()
        self.engine.setProperty('rate', self.config['audio_config']['speed_rate'])

        self.usb_connected = False
        try:
            self.usb_connected = True
            self.get_logger().info("Audio USB connected")
        except Exception as e:
            self.usb_connected = False
            self.get_logger().warn(f"Audio USB not connected: {e}")

        self.play_audio_event = threading.Event()
        self.min_time_between_play = self.config['audio_config']['min_time_bewteen_play']

        self.subscription = self.create_subscription(String,'/speech',self.speech_callback,10)

    def contains_chinese(self, text):
        return bool(re.search('[\u4e00-\u9fff]', text))

    def play_audio(self, input_audio_file):
        if not self.usb_connected:
            return
        try:
            pygame.mixer.music.load(input_audio_file)
            pygame.mixer.music.play()
        except:
            play_audio_event.clear()
            return
        while pygame.mixer.music.get_busy():
            pass
        time.sleep(self.min_time_between_play)
        self.play_audio_event.clear()

    def play_speech(self, input_text):
        filename = 'audio-say.wav'
        if not self.usb_connected:
            return
        try:
            if self.contains_chinese(input_text):
                filename = self.tts.synthesize(input_text, output_wav=os.path.join("/home/ws/ugv_ws/tts_cn.wav"))
                self.play_audio(filename)                  
            else:
                filename = os.path.join("/home/ws/ugv_ws/tts_en.wav")
                self.engine.save_to_file(input_text, filename)
                self.engine.runAndWait()
                if os.path.exists(filename) and os.path.getsize(filename) > 0:
                    self.play_audio(filename)
                else:
                    self.get_logger().warn("TTS file not generated correctly")
        except Exception as e:
            self.get_logger().error(f"[play failure] {e}")
        finally:
            if filename and os.path.exists(filename):
                try:
                    os.remove(filename)
                except Exception as e:
                    self.get_logger().warn(f"[delete file failure] {e}")
            self.play_audio_event.clear()

    def speech_callback(self, msg):
        self.get_logger().info(f"Speech request: {msg.data}")

        if not self.usb_connected:
            return
        if self.play_audio_event.is_set():
            return
        self.play_audio_event.set()

        self.play_speech(msg.data)

def main(args=None):
    rclpy.init(args=args)
    node = VoiceCtrl()
    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
