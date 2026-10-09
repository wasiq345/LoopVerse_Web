from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import require_role
from backend.models import Student, StudentRequest

router = APIRouter(prefix="/api/admin", tags=["admin-actions"])
Db = Annotated[Session, Depends(get_db)]
Admin = Annotated[dict, Depends(require_role("admin"))]


class ReviewIn(BaseModel):
    status: str
    remark: str = ""


@router.patch("/requests/{request_id}")
def review_request(request_id: int, payload: ReviewIn, db: Db, _admin: Admin):
    if payload.status not in {"approved", "rejected"}:
        raise HTTPException(422, "Status must be approved or rejected")
    request = db.get(StudentRequest, request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    if request.status != "pending":
        raise HTTPException(409, "Request has already been reviewed")
    request.status = payload.status
    request.remark = payload.remark
    db.commit()
    return {"message": f"Request {payload.status}", "unlock": payload.status == "approved"}


@router.get("/requests/{request_id}")
def request_detail(request_id: int, db: Db, _admin: Admin):
    request = db.get(StudentRequest, request_id)
    if not request:
        raise HTTPException(404, "Request not found")
    return request
