import { useEffect, useMemo, useState } from 'react'
import './App.css'
import StudentPanel from './StudentPanel'
import Login from './Login'
import { apiFetch } from './api'
import SetupPassword from './SetupPassword'

const seedData = {
  branches: [], courses: [], students: [], assignments: [], schedules: [], requests: [],
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: '◌' }, { id: 'branches', label: 'Branches', icon: '⌂' },
  { id: 'courses', label: 'Courses', icon: '▦' }, { id: 'students', label: 'Students', icon: '♙' },
  { id: 'assignments', label: 'Assignments', icon: '✓' }, { id: 'schedules', label: 'Exam schedules', icon: '▣' },
  { id: 'requests', label: 'Requests', icon: '↗' },
]
const labels = { branches: 'Branches', courses: 'Courses', students: 'Students', assignments: 'Course assignments', schedules: 'Exam schedules', requests: 'Student requests' }
const apiResources = {
  branches: '/branches',
  courses: '/courses',
  students: '/students',
  schedules: '/schedules',
  requests: '/requests',
  assignments: '/admin/assignments',
}

function normalizeRows(resource, items) {
  if (resource === 'branches') return items.map((item) => ({ ...item, status: item.active ? 'Active' : 'Inactive' }))
  if (resource === 'courses') return items.map((item) => ({ ...item, status: item.active ? 'Active' : 'Inactive' }))
  if (resource === 'students') return items.map((item) => ({ ...item, name: item.full_name, registration: item.registration_number, courses: 0, status: item.date_sheet_saved ? 'Ready' : 'Incomplete' }))
  if (resource === 'assignments') return items.map((item) => ({ ...item, id: item.student_id, state: item.assigned >= 4 && item.assigned <= 6 ? 'Complete' : 'Incomplete' }))
  if (resource === 'schedules') return items.map((item) => ({ ...item, course: item.code, title: item.title, date: item.exam_date, time: `${item.start_time}${item.end_time ? ` - ${item.end_time}` : ''}`, seats: `${item.selected_count} selected`, status: 'Open' }))
  if (resource === 'requests') return items.map((item) => ({ ...item, type: item.type.replace('change_', 'Change ').replace('_', ' '), raised: new Date(item.raised).toLocaleString(), status: item.status[0].toUpperCase() + item.status.slice(1) }))
  return items
}

function Status({ children }) { return <span className={`status status-${children.toLowerCase().replaceAll(' ', '-')}`}>{children}</span> }

function App() {
  const [setupMode, setSetupMode] = useState(window.location.pathname === '/setup-password')
  const [authenticated, setAuthenticated] = useState(Boolean(sessionStorage.getItem('examslot_token')))
  const [active, setActive] = useState('overview')
  const [data, setData] = useState(seedData)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [notice, setNotice] = useState('')
  const [apiConnected, setApiConnected] = useState(false)
  const [dashboard, setDashboard] = useState({ students: 0, branches: 0, courses: 0, pending_requests: 0 })
  const [studentView, setStudentView] = useState(false)
  const [studentId, setStudentId] = useState(null)
  const [setupLink, setSetupLink] = useState('')
  const pageSize = 5
  const currentRows = useMemo(() => {
    if (!data[active]) return []
    const needle = query.toLowerCase()
    return data[active].filter((row) => Object.values(row).some((value) => String(value).toLowerCase().includes(needle)))
  }, [active, data, query])
  const totalPages = Math.max(1, Math.ceil(currentRows.length / pageSize))
  const rows = currentRows.slice((page - 1) * pageSize, page * pageSize)
  useEffect(() => {
    const endpoint = apiResources[active]
    if (!endpoint) return
    apiFetch(`${endpoint}?page=1&page_size=100`)
      .then((response) => { if (!response.ok) throw new Error('API request failed'); return response.json() })
      .then((result) => { const items = Array.isArray(result) ? result : result.items; setData((current) => ({ ...current, [active]: normalizeRows(active, items) })); setApiConnected(true) })
      .catch(() => setApiConnected(false))
  }, [active])
  useEffect(() => {
    if (!authenticated) return
    apiFetch('/dashboard')
      .then((response) => response.json())
      .then((result) => setDashboard(result))
      .catch(() => {})
  }, [active, authenticated])
  if (setupMode) return <SetupPassword onComplete={() => { window.history.replaceState({}, '', '/'); setSetupMode(false) }} />
  if (!authenticated) return <Login onLogin={(result) => { setStudentId(result.student_id || null); setStudentView(result.role === 'student'); setAuthenticated(true) }} />
  function selectPage(id) { setActive(id); setQuery(''); setPage(1) }
  function announce(message) { setNotice(message); window.setTimeout(() => setNotice(''), 2800) }
  function createRecord(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const newRecord = { id: Date.now(), ...Object.fromEntries(form.entries()) }
    const endpoint = apiResources[active]
    const payload = active === 'branches'
      ? { name: newRecord.name, code: newRecord.code, city: newRecord.city, address: newRecord.address, contact: newRecord.contact, active: newRecord.status === 'Active' }
      : active === 'courses'
        ? { code: newRecord.code, title: newRecord.title, department: newRecord.department, credits: Number(newRecord.credits), active: newRecord.status === 'Active' }
        : active === 'students'
          ? { full_name: newRecord.name, email: newRecord.email, registration_number: newRecord.registration, program: newRecord.program, semester: 1 }
          : { course_id: Number(newRecord.course), exam_date: newRecord.date, start_time: newRecord.time.split(' - ')[0], end_time: newRecord.time.split(' - ')[1] || null }
    if (endpoint) {
      apiFetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not save record'); return response.json() })
        .then((saved) => { setData((current) => ({ ...current, [active]: [...(current[active] || []), ...normalizeRows(active, [saved])] })); setSetupLink(saved.development_setup_url || ''); setShowModal(false); announce(`${labels[active]} saved to database`) })
        .catch((error) => announce(error.message))
      return
    }
    setData((current) => ({ ...current, [active]: [...(current[active] || []), newRecord] }))
    setShowModal(false); announce(`${labels[active] || 'Record'} created successfully`)
  }

  function deleteStudent(row) {
    const endpoint = active === 'students' ? `/students/${row.id}` : active === 'branches' ? `/branches/${row.id}` : active === 'courses' ? `/courses/${row.id}` : active === 'schedules' ? `/schedules/${row.id}` : active === 'assignments' ? `/admin/assignments/${row.student_id}/${row.course_id}` : null
    if (!endpoint) { announce('This record is managed through its review workflow'); return }
    if (!window.confirm(`Delete this ${active.slice(0, -1)}? This cannot be undone.`)) return
    apiFetch(endpoint, { method: 'DELETE' })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not delete student'); return response.json() })
      .then(() => { setData((current) => ({ ...current, [active]: current[active].filter((item) => item.id !== row.id) })); announce(`${labels[active]} record deleted`) })
      .catch((error) => announce(error.message))
  }

  if (studentView) return <StudentPanel studentId={studentId} onAdmin={() => { sessionStorage.clear(); window.location.reload() }} />

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>Exam<span className="brand-accent">Slot</span></span></div><div className="workspace-label">ADMIN CONSOLE</div><nav>{navItems.map((item) => <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => selectPage(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === 'requests' && <span className="nav-badge">1</span>}</button>)}</nav><div className="sidebar-bottom"><div className="support-card"><span className="support-icon">?</span><div><strong>Need a hand?</strong><small>Read the admin guide</small></div><span>↗</span></div><button className="nav-item"><span className="nav-icon">⚙</span>Settings</button></div></aside>
      <main className="main-content"><header className="topbar"><div className="breadcrumb"><span>Admin</span><span>/</span><strong>{active === 'overview' ? 'Overview' : labels[active]}</strong></div><div className="top-actions"><button className="switch-button" onClick={() => setStudentView(true)}>Student panel</button><span className={`connection-state ${apiConnected ? 'online' : ''}`}>{apiConnected ? 'API connected' : 'Demo data'}</span><button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button><button className="switch-button" onClick={() => { sessionStorage.clear(); window.location.reload() }}>Log out</button><div className="profile"><div className="avatar">SA</div><div><strong>Sarah Ahmed</strong><small>Super admin</small></div><span className="chevron">⌄</span></div></div></header><div className="content-wrap">{notice && <div className="toast">✓ {notice}</div>}{setupLink && <div className="setup-link-card"><strong>Student setup link ready</strong><a href={setupLink} target="_blank" rel="noreferrer">Open password setup page ↗</a><button onClick={() => setSetupLink('')}>×</button></div>}{active === 'overview' ? <Overview dashboard={dashboard} onNavigate={selectPage} /> : <ResourcePage active={active} rows={rows} allRows={currentRows} query={query} setQuery={(value) => { setQuery(value); setPage(1) }} page={page} totalPages={totalPages} setPage={setPage} onCreate={() => setShowModal(true)} onDelete={deleteStudent} />}</div></main>
      {showModal && <Modal active={active} onClose={() => setShowModal(false)} onSubmit={createRecord} />}
    </div>
  )
}

function Overview({ dashboard, onNavigate }) {
  const liveStats = [{ label: 'Total students', value: dashboard.students, change: 'From PostgreSQL', icon: '♙', tone: 'blue' }, { label: 'Active branches', value: dashboard.branches, change: 'From PostgreSQL', icon: '⌂', tone: 'green' }, { label: 'Published courses', value: dashboard.courses, change: 'From PostgreSQL', icon: '▦', tone: 'amber' }, { label: 'Pending requests', value: dashboard.pending_requests, change: dashboard.pending_requests ? 'Needs attention' : 'All clear', icon: '↗', tone: 'rose' }]
  return <><section className="page-heading"><div><p className="eyebrow">Thursday, October 8, 2026</p><h1>Good morning, Sarah <span className="wave">✦</span></h1><p className="subheading">Here is what is happening across your exam operations today.</p></div><button className="button primary" onClick={() => onNavigate('students')}><span>＋</span> Add student</button></section><section className="stats-grid">{liveStats.map((stat) => <div className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}>{stat.icon}</div><div><p>{stat.label}</p><strong>{stat.value}</strong><small className={stat.tone === 'rose' ? 'attention' : ''}>{stat.change}</small></div><span className="stat-spark">╱╲╱</span></div>)}</section><section className="dashboard-grid"><div className="panel activity-panel"><div className="panel-header"><div><h2>Exam readiness</h2><p>Student date sheet progress</p></div><button className="text-button" onClick={() => onNavigate('students')}>View students ↗</button></div><div className="progress-layout"><div className="donut"><div><strong>0%</strong><span>ready</span></div></div><div className="legend"><div><span className="legend-dot blue-dot" />Date sheet saved <strong>0</strong></div><div><span className="legend-dot light-dot" />In progress <strong>{dashboard.students}</strong></div><div><span className="legend-dot pale-dot" />Not started <strong>0</strong></div></div></div><div className="mini-bars" /></div><div className="panel request-panel"><div className="panel-header"><div><h2>Requests to review</h2><p>Latest student requests</p></div><button className="text-button" onClick={() => onNavigate('requests')}>View all ↗</button></div><div className="empty-state">{dashboard.pending_requests ? `${dashboard.pending_requests} request(s) need review.` : 'No requests yet.'}</div></div></section><section className="panel table-panel"><div className="panel-header"><div><h2>Upcoming exam schedules</h2><p>Published slots students can choose from</p></div><button className="text-button" onClick={() => onNavigate('schedules')}>Manage schedules ↗</button></div><div className="empty-state">Create courses and exam slots to see the schedule here.</div></section></>
}

function ResourcePage({ active, rows, allRows, query, setQuery, page, totalPages, setPage, onCreate, onDelete }) {
  const columns = { branches: ['Branch', 'Code', 'City', 'Contact', 'Status'], courses: ['Course', 'Department', 'Credits', 'Status'], students: ['Student', 'Registration no.', 'Program', 'Semester', 'Courses', 'Status'], assignments: ['Student', 'Registration no.', 'Assigned courses', 'Status'], schedules: ['Course', 'Date', 'Time', 'Seats', 'Status'], requests: ['Student', 'Request type', 'Reason', 'Raised', 'Status'] }[active]
  return <><section className="page-heading"><div><p className="eyebrow">Admin / {labels[active]}</p><h1>{labels[active]}</h1><p className="subheading">Manage and keep your {active} up to date.</p></div>{active !== 'assignments' && <button className="button primary" onClick={onCreate}><span>＋</span> Add {active === 'schedules' ? 'exam slot' : active.slice(0, -1)}</button>}</section><div className="toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${labels[active].toLowerCase()}...`} /></div><button className="filter-button">≡ <span>Filter</span></button><div className="view-toggle"><button className="selected">▤</button><button>▦</button></div></div><section className="panel table-panel resource-table"><div className="table-meta"><span>{allRows.length} {labels[active].toLowerCase()}</span><button className="export-button">⇩ Export</button></div><div className="scroll-table"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th /></tr></thead><tbody>{rows.map((row) => <ResourceRow key={row.id} active={active} row={row} onDelete={onDelete} />)}</tbody></table>{rows.length === 0 && <div className="empty-state">No records match your search.</div>}</div><div className="pagination"><span>Showing {allRows.length ? (page - 1) * 5 + 1 : 0}-{Math.min(page * 5, allRows.length)} of {allRows.length}</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => <button className={page === index + 1 ? 'current' : ''} key={index} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button></div></div></section></>
}

function ResourceRow({ active, row, onDelete }) {
  let firstCell
  if (active === 'students') firstCell = <div className="person"><div className="mini-avatar">{row.name.split(' ').map((name) => name[0]).join('')}</div><div><strong>{row.name}</strong><span>{row.email}</span></div></div>
  else if (active === 'branches') firstCell = <><strong>{row.name}</strong><span>{row.address}</span></>
  else if (active === 'courses') firstCell = <><strong>{row.code}</strong><span>{row.title}</span></>
  else if (active === 'assignments') firstCell = <><strong>{row.student}</strong><span>{row.assigned} courses assigned</span></>
  else if (active === 'schedules') firstCell = <><strong>{row.course}</strong><span>{row.title}</span></>
  else firstCell = <><strong>{row.student}</strong><span>{row.type}</span></>

  let cells
  if (active === 'branches') cells = <><td><code>{row.code}</code></td><td>{row.city}</td><td>{row.contact}</td><td><Status>{row.status}</Status></td></>
  else if (active === 'courses') cells = <><td>{row.department}</td><td>{row.credits} credit hours</td><td><Status>{row.status}</Status></td></>
  else if (active === 'students') cells = <><td><code>{row.registration}</code></td><td>{row.program}</td><td>{row.semester}</td><td>{row.courses}/6</td><td><Status>{row.status}</Status></td></>
  else if (active === 'assignments') cells = <><td><code>{row.registration}</code></td><td>{row.assigned}/6 courses</td><td><Status>{row.state}</Status></td></>
  else if (active === 'schedules') cells = <><td>{row.date}</td><td>{row.time}</td><td>{row.seats}</td><td><Status>{row.status}</Status></td></>
  else cells = <><td className="reason-cell">{row.reason}</td><td>{row.raised}</td><td><Status>{row.status}</Status></td></>

  return <tr><td>{firstCell}</td>{cells}<td><button className="row-menu" aria-label="Delete record" onClick={() => onDelete(row)}>{active === 'requests' ? '•••' : 'Delete'}</button></td></tr>
}

function Modal({ active, onClose, onSubmit }) {
  const title = active === 'schedules' ? 'Add exam slot' : `Add ${active.slice(0, -1)}`
  const fields = active === 'branches' ? [['name', 'Branch name'], ['code', 'Branch code'], ['city', 'City'], ['contact', 'Contact number'], ['address', 'Address']] : active === 'courses' ? [['code', 'Course code'], ['title', 'Course title'], ['department', 'Department'], ['credits', 'Credit hours']] : active === 'students' ? [['name', 'Full name'], ['email', 'Email address'], ['registration', 'Registration number'], ['program', 'Program or degree']] : [['course', 'Course code'], ['date', 'Exam date'], ['time', 'Start - end time']]
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><div className="modal-header"><div><p className="eyebrow">New record</p><h2>{title}</h2></div><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={onSubmit}>{fields.map(([name, label]) => <label key={name}>{label}<input name={name} required placeholder={`Enter ${label.toLowerCase()}`} type={name === 'date' ? 'date' : name === 'email' ? 'email' : 'text'} /></label>)}<label>Status<select name="status" defaultValue="Active"><option>Active</option><option>Inactive</option></select></label><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">Create record</button></div></form></div></div>
}
export default App
