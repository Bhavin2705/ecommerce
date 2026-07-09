from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://ecommerce_user:ecommerce_pass@db:5432/ecommerce_db"
    REDIS_URL: str = "redis://redis:6379/0"
    JWT_SECRET_KEY: str = "dev-secret-key"
    JWT_REFRESH_SECRET_KEY: str = "dev-refresh-secret-key"
    JWT_ACCESS_EXPIRE_MINUTES: int = 15
    JWT_REFRESH_EXPIRE_DAYS: int = 7
    ADMIN_EMAIL: str = "admin@ecommerce.com"
    ADMIN_PASSWORD: str = "Admin123!@#"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

@lru_cache()
def get_settings() -> Settings:
    return Settings()
