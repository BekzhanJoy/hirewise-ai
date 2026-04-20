import requests


def call_ollama(prompt: str, model: str = "deepseek-r1:1.5b") -> str:
    url = "http://localhost:11434/api/chat"

    payload = {
        "model": model,
        "messages": [
            {"role": "user", "content": prompt}
        ],
        "stream": False
    }

    try:
        response = requests.post(url, json=payload, timeout=60)
        response.raise_for_status()
        data = response.json()

        return data.get("message", {}).get("content", "")

    except requests.exceptions.Timeout:
        print("❌ Timeout: Ollama did not respond in time")
        return ""

    except requests.exceptions.RequestException as e:
        print(f"❌ Request error: {e}")
        return ""


if __name__ == "__main__":
    result = call_ollama("tell what are you")
    print("LLM response:", result)