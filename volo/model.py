"""Small Chat Completions transport; no unmetered model fallback."""
from __future__ import annotations

import http.client
import json
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


class ModelError(RuntimeError):
    pass


# CNY per million tokens, by gateway model id: uncached input, cached input, output.
# A run is charged money, not tokens, and the three rates differ by two orders of
# magnitude between models and by thirty between a cache hit and a miss: run 5 of the
# Keep rehearsal read 3.66 M input tokens of which 2.42 M were cached, and cost CNY 8.4
# rather than the CNY 11 the same tokens would have cost uncached. A token ceiling
# cannot express that, so the terminal condition is the cost.
PRICES = {
    'deepseek-v4-flash': (3.0, 0.1, 9.0),
    'deepseek-v4-pro': (9.0, 0.3, 27.0),
    'kimi-k3': (20.0, 2.0, 100.0),
    'qwen3.6-flash': (1.2, 1.2, 7.2),
}

# An id the table does not name is charged at the dearest general model we are
# configured to call, so an unrecognised model can never spend more than the budget
# believes it has.
UNKNOWN_MODEL_PRICE = PRICES['deepseek-v4-pro']


def price_of(model):
    """The three rates for one gateway model id."""
    return PRICES.get(str(model or '').strip().lower(), UNKNOWN_MODEL_PRICE)


def call_cost(model, prompt_tokens, cached_tokens, completion_tokens):
    """CNY for one response, from the token counts the gateway reported for it.

    `prompt_tokens` is the whole prompt including the cached part, which is how both
    DeepSeek and the organizer's gateway report it, so the uncached part is the
    difference. A gateway that reports more cached tokens than prompt tokens is charged
    as if none were cached rather than credited.
    """
    miss, hit, output = price_of(model)
    cached = max(0, min(int(cached_tokens), int(prompt_tokens)))
    uncached = int(prompt_tokens) - cached
    return (uncached * miss + cached * hit + int(completion_tokens) * output) / 1000000


@dataclass
class Usage:
    calls: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    cached_prompt_tokens: int = 0
    missing_usage_calls: int = 0
    cost_cny: float = 0.0

    @property
    def total_tokens(self):
        return self.prompt_tokens + self.completion_tokens


class Model:
    def __init__(self, base_url, api_key, model, trace, *, timeout=600, max_output=16384, max_attempts=3):
        parsed = urllib.parse.urlparse(base_url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            raise ValueError("Invalid OPENAI_BASE_URL")
        if parsed.scheme != "https" and parsed.hostname not in ("localhost", "127.0.0.1", "::1"):
            raise ValueError("Remote model gateways must use HTTPS")
        if parsed.username or parsed.password or parsed.query or parsed.fragment:
            raise ValueError("Model base URL must not contain credentials or query parameters")
        self.url = base_url.rstrip("/") + "/chat/completions"
        self.api_key, self.model, self.trace = api_key, model, trace
        if type(max_attempts) is not int or not 1 <= max_attempts <= 3:
            raise ValueError("max_attempts must be between 1 and 3")
        self.timeout, self.max_output = timeout, max_output
        self.max_attempts = max_attempts
        self.thinking = None
        self.usage = Usage()

    def complete(self, messages, tools, *, remaining_seconds=None, forced_tool=None):
        deepseek_thinking = self.model.lower().startswith('deepseek') and self.thinking == 'enabled'
        if deepseek_thinking:
            messages = [{**message, 'content': ''} if message.get('role') == 'assistant'
                        and message.get('tool_calls') and message.get('content') is None else message
                        for message in messages]
        body = {"model": self.model, "messages": messages, "tools": tools,
                "stream": False, "max_tokens": self.max_output}
        if self.thinking in ("enabled", "disabled") and self.model.lower().startswith("deepseek"):
            body["thinking"] = {"type": self.thinking}
            if self.thinking == 'disabled':
                body['temperature'] = 0
            else:
                # V4 defaults to high; E012 spent 58,034 reasoning tokens before
                # returning a truncated tool call. Keep bounded coding turns at low.
                body['reasoning_effort'] = 'low'
        if forced_tool:
            if forced_tool not in {t['function']['name'] for t in tools}:
                raise ValueError("Forced tool must be advertised")
            # DeepSeek thinking-mode integrations reject tool_choice. Keep the
            # advertised tool menu, but let that model select a tool itself.
            if not deepseek_thinking:
                body['tool_choice'] = {'type': 'function', 'function': {'name': forced_tool}}
        if self.thinking in ('enabled', 'disabled') and self.model.lower().startswith('qwen3.'):
            body['enable_thinking'] = self.thinking == 'enabled'
        if self.model.lower() == 'kimi-k3':
            # K3 always reasons; its documented default is max, not a binary
            # thinking switch. Low is the supported bounded-generation policy.
            body['reasoning_effort'] = 'low'
        self.trace.event("model_request", model=self.model, gateway=self.url, messages=messages, tools=tools,
                         timeout_seconds=min(self.timeout, remaining_seconds) if remaining_seconds else self.timeout,
                         parameters={k: v for k, v in body.items() if k not in ('messages', 'tools')})
        data = json.dumps(body, ensure_ascii=False).encode()
        for attempt in range(self.max_attempts):
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
                # 502/503/504 come from the gateway's own proxy, which means no upstream
                # answer reached us whether or not one was produced. A run that
                # implements a large package makes tens of calls, so losing all of them
                # to one transient proxy error is the worse failure. 2026-09-14: a Keep
                # rehearsal died on `Gateway HTTP 502` from openresty, and the same key
                # answered normally seconds later.
                if exc.code in (429, 502, 503, 504) and attempt < self.max_attempts - 1:
                    delay = min(10, 2 ** (attempt + 1))
                    if remaining_seconds is not None and remaining_seconds < delay + 5:
                        raise ModelError("Model rate-limited with no retry time remaining") from exc
                    time.sleep(delay)
                    if remaining_seconds is not None:
                        remaining_seconds -= time.monotonic() - started
                    continue
                raise ModelError(f"Gateway HTTP {exc.code}: {self.trace.redact(detail)}") from exc
            except (OSError, ValueError, http.client.HTTPException) as exc:
                # A transport failure can have consumed tokens, so it is recorded, never
                # hidden. It is retried once all the same: 2026-09-15, a Bookstack batch
                # eight calls in was lost to one TLS EOF, and a duplicate prompt costs
                # less than any batch. http.client.HTTPException covers IncompleteRead and
                # RemoteDisconnected, which killed a whole Bookstack run at batch 7 because
                # nothing above this frame catches them.
                self.trace.event("model_transport_uncertain", error=str(exc), attempt=attempt + 1)
                if isinstance(exc, (OSError, http.client.HTTPException)) and attempt < self.max_attempts - 1 and (
                        remaining_seconds is None or remaining_seconds > 10):
                    time.sleep(2)
                    if remaining_seconds is not None:
                        remaining_seconds -= time.monotonic() - started
                    continue
                raise ModelError("Model request failed; gateway usage may have been consumed") from exc
            usage = result.get("usage")
            if isinstance(usage, dict) and usage.get("prompt_tokens") is not None and usage.get("completion_tokens") is not None:
                cached = int((usage.get("prompt_tokens_details") or {}).get("cached_tokens", 0))
                self.usage.prompt_tokens += int(usage["prompt_tokens"])
                self.usage.completion_tokens += int(usage["completion_tokens"])
                self.usage.cached_prompt_tokens += cached
                # Each response is priced at its own model's rates: the reference
                # observer shares this Usage object but is a different, cheaper model.
                self.usage.cost_cny = round(self.usage.cost_cny + call_cost(
                    self.model, usage["prompt_tokens"], cached, usage["completion_tokens"]), 6)
            else:
                # A response with no usage is still a real charge; it cannot be priced,
                # so the count of them is what the run reports instead.
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
