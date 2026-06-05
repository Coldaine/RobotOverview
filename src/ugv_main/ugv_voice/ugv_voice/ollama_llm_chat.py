import requests
import json

class ollama_llm_chat:
    def __init__(self, server_url="http://192.168.9.130:11434/api/chat", model="qwen3:8b"):
        self.server_url = server_url
        self.model = model

    def ask(self, user_text: str, system: str = "") -> str:
        try:
            messages = []
            if system:
                messages.append({"role": "system", "content": system})
            messages.append({"role": "user", "content": user_text})

            data = {
                "model": self.model,
                "stream": False,
                "messages": messages,
            }

            response = requests.post(
                self.server_url,
                headers={"Content-Type": "application/json"},
                json=data,
                timeout=120,
            )
            response.raise_for_status()

            return response.json()["message"]["content"]

        except Exception as e:
            return f"llm model request failed: {e}"
