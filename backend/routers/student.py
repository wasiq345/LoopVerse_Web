from datetime import datetime, time, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from backend.core.database import get_db
from backend.models import Assignment, Branch, Course, DateSheetSelection, ExamSlot, Student, StudentRequest
from backend.schemas import BranchChoice, DateSheetIn, RequestIn

router = APIRouter(prefix="/api/student", tags=["student"])
Db = Annotated[Session, Depends(get_db)]


def get_student(student_id: int, db: Session) -> Student:
    student = db.get(Student, student_id)
    if not student:
        raise HTTPException(404, "Student not found")
    return student


def serialize_slot(slot: ExamSlot) -> dict:
    return {"id": slot.id, "course_id": slot.course_id, "date": slot.exam_date, "start_time": slot.start_time, "end_time": slot.end_time}


@router.get("/{student_id}/portal")
def portal(student_id: int, db: Db):
    student = get_student(student_id, db)
    assignments = db.scalars(select(Assignment).where(Assignment.student_id == student_id)).all()
    courses = []
    for assignment in assignments:
        course = db.get(Course, assignment.course_id)
        slots = db.scalars(select(ExamSlot).where(ExamSlot.course_id == assignment.course_id, ExamSlot.exam_date >= datetime.now().date()).order_by(ExamSlot.exam_date, ExamSlot.start_time)).all()
        courses.append({"course_id": course.id, "code": course.code, "title": course.title, "slots": [serialize_slot(slot) for slot in slots]})
    selections = db.scalars(select(DateSheetSelection).where(DateSheetSelection.student_id == student_id)).all()
    return {"student": {"id": student.id, "name": student.full_name, "email": student.email, "registration": student.registration_number, "program": student.program, "semester": student.semester, "branch": {"id": student.branch.id, "name": student.branch.name, "city": student.branch.city} if student.branch else None, "date_sheet_saved": student.date_sheet_saved}, "branches": [{"id": branch.id, "name": branch.name, "code": branch.code, "city": branch.city, "address": branch.address} for branch in db.scalars(select(Branch).where(Branch.active.is_(True)).order_by(Branch.name)).all()], "courses": courses, "selections": [{"course_id": item.course_id, "slot_id": item.slot_id} for item in selections]}


@router.get("/{student_id}/date-sheet/print")
def print_date_sheet(student_id: int, db: Db):
    student = get_student(student_id, db)
    if not student.date_sheet_saved:
        raise HTTPException(409, "Date sheet has not been saved")
    selections = db.scalars(select(DateSheetSelection).where(DateSheetSelection.student_id == student_id)).all()
    return {"student": student.full_name, "registration": student.registration_number, "program": student.program, "branch": student.branch.name if student.branch else None, "rows": [{"code": item.slot.course.code, "title": item.slot.course.title, "date": item.slot.exam_date, "start_time": item.slot.start_time, "end_time": item.slot.end_time} for item in sorted(selections, key=lambda item: (item.slot.exam_date, item.slot.start_time))]}


@router.post("/{student_id}/branch", status_code=status.HTTP_200_OK)
def choose_branch(student_id: int, payload: BranchChoice, db: Db):
    student = get_student(student_id, db)
    if student.branch_id:
        raise HTTPException(409, "Branch has already been selected")
    branch = db.get(Branch, payload.branch_id)
    if not branch or not branch.active:
        raise HTTPException(404, "Active branch not found")
    student.branch_id = branch.id
    db.commit()
    return {"message": "Branch selected", "branch_id": branch.id}


@router.post("/{student_id}/date-sheet", status_code=status.HTTP_201_CREATED)
def save_date_sheet(student_id: int, payload: DateSheetIn, db: Db):
    student = get_student(student_id, db)
    if not student.branch_id:
        raise HTTPException(409, "Select a branch before choosing exam slots")
    if student.date_sheet_saved:
        raise HTTPException(409, "Date sheet is already locked")
    assignments = db.scalars(select(Assignment).where(Assignment.student_id == student_id)).all()
    assigned_courses = {assignment.course_id for assignment in assignments}
    if not 4 <= len(assigned_courses) <= 6:
        raise HTTPException(422, "A student must have between 4 and 6 assigned courses")
    if len(payload.selections) != len(assigned_courses) or {item.course_id for item in payload.selections} != assigned_courses:
        raise HTTPException(422, "Choose exactly one slot for every assigned course")

    slots = []
    for choice in payload.selections:
        slot = db.get(ExamSlot, choice.slot_id)
        if not slot or slot.course_id != choice.course_id or slot.exam_date < datetime.now().date():
            raise HTTPException(422, "One or more selected slots are invalid")
        slots.append(slot)

    def interval(slot):
        start = datetime.combine(slot.exam_date, slot.start_time)
        end = datetime.combine(slot.exam_date, slot.end_time) if slot.end_time else start + timedelta(hours=3)
        return start, end

    for index, current in enumerate(slots):
        current_start, current_end = interval(current)
        for other in slots[index + 1:]:
            other_start, other_end = interval(other)
            if current_start < other_end and other_start < current_end:
                raise HTTPException(409, "Two selected exams overlap")

    for slot in slots:
        slot.selected_count += 1
        db.add(DateSheetSelection(student_id=student_id, course_id=slot.course_id, slot_id=slot.id))
    student.date_sheet_saved = True
    db.commit()
    return {"message": "Date sheet saved and locked"}


@router.get("/{student_id}/requests")
def student_requests(student_id: int, db: Db):
    get_student(student_id, db)
    requests = db.scalars(select(StudentRequest).where(StudentRequest.student_id == student_id).order_by(StudentRequest.created_at.desc())).all()
    return [{"id": item.id, "type": item.request_type, "reason": item.reason, "status": item.status, "remark": item.remark, "created_at": item.created_at} for item in requests]


@router.post("/{student_id}/requests", status_code=status.HTTP_201_CREATED)
def raise_request(student_id: int, payload: RequestIn, db: Db):
    get_student(student_id, db)
    if payload.student_id != student_id:
        raise HTTPException(403, "Request student does not match the route")
    existing = db.scalar(select(StudentRequest).where(StudentRequest.student_id == student_id, StudentRequest.request_type == payload.request_type.value, StudentRequest.status == "pending"))
    if existing:
        raise HTTPException(409, "A request of this type is already pending")
    request = StudentRequest(student_id=student_id, request_type=payload.request_type.value, reason=payload.reason)
    db.add(request)
    db.commit()
    db.refresh(request)
    return request
