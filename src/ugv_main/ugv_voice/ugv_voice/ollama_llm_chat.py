import requests
import json

class ollama_llm_chat:
    def __init__(self, server_url="http://192.168.9.125:11434/api/chat", model="qwen3:8b"):
        self.server_url = server_url
        self.model = model

    def ask(self, user_text: str) -> str:
        try:
            data = {
                "model": self.model,
                "stream": False,
                "messages": [
                    {"role": "user", "content": user_text}
                ]
            }

            response = requests.post(
                self.server_url,
                headers={"Content-Type": "application/json"},
                json=data
            )
            response.raise_for_status()

            res_json = response.json()
            reply = res_json["message"]["content"]
            return reply

        except Exception as e:
            return f"llm model request failed: {e}"
