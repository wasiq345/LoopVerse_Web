import { useState } from 'react'
import { API_URL } from './api'

export default function SetupPassword({ onComplete }) {
  const params = new URLSearchParams(window.location.search)
  const studentId = params.get('student_id')
  const token = params.get('token')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  function submit(event) {
    event.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    fetch(`${API_URL}/auth/student/${studentId}/setup-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Setup link is invalid'); return response.json() })
      .then(() => setDone(true)).catch((reason) => setError(reason.message))
  }

  if (done) return <main className="login-shell"><form className="login-form"><p className="eyebrow">Account ready</p><h1>Password saved</h1><p className="subheading">Your student account is ready. You can now sign in.</p><button type="button" className="button primary" onClick={onComplete}>Go to login <span>→</span></button></form></main>
  return <main className="login-shell"><section className="login-brand"><div className="student-brand"><span className="brand-mark">E</span><span>Exam<span className="brand-accent">Slot</span></span></div><p>Set a secure password for your student portal account.</p></section><form className="login-form" onSubmit={submit}><p className="eyebrow">Student onboarding</p><h1>Set your password</h1><p className="subheading">This secure link can only be used once.</p><label>New password<input type="password" minLength="8" value={password} onChange={(event) => setPassword(event.target.value)} required /></label><label>Confirm password<input type="password" minLength="8" value={confirm} onChange={(event) => setConfirm(event.target.value)} required /></label>{error && <div className="login-error">{error}</div>}<button className="button primary">Save password <span>→</span></button></form></main>
}
