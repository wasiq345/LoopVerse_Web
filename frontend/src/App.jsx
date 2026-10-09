import { useEffect, useMemo, useState } from 'react'
import './App.css'

const seedData = {
  branches: [
    { id: 1, name: 'Lahore Central', code: 'LHR-01', city: 'Lahore', address: '14 Davis Road', contact: '+92 42 111 555 019', status: 'Active' },
    { id: 2, name: 'Islamabad North', code: 'ISB-01', city: 'Islamabad', address: 'F-8 Markaz', contact: '+92 51 111 555 019', status: 'Active' },
    { id: 3, name: 'Karachi South', code: 'KHI-01', city: 'Karachi', address: 'Shahrah-e-Faisal', contact: '+92 21 111 555 019', status: 'Inactive' },
  ],
  courses: [
    { id: 1, code: 'CS-101', title: 'Introduction to Computing', department: 'Computer Science', credits: 3, status: 'Active' },
    { id: 2, code: 'MGT-201', title: 'Principles of Management', department: 'Management', credits: 3, status: 'Active' },
    { id: 3, code: 'ENG-301', title: 'Technical Writing', department: 'Humanities', credits: 3, status: 'Active' },
    { id: 4, code: 'STA-202', title: 'Applied Statistics', department: 'Mathematics', credits: 3, status: 'Active' },
  ],
  students: [
    { id: 1, name: 'Areeba Khan', registration: 'VU-24F-001', email: 'areeba.khan@example.com', program: 'BS Computer Science', semester: '4', courses: 6, status: 'Ready' },
    { id: 2, name: 'Hamza Ali', registration: 'VU-24F-002', email: 'hamza.ali@example.com', program: 'BS Business Administration', semester: '3', courses: 3, status: 'Incomplete' },
    { id: 3, name: 'Maham Raza', registration: 'VU-24F-003', email: 'maham.raza@example.com', program: 'BS Computer Science', semester: '4', courses: 5, status: 'Ready' },
  ],
  assignments: [
    { id: 1, student: 'Areeba Khan', registration: 'VU-24F-001', assigned: 6, state: 'Complete' },
    { id: 2, student: 'Hamza Ali', registration: 'VU-24F-002', assigned: 3, state: 'Incomplete' },
    { id: 3, student: 'Maham Raza', registration: 'VU-24F-003', assigned: 5, state: 'Complete' },
  ],
  schedules: [
    { id: 1, course: 'CS-101', title: 'Introduction to Computing', date: '2026-11-12', time: '09:00 - 12:00', seats: '120 / 150', status: 'Open' },
    { id: 2, course: 'MGT-201', title: 'Principles of Management', date: '2026-11-14', time: '14:00 - 17:00', seats: '98 / 150', status: 'Open' },
    { id: 3, course: 'STA-202', title: 'Applied Statistics', date: '2026-11-17', time: '09:00 - 12:00', seats: '150 / 150', status: 'Full' },
  ],
  requests: [
    { id: 1, student: 'Hamza Ali', type: 'Change date sheet', reason: 'Two papers overlap with a family commitment.', raised: 'Today, 09:42', status: 'Pending' },
    { id: 2, student: 'Maham Raza', type: 'Change branch', reason: 'Relocating to Islamabad for the exam window.', raised: 'Yesterday, 16:20', status: 'Approved' },
    { id: 3, student: 'Areeba Khan', type: 'Change date sheet', reason: 'Medical appointment on selected date.', raised: 'Oct 04, 11:08', status: 'Rejected' },
  ],
}

const navItems = [
  { id: 'overview', label: 'Overview', icon: '◌' }, { id: 'branches', label: 'Branches', icon: '⌂' },
  { id: 'courses', label: 'Courses', icon: '▦' }, { id: 'students', label: 'Students', icon: '♙' },
  { id: 'assignments', label: 'Assignments', icon: '✓' }, { id: 'schedules', label: 'Exam schedules', icon: '▣' },
  { id: 'requests', label: 'Requests', icon: '↗' },
]
const labels = { branches: 'Branches', courses: 'Courses', students: 'Students', assignments: 'Course assignments', schedules: 'Exam schedules', requests: 'Student requests' }
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

const apiResources = {
  branches: '/branches',
  courses: '/courses',
  students: '/students',
  schedules: '/schedules',
}

function normalizeRows(resource, items) {
  if (resource === 'branches') return items.map((item) => ({ ...item, status: item.active ? 'Active' : 'Inactive' }))
  if (resource === 'courses') return items.map((item) => ({ ...item, status: item.active ? 'Active' : 'Inactive' }))
  if (resource === 'students') return items.map((item) => ({ ...item, name: item.full_name, registration: item.registration_number, courses: 0, status: item.date_sheet_saved ? 'Ready' : 'Incomplete' }))
  if (resource === 'schedules') return items.map((item) => ({ ...item, course: item.code, title: item.title, date: item.exam_date, time: `${item.start_time}${item.end_time ? ` - ${item.end_time}` : ''}`, seats: `${item.selected_count} selected`, status: 'Open' }))
  return items
}

function Status({ children }) { return <span className={`status status-${children.toLowerCase().replaceAll(' ', '-')}`}>{children}</span> }

function App() {
  const [active, setActive] = useState('overview')
  const [data, setData] = useState(seedData)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [showModal, setShowModal] = useState(false)
  const [notice, setNotice] = useState('')
  const [apiConnected, setApiConnected] = useState(false)
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
    fetch(`${API_URL}${endpoint}?page=1&page_size=100`)
      .then((response) => { if (!response.ok) throw new Error('API request failed'); return response.json() })
      .then((result) => { setData((current) => ({ ...current, [active]: normalizeRows(active, result.items) })); setApiConnected(true) })
      .catch(() => setApiConnected(false))
  }, [active])
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
      fetch(`${API_URL}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not save record'); return response.json() })
        .then((saved) => { setData((current) => ({ ...current, [active]: [...(current[active] || []), ...normalizeRows(active, [saved])] })); setShowModal(false); announce(`${labels[active]} saved to database`) })
        .catch((error) => announce(error.message))
      return
    }
    setData((current) => ({ ...current, [active]: [...(current[active] || []), newRecord] }))
    setShowModal(false); announce(`${labels[active] || 'Record'} created successfully`)
  }

  function deleteStudent(row) {
    if (!window.confirm(`Delete ${row.name}? This cannot be undone.`)) return
    fetch(`${API_URL}/students/${row.id}`, { method: 'DELETE' })
      .then(async (response) => { if (!response.ok) throw new Error((await response.json()).detail || 'Could not delete student'); return response.json() })
      .then(() => { setData((current) => ({ ...current, students: current.students.filter((item) => item.id !== row.id) })); announce('Student deleted from database') })
      .catch((error) => announce(error.message))
  }

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><span className="brand-mark">E</span><span>Exam<span className="brand-accent">Slot</span></span></div><div className="workspace-label">ADMIN CONSOLE</div><nav>{navItems.map((item) => <button key={item.id} className={active === item.id ? 'nav-item active' : 'nav-item'} onClick={() => selectPage(item.id)}><span className="nav-icon">{item.icon}</span>{item.label}{item.id === 'requests' && <span className="nav-badge">1</span>}</button>)}</nav><div className="sidebar-bottom"><div className="support-card"><span className="support-icon">?</span><div><strong>Need a hand?</strong><small>Read the admin guide</small></div><span>↗</span></div><button className="nav-item"><span className="nav-icon">⚙</span>Settings</button></div></aside>
      <main className="main-content"><header className="topbar"><div className="breadcrumb"><span>Admin</span><span>/</span><strong>{active === 'overview' ? 'Overview' : labels[active]}</strong></div><div className="top-actions"><span className={`connection-state ${apiConnected ? 'online' : ''}`}>{apiConnected ? 'API connected' : 'Demo data'}</span><button className="icon-button" aria-label="Notifications">♢<span className="notification-dot" /></button><div className="profile"><div className="avatar">SA</div><div><strong>Sarah Ahmed</strong><small>Super admin</small></div><span className="chevron">⌄</span></div></div></header><div className="content-wrap">{notice && <div className="toast">✓ {notice}</div>}{active === 'overview' ? <Overview data={data} onNavigate={selectPage} /> : <ResourcePage active={active} rows={rows} allRows={currentRows} query={query} setQuery={(value) => { setQuery(value); setPage(1) }} page={page} totalPages={totalPages} setPage={setPage} onCreate={() => setShowModal(true)} onAction={announce} onDelete={deleteStudent} />}</div></main>
      {showModal && <Modal active={active} onClose={() => setShowModal(false)} onSubmit={createRecord} />}
    </div>
  )
}

function Overview({ data, onNavigate }) {
  const stats = [{ label: 'Total students', value: '1,248', change: '+12.5%', icon: '♙', tone: 'blue' }, { label: 'Active branches', value: '12', change: '+2 this month', icon: '⌂', tone: 'green' }, { label: 'Published courses', value: '86', change: '+8.2%', icon: '▦', tone: 'amber' }, { label: 'Pending requests', value: '18', change: 'Needs attention', icon: '↗', tone: 'rose' }]
  return <><section className="page-heading"><div><p className="eyebrow">Thursday, October 8, 2026</p><h1>Good morning, Sarah <span className="wave">✦</span></h1><p className="subheading">Here is what is happening across your exam operations today.</p></div><button className="button primary" onClick={() => onNavigate('students')}><span>＋</span> Add student</button></section><section className="stats-grid">{stats.map((stat) => <div className="stat-card" key={stat.label}><div className={`stat-icon ${stat.tone}`}>{stat.icon}</div><div><p>{stat.label}</p><strong>{stat.value}</strong><small className={stat.tone === 'rose' ? 'attention' : ''}>{stat.change}</small></div><span className="stat-spark">╱╲╱</span></div>)}</section><section className="dashboard-grid"><div className="panel activity-panel"><div className="panel-header"><div><h2>Exam readiness</h2><p>Student date sheet progress</p></div><button className="text-button" onClick={() => onNavigate('students')}>View students ↗</button></div><div className="progress-layout"><div className="donut"><div><strong>78%</strong><span>ready</span></div></div><div className="legend"><div><span className="legend-dot blue-dot" />Date sheet saved <strong>972</strong></div><div><span className="legend-dot light-dot" />In progress <strong>198</strong></div><div><span className="legend-dot pale-dot" />Not started <strong>78</strong></div></div></div><div className="mini-bars"><span style={{ height: '48%' }} /><span style={{ height: '64%' }} /><span style={{ height: '57%' }} /><span style={{ height: '75%' }} /><span style={{ height: '69%' }} /><span style={{ height: '86%' }} /><span style={{ height: '78%' }} /><span style={{ height: '94%' }} /></div></div><div className="panel request-panel"><div className="panel-header"><div><h2>Requests to review</h2><p>Latest student requests</p></div><button className="text-button" onClick={() => onNavigate('requests')}>View all ↗</button></div><div className="request-list">{data.requests.slice(0, 3).map((request) => <div className="request-row" key={request.id}><div className="request-avatar">{request.student.split(' ').map((name) => name[0]).join('')}</div><div className="request-info"><strong>{request.student}</strong><span>{request.type}</span></div><Status>{request.status}</Status></div>)}</div></div></section><section className="panel table-panel"><div className="panel-header"><div><h2>Upcoming exam schedules</h2><p>Published slots students can choose from</p></div><button className="text-button" onClick={() => onNavigate('schedules')}>Manage schedules ↗</button></div><table><thead><tr><th>COURSE</th><th>DATE</th><th>TIME</th><th>SEATS</th><th>STATUS</th></tr></thead><tbody>{data.schedules.map((schedule) => <tr key={schedule.id}><td><strong>{schedule.course}</strong><span>{schedule.title}</span></td><td>{schedule.date}</td><td>{schedule.time}</td><td>{schedule.seats}</td><td><Status>{schedule.status}</Status></td></tr>)}</tbody></table></section></>
}

function ResourcePage({ active, rows, allRows, query, setQuery, page, totalPages, setPage, onCreate, onAction, onDelete }) {
  const columns = { branches: ['Branch', 'Code', 'City', 'Contact', 'Status'], courses: ['Course', 'Department', 'Credits', 'Status'], students: ['Student', 'Registration no.', 'Program', 'Semester', 'Courses', 'Status'], assignments: ['Student', 'Registration no.', 'Assigned courses', 'Status'], schedules: ['Course', 'Date', 'Time', 'Seats', 'Status'], requests: ['Student', 'Request type', 'Reason', 'Raised', 'Status'] }[active]
  return <><section className="page-heading"><div><p className="eyebrow">Admin / {labels[active]}</p><h1>{labels[active]}</h1><p className="subheading">Manage and keep your {active} up to date.</p></div>{active !== 'assignments' && <button className="button primary" onClick={onCreate}><span>＋</span> Add {active === 'schedules' ? 'exam slot' : active.slice(0, -1)}</button>}</section><div className="toolbar"><div className="search-box"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${labels[active].toLowerCase()}...`} /></div><button className="filter-button">≡ <span>Filter</span></button><div className="view-toggle"><button className="selected">▤</button><button>▦</button></div></div><section className="panel table-panel resource-table"><div className="table-meta"><span>{allRows.length} {labels[active].toLowerCase()}</span><button className="export-button" onClick={() => onAction('Export prepared')}>⇩ Export</button></div><div className="scroll-table"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}<th /></tr></thead><tbody>{rows.map((row) => <ResourceRow key={row.id} active={active} row={row} onAction={onAction} onDelete={onDelete} />)}</tbody></table>{rows.length === 0 && <div className="empty-state">No records match your search.</div>}</div><div className="pagination"><span>Showing {allRows.length ? (page - 1) * 5 + 1 : 0}-{Math.min(page * 5, allRows.length)} of {allRows.length}</span><div><button disabled={page === 1} onClick={() => setPage(page - 1)}>‹</button>{Array.from({ length: totalPages }, (_, index) => <button className={page === index + 1 ? 'current' : ''} key={index} onClick={() => setPage(index + 1)}>{index + 1}</button>)}<button disabled={page === totalPages} onClick={() => setPage(page + 1)}>›</button></div></div></section></>
}

function ResourceRow({ active, row, onAction, onDelete }) {
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

  return <tr><td>{firstCell}</td>{cells}<td><button className="row-menu" aria-label="More actions" onClick={() => active === 'students' ? onDelete(row) : onAction('Record action completed')}>{active === 'students' ? 'Delete' : '•••'}</button></td></tr>
}

function Modal({ active, onClose, onSubmit }) {
  const title = active === 'schedules' ? 'Add exam slot' : `Add ${active.slice(0, -1)}`
  const fields = active === 'branches' ? [['name', 'Branch name'], ['code', 'Branch code'], ['city', 'City'], ['contact', 'Contact number'], ['address', 'Address']] : active === 'courses' ? [['code', 'Course code'], ['title', 'Course title'], ['department', 'Department'], ['credits', 'Credit hours']] : active === 'students' ? [['name', 'Full name'], ['email', 'Email address'], ['registration', 'Registration number'], ['program', 'Program or degree']] : [['course', 'Course code'], ['date', 'Exam date'], ['time', 'Start - end time']]
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="modal"><div className="modal-header"><div><p className="eyebrow">New record</p><h2>{title}</h2></div><button className="close-button" onClick={onClose}>×</button></div><form onSubmit={onSubmit}>{fields.map(([name, label]) => <label key={name}>{label}<input name={name} required placeholder={`Enter ${label.toLowerCase()}`} type={name === 'date' ? 'date' : name === 'email' ? 'email' : 'text'} /></label>)}<label>Status<select name="status" defaultValue="Active"><option>Active</option><option>Inactive</option></select></label><div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button type="submit" className="button primary">Create record</button></div></form></div></div>
}
export default App
