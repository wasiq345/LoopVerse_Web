from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.security import require_role
from backend.models import Assignment, Course, Student

router = APIRouter(prefix="/api/admin/assignments", tags=["assignments"], dependencies=[Depends(require_role("admin"))])
Db = Annotated[Session, Depends(get_db)]


class AssignmentIn(BaseModel):
    student_id: int
    course_ids: list[int]


def validate_count(count: int):
    if not 4 <= count <= 6:
        raise HTTPException(422, "Each student must have between 4 and 6 courses")


@router.get("")
def list_assignments(db: Db):
    students = db.scalars(select(Student).order_by(Student.full_name)).all()
    return [{"student_id": student.id, "student": student.full_name, "registration": student.registration_number, "assigned": db.scalar(select(func.count(Assignment.id)).where(Assignment.student_id == student.id)) or 0} for student in students]


@router.put("/{student_id}")
def replace_assignments(student_id: int, payload: AssignmentIn, db: Db):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if student.date_sheet_saved:
        raise HTTPException(409, "Assignments are locked after date-sheet save")
    if payload.student_id != student_id or len(set(payload.course_ids)) != len(payload.course_ids):
        raise HTTPException(422, "Course assignments must be unique")
    validate_count(len(payload.course_ids))
    courses = db.scalars(select(Course).where(Course.id.in_(payload.course_ids), Course.active.is_(True))).all()
    if len(courses) != len(payload.course_ids):
        raise HTTPException(422, "Every assigned course must be active and valid")
    db.query(Assignment).filter(Assignment.student_id == student_id).delete()
    db.add_all([Assignment(student_id=student_id, course_id=course_id) for course_id in payload.course_ids])
    db.commit()
    return {"message": "Assignments updated", "assigned": len(payload.course_ids)}
