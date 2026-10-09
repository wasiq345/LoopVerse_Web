from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.core.config import settings


connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def upgrade_legacy_schema():
    """Add columns introduced after the first demo database was created."""
    with engine.begin() as connection:
        inspector = inspect(connection)
        student_columns = {column["name"] for column in inspector.get_columns("students")}
        if "password_hash" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN password_hash VARCHAR(255) NOT NULL DEFAULT ''"))
        if "password_setup_token_hash" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN password_setup_token_hash VARCHAR(255)"))
        if "password_setup_expires_at" not in student_columns:
            connection.execute(text("ALTER TABLE students ADD COLUMN password_setup_expires_at TIMESTAMP"))
        request_columns = {column["name"] for column in inspector.get_columns("student_requests")}
        if "unlock_used" not in request_columns:
            connection.execute(text("ALTER TABLE student_requests ADD COLUMN unlock_used BOOLEAN NOT NULL DEFAULT FALSE"))
