from datetime import date, datetime, time
from enum import Enum
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, String, Time, create_engine, func, or_, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, relationship, sessionmaker


class Settings(BaseSettings):
    database_url: str = "sqlite:///./exam_slot.db"
    frontend_url: str = "http://localhost:5173,http://127.0.0.1:5173"
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    pass


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


class ExamSlot(Base):
    __tablename__ = "exam_slots"
    id: Mapped[int] = mapped_column(primary_key=True)
    course_id: Mapped[int] = mapped_column(ForeignKey("courses.id"))
    exam_date: Mapped[date] = mapped_column(Date)
    start_time: Mapped[time] = mapped_column(Time)
    end_time: Mapped[time | None] = mapped_column(Time, nullable=True)
    selected_count: Mapped[int] = mapped_column(Integer, default=0)
    course: Mapped[Course] = relationship(back_populates="slots")


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


Base.metadata.create_all(engine)


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


class Page(BaseModel):
    items: list[dict]
    page: int
    page_size: int
    total: int
    pages: int


app = FastAPI(title="ExamSlot API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_url.split(",")],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


Db = Annotated[Session, Depends(get_db)]


def page_result(query, db: Session, page: int, page_size: int) -> Page:
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    items = [dict(item) for item in db.execute(query.offset((page - 1) * page_size).limit(page_size)).mappings().all()]
    return Page(items=items, page=page, page_size=page_size, total=total, pages=max(1, (total + page_size - 1) // page_size))


def paging(page: int = Query(1, ge=1), page_size: int = Query(10, ge=1, le=100)) -> tuple[int, int]:
    return page, page_size


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "database": settings.database_url.split(":", 1)[0]}


@app.get("/api/dashboard")
def dashboard(db: Db) -> dict[str, int]:
    return {"students": db.scalar(select(func.count(Student.id))) or 0, "branches": db.scalar(select(func.count(Branch.id)).where(Branch.active.is_(True))) or 0, "courses": db.scalar(select(func.count(Course.id)).where(Course.active.is_(True))) or 0, "pending_requests": db.scalar(select(func.count(StudentRequest.id)).where(StudentRequest.status == "pending")) or 0}


@app.get("/api/branches", response_model=Page)
def list_branches(db: Db, paging_params: Annotated[tuple[int, int], Depends(paging)], search: str = ""):
    page, page_size = paging_params
    needle = f"%{search.strip()}%"
    query = select(Branch.id, Branch.name, Branch.code, Branch.city, Branch.address, Branch.contact, Branch.active).where(or_(Branch.name.ilike(needle), Branch.code.ilike(needle), Branch.city.ilike(needle))).order_by(Branch.name)
    return page_result(query, db, page, page_size)


@app.post("/api/branches", status_code=status.HTTP_201_CREATED)
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


@app.delete("/api/branches/{branch_id}")
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


@app.get("/api/courses", response_model=Page)
def list_courses(db: Db, paging_params: Annotated[tuple[int, int], Depends(paging)], search: str = ""):
    page, page_size = paging_params
    needle = f"%{search.strip()}%"
    query = select(Course.id, Course.code, Course.title, Course.department, Course.credits, Course.active).where(or_(Course.code.ilike(needle), Course.title.ilike(needle), Course.department.ilike(needle))).order_by(Course.code)
    return page_result(query, db, page, page_size)


@app.post("/api/courses", status_code=status.HTTP_201_CREATED)
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


@app.get("/api/students", response_model=Page)
def list_students(db: Db, paging_params: Annotated[tuple[int, int], Depends(paging)], search: str = ""):
    page, page_size = paging_params
    needle = f"%{search.strip()}%"
    query = select(Student.id, Student.full_name, Student.email, Student.registration_number, Student.program, Student.semester, Student.date_sheet_saved).where(or_(Student.full_name.ilike(needle), Student.email.ilike(needle), Student.registration_number.ilike(needle))).order_by(Student.full_name)
    return page_result(query, db, page, page_size)


@app.post("/api/students", status_code=status.HTTP_201_CREATED)
def create_student(payload: StudentIn, db: Db):
    student = Student(**payload.model_dump())
    db.add(student)
    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(409, "Student email or registration number already exists")
    db.refresh(student)
    return student


@app.delete("/api/students/{student_id}")
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


@app.get("/api/schedules", response_model=Page)
def list_schedules(db: Db, paging_params: Annotated[tuple[int, int], Depends(paging)], search: str = ""):
    page, page_size = paging_params
    needle = f"%{search.strip()}%"
    query = select(ExamSlot.id, Course.code, Course.title, ExamSlot.exam_date, ExamSlot.start_time, ExamSlot.end_time, ExamSlot.selected_count).join(Course).where(or_(Course.code.ilike(needle), Course.title.ilike(needle))).order_by(ExamSlot.exam_date, ExamSlot.start_time)
    return page_result(query, db, page, page_size)


@app.post("/api/schedules", status_code=status.HTTP_201_CREATED)
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


@app.post("/api/requests", status_code=status.HTTP_201_CREATED)
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
