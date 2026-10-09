from datetime import date, time, timedelta

from sqlalchemy import select

from backend.core.database import Base, SessionLocal, engine, upgrade_legacy_schema
from backend.core.security import hash_password
from backend.models import AdminUser, Assignment, Branch, Course, ExamSlot, Student


def seed():
    Base.metadata.create_all(engine)
    upgrade_legacy_schema()
    db = SessionLocal()
    try:
        branches = [
            Branch(name="Lahore Central", code="LHR-01", city="Lahore", address="14 Davis Road", contact="+92 42 111 555 019"),
            Branch(name="Islamabad North", code="ISB-01", city="Islamabad", address="F-8 Markaz", contact="+92 51 111 555 019"),
            Branch(name="Karachi South", code="KHI-01", city="Karachi", address="Shahrah-e-Faisal", contact="+92 21 111 555 019"),
        ]
        for branch in branches:
            if not db.scalar(select(Branch).where(Branch.code == branch.code)):
                db.add(branch)
        db.flush()
        courses_data = [("CS-101", "Introduction to Computing", "Computer Science"), ("MGT-201", "Principles of Management", "Management"), ("ENG-301", "Technical Writing", "Humanities"), ("STA-202", "Applied Statistics", "Mathematics")]
        courses = []
        for code, title, department in courses_data:
            course = db.scalar(select(Course).where(Course.code == code))
            if not course:
                course = Course(code=code, title=title, department=department, credits=3)
                db.add(course)
                db.flush()
            courses.append(course)
        student = db.scalar(select(Student).order_by(Student.id))
        if not student:
            student = Student(full_name="Demo Student", email="student@example.com", registration_number="VU-DEMO-001", program="BS Computer Science", semester=4)
            db.add(student)
            db.flush()
        if not student.password_hash:
            student.password_hash = hash_password("Student@12345")
        admin = db.scalar(select(AdminUser).where(AdminUser.email == "admin@examslot.local"))
        if not admin:
            db.add(AdminUser(email="admin@examslot.local", full_name="Sarah Ahmed", password_hash=hash_password("Admin@12345")))
        exam_day = date.today() + timedelta(days=30)
        for index, course in enumerate(courses):
            if not db.scalar(select(Assignment).where(Assignment.student_id == student.id, Assignment.course_id == course.id)):
                db.add(Assignment(student_id=student.id, course_id=course.id))
            if not db.scalar(select(ExamSlot).where(ExamSlot.course_id == course.id, ExamSlot.exam_date == exam_day)):
                db.add(ExamSlot(course_id=course.id, exam_date=exam_day + timedelta(days=index), start_time=time(9, 0), end_time=time(12, 0)))
        db.commit()
        print(f"Seeded student portal data for student id {student.id}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
