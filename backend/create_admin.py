import argparse
import getpass

from sqlalchemy import select

from backend.core.database import Base, SessionLocal, engine, upgrade_legacy_schema
from backend.core.security import hash_password
from backend.models import AdminUser


def main():
    parser = argparse.ArgumentParser(description="Create an ExamSlot admin account")
    parser.add_argument("--email", required=True)
    parser.add_argument("--name", required=True)
    args = parser.parse_args()
    password = getpass.getpass("Admin password: ")
    confirmation = getpass.getpass("Confirm password: ")
    if len(password) < 8 or password != confirmation:
        raise SystemExit("Password must be at least 8 characters and match confirmation")

    Base.metadata.create_all(engine)
    upgrade_legacy_schema()
    with SessionLocal() as db:
        if db.scalar(select(AdminUser).where(AdminUser.email == args.email.lower())):
            raise SystemExit("An admin with this email already exists")
        db.add(AdminUser(email=args.email.lower(), full_name=args.name, password_hash=hash_password(password)))
        db.commit()
    print(f"Admin created: {args.email.lower()}")


if __name__ == "__main__":
    main()
