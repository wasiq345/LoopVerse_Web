import { useState } from 'react'
import { API_URL } from './api'

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('admin@examslot.local')
  const [password, setPassword] = useState('Admin@12345')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function submit(event) {
    event.preventDefault()
    setLoading(true)
    fetch(`${API_URL}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Login failed'); return response.json() })
      .then((result) => { sessionStorage.setItem('examslot_token', result.access_token); sessionStorage.setItem('examslot_role', result.role); onLogin(result) })
      .catch((reason) => setError(reason.message))
      .finally(() => setLoading(false))
  }

  return <main className="login-shell"><section className="login-brand"><div className="student-brand"><span className="brand-mark">E</span><span>Exam<span className="brand-accent">Slot</span></span></div><p>Self-service exam scheduling for every branch.</p><span className="login-rule" /></section><form className="login-form" onSubmit={submit}><p className="eyebrow">Secure portal access</p><h1>Welcome back</h1><p className="subheading">Sign in to continue to your workspace.</p><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <div className="login-error">{error}</div>}<button className="button primary" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'} <span>→</span></button><small>Demo admin: admin@examslot.local / Admin@12345</small></form></main>
}
