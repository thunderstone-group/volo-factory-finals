"""Small Chat Completions transport; no unmetered model fallback."""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


class ModelError(RuntimeError):
    pass


@dataclass
class Usage:
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    missing_usage_calls: int = 0

    @property
    def total_tokens(self):
        return self.prompt_tokens + self.completion_tokens


class Model:
    def __init__(self, base_url, api_key, model, trace, *, timeout=180, max_output=8192):
        parsed = urllib.parse.urlparse(base_url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Invalid OPENAI_BASE_URL")
        if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise ValueError("Remote model gateways must use HTTPS")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Model base URL must not contain credentials or query parameters")
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.api_key, self.model, self.trace = api_key, model, trace
        self.timeout, self.max_output = timeout, max_output
        self.usage = Usage()

    def complete(self, messages, tools, *, remaining_seconds=None):
        body = {"model": self.model, "messages": messages, "tools": tools,
                "stream": False, "max_tokens": self.max_output}
        self.trace.event("model_request", model=self.model, messages=messages, tools=tools)
        data = json.dumps(body, ensure_ascii=False).encode()
        for attempt in range(3):
            request = urllib.request.Request(self.url, data=data, headers={
                "Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"})
            self.usage.calls += 1
            started = time.monotonic()
            try:
                timeout = min(self.timeout, remaining_seconds) if remaining_seconds else self.timeout
                with urllib.request.urlopen(request, timeout=max(1, timeout)) as response:
                    result = json.load(response)
            except urllib.error.HTTPError as exc:
                detail = exc.read(4096).decode(errors="replace")
                self.trace.event("model_http_error", status=exc.code, detail=detail)
                if exc.code == 429 and attempt < 2:
                    delay = min(10, 2 ** (attempt + 1))
                    if remaining_seconds is not None and remaining_seconds < delay + 5:
                        raise ModelError("Model rate-limited with no retry time remaining") from exc
                    time.sleep(delay)
                    if remaining_seconds is not None:
                        remaining_seconds -= time.monotonic() - started
                    continue
                raise ModelError(f"Gateway HTTP {exc.code}: {self.trace.redact(detail)}") from exc
            except (OSError, ValueError) as exc:
                # A transport failure can have consumed tokens. Do not silently retry it.
                self.trace.event("model_transport_uncertain", error=str(exc))
                raise ModelError("Model request failed; gateway usage may have been consumed") from exc
            usage = result.get("usage")
            if isinstance(usage, dict) and usage.get("prompt_tokens") is not None and usage.get("completion_tokens") is not None:
                self.usage.prompt_tokens += int(usage["prompt_tokens"])
                self.usage.completion_tokens += int(usage["completion_tokens"])
            else:
                self.usage.missing_usage_calls += 1
            self.trace.event("model_response", response=result,
                             latency_seconds=round(time.monotonic() - started, 3))
            choices = result.get("choices") or []
            if not choices or not isinstance(choices[0].get("message"), dict):
                raise ModelError("Gateway returned no assistant message")
            choice = choices[0]
            message = choice["message"]
            if message.get("role") != "assistant":
                raise ModelError("Gateway returned a non-assistant message")
            # Retain reasoning_content exactly in subsequent requests, including tool turns.
            # DeepSeek explicitly requires this for its thinking-mode tool protocol.
            return message, choice.get("finish_reason")
        raise ModelError("Gateway retry limit reached")
