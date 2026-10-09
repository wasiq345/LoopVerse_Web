from datetime import datetime, timedelta, timezone
from hashlib import sha256
import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import create_token, hash_password, verify_password
from backend.models import AdminUser, Student

router = APIRouter(prefix="/api/auth", tags=["auth"])
Db = Annotated[Session, Depends(get_db)]


class LoginIn(BaseModel):
    email: str
    password: str = Field(min_length=8)


class SetupPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=8)


@router.post("/login")
def login(payload: LoginIn, db: Db):
    admin = db.scalar(select(AdminUser).where(AdminUser.email == payload.email.lower()))
    if admin and verify_password(payload.password, admin.password_hash):
        return {"access_token": create_token(str(admin.id), "admin"), "token_type": "bearer", "role": "admin"}
    student = db.scalar(select(Student).where(Student.email == payload.email.lower()))
    if student and student.password_hash and verify_password(payload.password, student.password_hash):
        return {"access_token": create_token(str(student.id), "student"), "token_type": "bearer", "role": "student", "student_id": student.id}
    raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid email or password")


@router.post("/student/{student_id}/setup-password")
def setup_password(student_id: int, payload: SetupPasswordIn, db: Db):
    student = db.get(Student, student_id)
    if not student or not student.password_setup_token_hash or not student.password_setup_expires_at:
        raise HTTPException(400, "Invalid setup link")
    if student.password_setup_expires_at < datetime.now(timezone.utc).replace(tzinfo=None) or sha256(payload.token.encode()).hexdigest() != student.password_setup_token_hash:
        raise HTTPException(400, "Setup link is expired or invalid")
    student.password_hash = hash_password(payload.password)
    student.password_setup_token_hash = None
    student.password_setup_expires_at = None
    db.commit()
    return {"message": "Password set successfully"}


def issue_setup_token(student: Student) -> str:
    token = secrets.token_urlsafe(32)
    student.password_setup_token_hash = sha256(token.encode()).hexdigest()
    student.password_setup_expires_at = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
    return token
