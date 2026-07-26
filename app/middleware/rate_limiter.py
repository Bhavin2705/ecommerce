from fastapi import HTTPException, Request
import time


def get_rate_limiter(max_requests: int = 5, window_seconds: int = 60):
    async def rate_limit(request: Request):
        from app.utils.redis_client import redis_client
        if redis_client is None:
            return

        client_ip = request.client.host if request.client else "unknown"
        key = f"rate_limit:{client_ip}:{request.url.path}"

        try:
            current = redis_client.get(key)
            if current is not None and int(current) >= max_requests:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please try again later."
                )

            pipe = redis_client.pipeline()
            pipe.incr(key)
            pipe.expire(key, window_seconds)
            pipe.execute()
        except HTTPException:
            raise
        except Exception:
            pass

    return rate_limit


login_rate_limit = get_rate_limiter(max_requests=5, window_seconds=60)
register_rate_limit = get_rate_limiter(max_requests=3, window_seconds=60)
