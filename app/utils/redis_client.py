import json
from typing import Optional, Any
import redis
from app.config import get_settings

settings = get_settings()

try:
    redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    redis_client.ping()
except Exception:
    redis_client = None

def get_cache(key: str) -> Optional[Any]:
    if redis_client is None:
        return None
    try:
        data = redis_client.get(key)
        if data:
            return json.loads(data)
        return None
    except Exception:
        return None

def set_cache(key: str, data: Any, ttl: int = 300) -> None:
    if redis_client is None:
        return
    try:
        redis_client.set(key, json.dumps(data, default=str), ex=ttl)
    except Exception:
        pass

def flush_pattern(pattern: str) -> None:
    if redis_client is None:
        return
    try:
        keys = redis_client.keys(pattern)
        if keys:
            redis_client.delete(*keys)
    except Exception:
        pass

def delete_key(key: str) -> None:
    if redis_client is None:
        return
    try:
        redis_client.delete(key)
    except Exception:
        pass
