from datetime import date, datetime, time
from enum import Enum

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Time, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.core.database import Base


class Branch(Base):
    __tablename__ = "branches"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    city: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(240))
    contact: Mapped[str] = mapped_column(String(40))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    students: Mapped[list["Student"]] = relationship(back_populates="branch")


class Course(Base):
    __tablename__ = "courses"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160))
    department: Mapped[str] = mapped_column(String(100))
    credits: Mapped[int] = mapped_column(Integer)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    slots: Mapped[list["ExamSlot"]] = relationship(back_populates="course")


class Student(Base):
    __tablename__ = "students"
    id: Mapped[int] = mapped_column(primary_key=True)
    full_name: Mapped[str] = mapped_column(String(160))
    email: Mapped[str] = mapped_column(String(160), unique=True, index=True)
    registration_number: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    phone: Mapped[str] = mapped_column(String(40), default="")
    program: Mapped[str] = mapped_column(String(120))
    semester: Mapped[int] = mapped_column(Integer)
    branch_id: Mapped[int | None] = mapped_column(ForeignKey("branches.id"), nullable=True)
    branch: Mapped[Branch | None] = relationship(back_populates="students")
    assignments: Mapped[list["Assignment"]] = relationship(cascade="all, delete-orphan")
    date_sheet_saved: Mapped[bool] = mapped_column(Boolean, default=False)


class Assignment(Base):
    __tablename__ = "assignments"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    course: Mapped[Course] = relationship()
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_student_course"),)


class ExamSlot(Base):
    __tablename__ = "exam_slots"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    exam_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    selected_count: Mapped[int] = mapped_column(Integer, default=0)
    course: Mapped[Course] = relationship(back_populates="slots")


class DateSheetSelection(Base):
    __tablename__ = "date_sheet_selections"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    slot_id: Mapped[int] = mapped_column(ForeignKey("exam_slots.id"))
    slot: Mapped[ExamSlot] = relationship()
    __table_args__ = (UniqueConstraint("student_id", "course_id", name="uq_sheet_student_course"),)


class RequestType(str, Enum):
    branch = "change_branch"
    date_sheet = "change_date_sheet"


class StudentRequest(Base):
    __tablename__ = "student_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    student_id: Mapped[int] = mapped_column(ForeignKey("students.id"))
    request_type: Mapped[str] = mapped_column(String(40))
    reason: Mapped[str] = mapped_column(String(1000))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    remark: Mapped[str] = mapped_column(String(1000), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
