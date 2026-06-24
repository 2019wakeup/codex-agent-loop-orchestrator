from __future__ import annotations

import hashlib
import hmac
import time

from fastapi import Header, HTTPException

from .models import LoopContract


def sign_payload(secret: str, timestamp: str, body: bytes) -> str:
    digest = hmac.new(secret.encode("utf-8"), timestamp.encode("utf-8") + b"." + body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def verify_signature(contract: LoopContract, body: bytes, timestamp: str | None, signature: str | None) -> None:
    secret = contract.webhook.secret
    if not secret:
        return
    if not timestamp or not signature:
        raise HTTPException(status_code=401, detail="missing webhook signature headers")
    try:
        ts = int(timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail="invalid webhook timestamp") from exc
    now = int(time.time())
    if abs(now - ts) > contract.webhook.timestamp_tolerance_seconds:
        raise HTTPException(status_code=401, detail="webhook timestamp outside tolerance")
    expected = sign_payload(secret, timestamp, body)
    if not hmac.compare_digest(expected, signature):
        raise HTTPException(status_code=401, detail="invalid webhook signature")
