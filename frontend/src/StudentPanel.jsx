import { useEffect, useState } from 'react'
import './StudentPanel.css'
import { apiFetch } from './api'

export default function StudentPanel({ onAdmin, studentId: initialStudentId = null }) {
  const [portal, setPortal] = useState(null)
  const [selectedBranch, setSelectedBranch] = useState('')
  const [selectedSlots, setSelectedSlots] = useState({})
  const [requestType, setRequestType] = useState('change_date_sheet')
  const [reason, setReason] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(true)
  const [studentId, setStudentId] = useState(initialStudentId)

  function loadPortal() {
    const studentLookup = studentId ? Promise.resolve(studentId) : apiFetch('/students?page=1&page_size=1').then((response) => response.json()).then((students) => { const id = students.items[0]?.id; if (!id) throw new Error('Create a student from the admin panel first.'); setStudentId(id); return id })
    studentLookup.then((id) => apiFetch(`/student/${id}/portal`))
      .then((response) => response.json())
      .then((result) => { setPortal(result); setSelectedBranch(result.student.branch?.id || ''); setSelectedSlots(Object.fromEntries(result.selections.map((item) => [item.course_id, item.slot_id]))) })
      .catch(() => setNotice('Start the FastAPI server to load your portal.'))
      .finally(() => setLoading(false))
  }
  useEffect(loadPortal, [studentId])

  function announce(message) { setNotice(message); window.setTimeout(() => setNotice(''), 3000) }
  function chooseBranch() {
    apiFetch(`/student/${studentId}/branch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ branch_id: Number(selectedBranch) }) })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not select branch'); return response.json() })
      .then(() => { announce('Branch selected. This choice is now locked.'); loadPortal() }).catch((error) => announce(error.message))
  }
  function saveDateSheet() {
    apiFetch(`/student/${studentId}/date-sheet`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ selections: Object.entries(selectedSlots).map(([course_id, slot_id]) => ({ course_id: Number(course_id), slot_id: Number(slot_id) })) }) })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not save date sheet'); return response.json() })
      .then(() => { announce('Date sheet saved and locked.'); loadPortal() }).catch((error) => announce(error.message))
  }
  function submitRequest(event) {
    event.preventDefault()
    apiFetch(`/student/${studentId}/requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ student_id: studentId, request_type: requestType, reason }) })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not submit request'); return response.json() })
      .then(() => { setReason(''); announce('Request submitted for admin review.') }).catch((error) => announce(error.message))
  }

  if (loading && !portal) return <div className="student-loading">Loading student portal...</div>
  if (!portal) return <div className="student-loading">{notice}</div>
  const { student, branches, courses } = portal
  const hasAllSelections = courses.length > 0 && courses.every((course) => selectedSlots[course.course_id])

  return <div className="student-shell">
    <header className="student-topbar"><div className="student-brand"><span className="brand-mark">E</span><span>Exam<span className="brand-accent">Slot</span></span></div><div className="student-top-actions"><span>Student portal</span><button className="student-avatar">{student.name.split(' ').map((name) => name[0]).join('')}</button><button className="switch-button" onClick={onAdmin}>Log out</button></div></header>
    <main className="student-content"><div className="student-welcome"><div><p className="eyebrow">Student portal</p><h1>Welcome back, {student.name.split(' ')[0]}</h1><p className="subheading">Build your exam date sheet one choice at a time.</p></div><span className="student-status">● Account active</span></div>
      {notice && <div className="student-notice">{notice}</div>}
      {!student.branch && <section className="student-card branch-card"><div className="student-card-heading"><div><span className="step-number">01</span><div><h2>Choose your exam branch</h2><p>This can only be selected once unless an admin approves a change request.</p></div></div><span className="locked-label">Required</span></div><div className="branch-options">{branches.map((branch) => <label className={String(selectedBranch) === String(branch.id) ? 'branch-option selected' : 'branch-option'} key={branch.id}><input type="radio" name="branch" value={branch.id} checked={String(selectedBranch) === String(branch.id)} onChange={(event) => setSelectedBranch(event.target.value)} /><span><strong>{branch.name}</strong><small>{branch.code} · {branch.city} · {branch.address}</small></span><b>›</b></label>)}</div><button className="student-button" disabled={!selectedBranch} onClick={chooseBranch}>Confirm branch <span>→</span></button></section>}
      <section className="student-layout"><div className="student-main-column"><section className="student-card profile-card"><div className="student-card-heading"><div><h2>Your information</h2><p>Read-only profile information</p></div><span className="verified-label">Verified</span></div><div className="profile-grid"><div><small>Full name</small><strong>{student.name}</strong></div><div><small>Registration number</small><strong>{student.registration}</strong></div><div><small>Program</small><strong>{student.program}</strong></div><div><small>Semester</small><strong>Semester {student.semester}</strong></div><div><small>Selected branch</small><strong>{student.branch?.name || 'Select a branch above'}</strong></div><div><small>Email</small><strong>{student.email}</strong></div></div></section>
      <section className="student-card date-sheet-card"><div className="student-card-heading"><div><span className="step-number">02</span><div><h2>Design your date sheet</h2><p>Select one available slot for every assigned course.</p></div></div>{student.date_sheet_saved && <span className="locked-label">Locked</span>}</div>{courses.length === 0 ? <div className="student-empty">No courses have been assigned yet. Please contact the administration.</div> : <div className="course-list">{courses.map((course) => <div className="course-choice" key={course.course_id}><div className="course-title"><strong>{course.code}</strong><span>{course.title}</span></div><select disabled={student.date_sheet_saved || !student.branch} value={selectedSlots[course.course_id] || ''} onChange={(event) => setSelectedSlots((current) => ({ ...current, [course.course_id]: event.target.value }))}><option value="">Choose date and time</option>{course.slots.map((slot) => <option value={slot.id} key={slot.id}>{slot.date} · {slot.start_time}{slot.end_time ? ` - ${slot.end_time}` : ''}</option>)}</select></div>)}</div>}{courses.length > 0 && !student.date_sheet_saved && <button className="student-button" disabled={!student.branch || !hasAllSelections} onClick={saveDateSheet}>Save date sheet <span>→</span></button>}{student.date_sheet_saved && <div className="saved-message">✓ Your date sheet is saved. Changes require an approved admin request.</div>}</section></div>
      <aside className="student-side-column"><section className="student-card help-card"><div className="help-icon">?</div><h2>Need help?</h2><p>Request a one-time change to your branch or date sheet. An admin will review it.</p><form onSubmit={submitRequest}><select value={requestType} onChange={(event) => setRequestType(event.target.value)}><option value="change_date_sheet">Change date sheet</option><option value="change_branch">Change branch</option></select><textarea required minLength="10" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Tell us what happened..." /><button className="outline-button">Submit request</button></form></section><section className="student-card journey-card"><h2>Your journey</h2><div className={student.branch ? 'journey-step complete' : 'journey-step current'}><span>✓</span><div><strong>Choose a branch</strong><small>{student.branch ? 'Completed' : 'Your next step'}</small></div></div><div className={student.date_sheet_saved ? 'journey-step complete' : 'journey-step current'}><span>02</span><div><strong>Build date sheet</strong><small>{student.date_sheet_saved ? 'Completed' : 'Choose your slots'}</small></div></div><div className="journey-step"><span>03</span><div><strong>Print and prepare</strong><small>Available after saving</small></div></div></section></aside></section>
    </main>
  </div>
}
