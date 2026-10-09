from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg://postgres:postgres@localhost:5432/examslot"
    frontend_url: str = "http://localhost:5173,http://127.0.0.1:5173"
    jwt_secret: str = "change-this-development-secret"
    access_token_minutes: int = 60
    app_url: str = "http://localhost:5173"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@examslot.local"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
