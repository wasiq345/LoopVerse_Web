from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.core.email import send_password_setup_email
from backend.core.config import settings
from backend.core.security import require_role
from backend.routers.auth import issue_setup_token
from backend.models import Assignment, Branch, Course, ExamSlot, Student, StudentRequest
from backend.schemas import BranchIn, CourseIn, RequestIn, SlotIn, StudentIn

router = APIRouter(prefix="/api", tags=["admin"], dependencies=[Depends(require_role("admin"))])
Db = Annotated[Session, Depends(get_db)]


def page_result(query, db: Session, page: int, page_size: int) -> dict:
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = [dict(item) for item in db.execute(query.offset((page - 1) * page_size).limit(page_size)).mappings().all()]
    return {"items": items, "page": page, "page_size": page_size, "total": total, "pages": max(1, (total + page_size - 1) // page_size)}


def pagination(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100)):
    return page, page_size


@router.get("/dashboard")
def dashboard(db: Db):
    return {"students": db.scalar(select(func.count(Student.id))) or 0, "branches": db.scalar(select(func.count(Branch.id)).where(Branch.active.is_(True))) or 0, "courses": db.scalar(select(func.count(Course.id)).where(Course.active.is_(True))) or 0, "pending_requests": db.scalar(select(func.count(StudentRequest.id)).where(StudentRequest.status == "pending")) or 0}


@router.get("/branches")
def list_branches(db: Db, paging: Annotated[tuple[int, int], Depends(pagination)], search: str = ""):
    page, page_size = paging
    needle = f"%{search.strip()}%"
    query = select(Branch.id, Branch.name, Branch.code, Branch.city, Branch.address, Branch.contact, Branch.active).where(or_(Branch.name.ilike(needle), Branch.code.ilike(needle), Branch.city.ilike(needle))).order_by(Branch.name)
    return page_result(query, db, page, page_size)


@router.post("/branches", status_code=status.HTTP_201_CREATED)
def create_branch(payload: BranchIn, db: Db):
    branch = Branch(**payload.model_dump())
    db.add(branch)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Branch code already exists")
    db.refresh(branch)
    return branch


@router.delete("/branches/{branch_id}")
def delete_branch(branch_id: int, db: Db):
    branch = db.get(Branch, branch_id)
    if not branch:
        raise HTTPException(404, "Branch not found")
    if branch.students:
        branch.active = False
        db.commit()
        return {"message": "Branch has students and was marked inactive instead"}
    db.delete(branch)
    db.commit()
    return {"message": "Branch deleted"}


@router.get("/courses")
def list_courses(db: Db, paging: Annotated[tuple[int, int], Depends(pagination)], search: str = ""):
    page, page_size = paging
    needle = f"%{search.strip()}%"
    query = select(Course.id, Course.code, Course.title, Course.department, Course.credits, Course.active).where(or_(Course.code.ilike(needle), Course.title.ilike(needle), Course.department.ilike(needle))).order_by(Course.code)
    return page_result(query, db, page, page_size)


@router.post("/courses", status_code=status.HTTP_201_CREATED)
def create_course(payload: CourseIn, db: Db):
    course = Course(**payload.model_dump())
    db.add(course)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Course code already exists")
    db.refresh(course)
    return course


@router.delete("/courses/{course_id}")
def delete_course(course_id: int, db: Db):
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "Course not found")
    assignment_count = db.scalar(select(func.count()).select_from(Assignment).where(Assignment.course_id == course_id)) or 0
    slot_count = db.scalar(select(func.count()).select_from(ExamSlot).where(ExamSlot.course_id == course_id)) or 0
    if assignment_count or slot_count:
        course.active = False
        db.commit()
        return {"message": "Course is in use and was marked inactive instead"}
    db.delete(course)
    db.commit()
    return {"message": "Course deleted"}


@router.get("/students")
def list_students(db: Db, paging: Annotated[tuple[int, int], Depends(pagination)], search: str = ""):
    page, page_size = paging
    needle = f"%{search.strip()}%"
    query = select(Student.id, Student.full_name, Student.email, Student.registration_number, Student.program, Student.semester, Student.date_sheet_saved).where(or_(Student.full_name.ilike(needle), Student.email.ilike(needle), Student.registration_number.ilike(needle))).order_by(Student.full_name)
    return page_result(query, db, page, page_size)


@router.post("/students", status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentIn, db: Db):
    student = Student(**payload.model_dump())
    setup_token = issue_setup_token(student)
    db.add(student)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Student email or registration number already exists")
    db.refresh(student)
    setup_url = f"{settings.app_url}/setup-password?student_id={student.id}&token={setup_token}"
    delivered = send_password_setup_email(student.email, student.full_name, setup_url)
    return {"id": student.id, "full_name": student.full_name, "email": student.email, "setup_email_sent": delivered, "development_setup_url": None if delivered else setup_url}


@router.delete("/students/{student_id}")
def delete_student(student_id: int, db: Db):
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    if student.date_sheet_saved:
        raise HTTPException(409, "Students with a saved date sheet cannot be deleted")
    db.query(StudentRequest).filter(StudentRequest.student_id == student_id).delete()
    db.delete(student)
    db.commit()
    return {"message": "Student deleted"}


@router.get("/schedules")
def list_schedules(db: Db, paging: Annotated[tuple[int, int], Depends(pagination)], search: str = ""):
    page, page_size = paging
    needle = f"%{search.strip()}%"
    query = select(ExamSlot.id, Course.code, Course.title, ExamSlot.exam_date, ExamSlot.start_time, ExamSlot.end_time, ExamSlot.selected_count).join(Course).where(or_(Course.code.ilike(needle), Course.title.ilike(needle))).order_by(ExamSlot.exam_date, ExamSlot.start_time)
    return page_result(query, db, page, page_size)


@router.post("/schedules", status_code=status.HTTP_201_CREATED)
def create_schedule(payload: SlotIn, db: Db):
    if not db.get(Course, payload.course_id):
        raise HTTPException(404, "Course not found")
    duplicate = db.scalar(select(ExamSlot).where(ExamSlot.course_id == payload.course_id, ExamSlot.exam_date == payload.exam_date, ExamSlot.start_time == payload.start_time))
    if duplicate:
        raise HTTPException(409, "Duplicate slot for this course")
    slot = ExamSlot(**payload.model_dump())
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot


@router.post("/requests", status_code=status.HTTP_201_CREATED)
def create_request(payload: RequestIn, db: Db):
    if not db.get(Student, payload.student_id):
        raise HTTPException(404, "Student not found")
    existing = db.scalar(select(StudentRequest).where(StudentRequest.student_id == payload.student_id, StudentRequest.request_type == payload.request_type.value, StudentRequest.status == "pending"))
    if existing:
        raise HTTPException(409, "A request of this type is already pending")
    request = StudentRequest(student_id=payload.student_id, request_type=payload.request_type.value, reason=payload.reason)
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/requests")
def list_requests(db: Db, paging: Annotated[tuple[int, int], Depends(pagination)], search: str = ""):
    page, page_size = paging
    needle = f"%{search.strip()}%"
    query = select(
        StudentRequest.id,
        Student.full_name.label("student"),
        StudentRequest.request_type.label("type"),
        StudentRequest.reason,
        StudentRequest.created_at.label("raised"),
        StudentRequest.status,
        StudentRequest.remark,
    ).join(Student, Student.id == StudentRequest.student_id).where(
        or_(Student.full_name.ilike(needle), StudentRequest.request_type.ilike(needle), StudentRequest.reason.ilike(needle), StudentRequest.status.ilike(needle))
    ).order_by(StudentRequest.created_at.desc())
    return page_result(query, db, page, page_size)
