from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.core.config import settings
from backend.core.database import Base, engine, upgrade_legacy_schema
from backend.routers import admin, admin_actions, assignments, auth, student

from backend import models  # noqa: F401, E402

Base.metadata.create_all(engine)
upgrade_legacy_schema()

app = FastAPI(title="ExamSlot API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_url.split(",")],
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1|0\.0\.0\.0|10\.\d+\.\d+\.\d+)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "database": settings.database_url.split(":", 1)[0]}


app.include_router(admin.router)
app.include_router(student.router)
app.include_router(auth.router)
app.include_router(assignments.router)
app.include_router(admin_actions.router)
