# ExamSlot

ExamSlot is a self-service exam date sheet system for a multi-branch virtual university. This branch contains the Admin Panel foundation and a FastAPI/PostgreSQL API designed to support the Student Panel next.

## Stack

- Frontend: React 19 + Vite
- Backend: FastAPI + SQLAlchemy 2
- Database: PostgreSQL 16 via `DATABASE_URL`.

## Run locally

1. Start PostgreSQL with Docker:

   ```bash
   docker compose up -d postgres
   ```

   This creates database `examslot`, user `postgres`, and password `postgres` on port `5432`.

   If PostgreSQL is already installed locally, create the database instead:

   ```bash
   createdb -h localhost -U postgres examslot
   ```

2. Copy `.env.example` to `.env`. The default URL is already configured for the Docker database:

   ```bash
   cp .env.example .env
   ```

   The connection format is `postgresql+psycopg://USER:PASSWORD@HOST:PORT/DATABASE`.

   When SMTP is configured, creating a student sends a single-use password setup link to the student email. For local development with `SMTP_HOST` empty, the API prints and returns `development_setup_url`; open that URL in the browser, set a password, and then log in with the student email and new password.

3. Install backend dependencies and start the API:

   ```bash
   python3 -m venv .venv
   . .venv/bin/activate
   pip install -r backend/requirements.txt
   uvicorn backend.main:app --reload
   ```

4. Start the React admin panel in a second terminal:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

The API docs are available at `http://localhost:8000/docs`.

To prepare a complete local student demo after the database exists:

```bash
python -m backend.seed
```

## Admin panel

The current panel includes overview metrics, branches, courses, students, course assignments, exam schedules, and student requests. Resource lists support server-shaped `search`, `page`, and `page_size` parameters. Create dialogs and row actions provide a working UI flow while the API is available for persistence.

The API enforces the important data rules already in this foundation:

- Branch and course codes, student emails, and registration numbers are unique.
- A branch with students is safely marked inactive instead of hard-deleted.
- Exam slots cannot be in the past, overlap their own start/end time, or duplicate a course/date/start combination.
- A student cannot submit two pending requests of the same type.

Assignments, authentication, password setup email, and student date-sheet locking are the next domain slice. They should use the existing relational models and API boundaries rather than browser-only state.

## Database shape

```text
Branch 1---* Student 1---* Assignment *---1 Course 1---* ExamSlot
Student 1---* StudentRequest
```

No credentials are committed. Change the development PostgreSQL password before sharing the application and use environment variables for database and email secrets.

Demo credentials seeded by `backend.seed`: `admin@examslot.local` / `Admin@12345` and `student@example.com` / `Student@12345`.

## Add another admin

Admin self-registration is intentionally disabled. A trusted existing operator or deployment administrator creates new admin accounts from the backend:

```bash
DATABASE_URL='postgresql+psycopg://postgres:postgres@localhost:5432/examslot' \
python -m backend.create_admin --email newadmin@example.com --name "New Admin"
```

The command prompts for the password twice, stores only a secure hash, and rejects duplicate email addresses. The new admin then signs in through the normal login page.

## Backend structure

```text
backend/
   core/          configuration and database session
   routers/       admin and student API routes
   models.py      SQLAlchemy relationships and constraints
   schemas.py     validated request payloads
   seed.py        local demo data
   main.py        FastAPI application assembly
```

The admin header opens the Student Panel for local testing. It uses the first student returned by the API. The student flow is backend-enforced: branch selection is one-time, exactly 4–6 assigned courses are required, selected slots must belong to those courses, overlapping times are rejected, and a saved date sheet is locked.
