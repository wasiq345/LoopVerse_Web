import smtplib
from email.message import EmailMessage

from backend.core.config import settings


def send_password_setup_email(recipient: str, full_name: str, setup_url: str) -> bool:
    message = EmailMessage()
    message["Subject"] = "Set up your ExamSlot student account"
    message["From"] = settings.smtp_from
    message["To"] = recipient
    message.set_content(
        f"Hello {full_name},\n\nYour ExamSlot account has been created. "
        f"Set your password using this single-use link (valid for 24 hours):\n\n{setup_url}\n\n"
        "If you did not expect this email, contact the university administration."
    )
    if not settings.smtp_host:
        print(f"Student password setup link for {recipient}: {setup_url}")
        return False
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        smtp.starttls()
        smtp.login(settings.smtp_user, settings.smtp_password)
        smtp.send_message(message)
    return True
