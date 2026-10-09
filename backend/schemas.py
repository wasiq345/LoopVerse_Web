from datetime import date, time
from pydantic import BaseModel, Field, field_validator

from backend.models import RequestType


class BranchIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    code: str = Field(min_length=2, max_length=30)
    city: str
    address: str
    contact: str
    active: bool = True


class CourseIn(BaseModel):
    code: str = Field(min_length=2, max_length=30)
    title: str
    department: str
    credits: int = Field(ge=1, le=12)
    active: bool = True


class StudentIn(BaseModel):
    full_name: str
    email: str
    registration_number: str
    phone: str = ""
    program: str
    semester: int = Field(ge=1, le=20)


class SlotIn(BaseModel):
    course_id: int
    exam_date: date
    start_time: time
    end_time: time | None = None

    @field_validator("exam_date")
    @classmethod
    def date_is_future(cls, value: date) -> date:
        if value < date.today():
            raise ValueError("Exam slots cannot be in the past")
        return value

    @field_validator("end_time")
    @classmethod
    def end_after_start(cls, value: time | None, info) -> time | None:
        start = info.data.get("start_time")
        if value and start and value <= start:
            raise ValueError("End time must be after start time")
        return value


class RequestIn(BaseModel):
    student_id: int
    request_type: RequestType
    reason: str = Field(min_length=10, max_length=1000)


class BranchChoice(BaseModel):
    branch_id: int


class SlotChoice(BaseModel):
    course_id: int
    slot_id: int


class DateSheetIn(BaseModel):
    selections: list[SlotChoice] = Field(min_length=1)
