import { useCallback, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
  ChevronDown,
  Globe2,
  Layers3,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Plus,
  Search,
  Settings,
  Sparkles,
  X,
} from 'lucide-react'
import './App.css'
import { AnalyticsCharts } from './AnalyticsCharts'
import { projects as initialProjects, type Project } from './data'
import { MapPanel } from './MapPanel'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

const SESSION_KEY = 'darukaa.session'

function LoginScreen({ onEnter }: { onEnter: (name: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('Maya Chen')
  const [email, setEmail] = useState('admin@darukaa.earth')
  const [password, setPassword] = useState('darukaa-demo')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    const api = import.meta.env.VITE_API_URL as string | undefined
    try {
      if (api) {
        const path = mode === 'login' ? '/auth/login' : '/auth/register'
        const body = mode === 'login' ? { email, password } : { name, email, password }
        const response = await fetch(`${api}${path}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        if (!response.ok) throw new Error('Authentication failed')
        const data = await response.json()
        localStorage.setItem(SESSION_KEY, JSON.stringify(data))
        onEnter(data.user.name)
        return
      }
      if (email === 'admin@darukaa.earth' && password === 'darukaa-demo') {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ user: { name, email } }))
        onEnter(name)
        return
      }
      throw new Error('Use admin@darukaa.earth / darukaa-demo in demo mode')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand-mark">
          <Globe2 size={18} />
        </div>
        <span className="eyebrow">Administrator access</span>
        <h1>Earth intelligence.</h1>
        <p>Sign in to monitor carbon and biodiversity landscapes.</p>
        {mode === 'register' && (
          <label>
            Name
            <input value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p className="form-error">{error}</p>}
        <button className="primary" disabled={pending} type="submit">
          {pending ? 'Authenticating…' : mode === 'login' ? 'Enter workspace' : 'Create account'}
        </button>
        <button
          className="text-link"
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        >
          {mode === 'login' ? 'Need an account? Register' : 'Already registered? Sign in'}
        </button>
      </form>
    </div>
  )
}

function Sidebar({
  open,
  close,
  userName,
  onLogout,
}: {
  open: boolean
  close: () => void
  userName: string
  onLogout: () => void
}) {
  const items = [
    [LayoutDashboard, 'Overview'],
    [Layers3, 'Projects'],
    [Map, 'Sites'],
    [BarChart3, 'Analytics'],
  ] as const
  return (
    <aside className={`sidebar ${open ? 'is-open' : ''}`}>
      <div className="brand">
        <div className="brand-mark">
          <Globe2 size={18} />
        </div>
        <span>
          DARUKAA<span>.EARTH</span>
        </span>
        <button className="mobile-close" onClick={close} aria-label="Close menu">
          <X />
        </button>
      </div>
      <nav>
        <span className="nav-label">Workspace</span>
        {items.map(([Icon, label], index) => (
          <button className={index === 0 ? 'active' : ''} key={label}>
            <Icon size={17} strokeWidth={1.8} /> {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button>
          <Settings size={17} /> Settings
        </button>
        <div className="profile">
          <div className="avatar">{userName.slice(0, 2).toUpperCase()}</div>
          <div>
            <strong>{userName}</strong>
            <span>Administrator</span>
          </div>
          <button className="icon-button" onClick={onLogout} aria-label="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}

function Metric({
  label,
  value,
  suffix,
  trend,
}: {
  label: string
  value: string
  suffix?: string
  trend?: string
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>
        {value}
        <small>{suffix}</small>
      </strong>
      {trend && (
        <em>
          <ArrowUpRight size={12} /> {trend}
        </em>
      )}
    </div>
  )
}

function Detail({ project, back }: { project: Project; back: () => void }) {
  return (
    <div className="detail-view">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={16} /> All projects
      </button>
      <div className="detail-title">
        <div>
          <span className="eyebrow">{project.country} · Active since 2022</span>
          <h1>{project.name}</h1>
          <p>Landscape restoration monitored through carbon and habitat indicators.</p>
        </div>
        <div className="status-badge">
          <i /> Active project
        </div>
      </div>
      <section className="detail-metrics">
        <Metric
          label="Carbon stored"
          value={compact.format(project.carbon)}
          suffix=" tCO₂e"
          trend="+12.8%"
        />
        <Metric
          label="Biodiversity"
          value={`${project.biodiversity}`}
          suffix="/100"
          trend="+4.2%"
        />
        <Metric label="Protected area" value={compact.format(project.area)} suffix=" ha" />
        <Metric label="Restoration" value={`${project.progress}`} suffix="%" trend="+8.4%" />
      </section>
      <div className="detail-map-row">
        <section className="detail-map">
          <MapPanel projects={[project]} selected={project} onSelect={() => undefined} />
          <div className="map-caption">
            <span>02 monitored sites</span>
            <span>{project.area.toLocaleString()} hectares</span>
          </div>
        </section>
        <section className="health-card">
          <span className="eyebrow">Composite indicator</span>
          <h3>Project health</h3>
          <div className="health-score">
            <strong>{project.health}</strong>
            <span>EXCELLENT</span>
          </div>
          {[
            ['Carbon delivery', 92],
            ['Biodiversity', project.biodiversity],
            ['Restoration', project.progress],
          ].map(([label, score]) => (
            <div className="health-line" key={label}>
              <div>
                <span>{label}</span>
                <b>{score}</b>
              </div>
              <i>
                <span style={{ width: `${score}%` }} />
              </i>
            </div>
          ))}
          <p>Weighted from the latest verified observations across all project sites.</p>
        </section>
      </div>
      <AnalyticsCharts project={project} />
    </div>
  )
}

function CreateWizard({ close }: { close: () => void }) {
  const [step, setStep] = useState(1)
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true">
      <div className="wizard">
        <header>
          <div>
            <span className="eyebrow">New project</span>
            <h2>Define a landscape</h2>
          </div>
          <button onClick={close} aria-label="Close">
            <X />
          </button>
        </header>
        <div className="steps">
          {['Project info', 'Add sites', 'Review', 'Create'].map((name, index) => (
            <div className={step >= index + 1 ? 'complete' : ''} key={name}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <span>{name}</span>
            </div>
          ))}
        </div>
        <div className="wizard-content">
          {step === 1 && (
            <>
              <span className="eyebrow">01 — Fundamentals</span>
              <h3>Tell us about the project</h3>
              <div className="form-grid">
                <label>
                  Project name
                  <input defaultValue="Atlantic Forest Recovery" />
                </label>
                <label>
                  Country
                  <input defaultValue="Brazil" />
                </label>
                <label className="full">
                  Purpose
                  <textarea defaultValue="Restore fragmented habitat and measure long-term carbon sequestration." />
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <div className="draw-step">
              <span className="eyebrow">02 — Geospatial sites</span>
              <h3>Draw the project boundary</h3>
              <p>
                Use Mapbox Draw to add one or more polygon sites. Every boundary is validated before
                storage in PostGIS.
              </p>
              <div className="draw-canvas">
                <div className="draw-shape" />
                <span>Click points to define a polygon</span>
              </div>
            </div>
          )}
          {step === 3 && (
            <div className="review-step">
              <Sparkles />
              <span className="eyebrow">Ready for review</span>
              <h3>Atlantic Forest Recovery</h3>
              <p>Brazil · 1 geographical site · 8,240 estimated hectares</p>
            </div>
          )}
          {step === 4 && (
            <div className="review-step success">
              <Globe2 />
              <span className="eyebrow">Project created</span>
              <h3>Your landscape is ready</h3>
              <p>Analytics can now be added to the new site.</p>
            </div>
          )}
        </div>
        <footer>
          <button className="secondary" onClick={() => (step > 1 ? setStep(step - 1) : close())}>
            {step > 1 ? 'Back' : 'Cancel'}
          </button>
          <button className="primary" onClick={() => (step < 4 ? setStep(step + 1) : close())}>
            {step === 4 ? 'View project' : 'Continue'} <ArrowUpRight size={16} />
          </button>
        </footer>
      </div>
    </div>
  )
}

function App() {
  const [userName, setUserName] = useState(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      return raw ? (JSON.parse(raw).user?.name as string) : ''
    } catch {
      return ''
    }
  })
  const [selected, setSelected] = useState<Project>()
  const [filter, setFilter] = useState('All regions')
  const [wizard, setWizard] = useState(false)
  const [menu, setMenu] = useState(false)
  const projects = initialProjects
  const selectProject = useCallback((project: Project) => setSelected(project), [])
  const totals = useMemo(
    () => ({
      area: projects.reduce((sum, item) => sum + item.area, 0),
      carbon: projects.reduce((sum, item) => sum + item.carbon, 0),
      biodiversity: Math.round(
        projects.reduce((sum, item) => sum + item.biodiversity, 0) / projects.length,
      ),
    }),
    [projects],
  )

  if (!userName) {
    return <LoginScreen onEnter={setUserName} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        open={menu}
        close={() => setMenu(false)}
        userName={userName}
        onLogout={() => {
          localStorage.removeItem(SESSION_KEY)
          setUserName('')
        }}
      />
      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenu(true)}>
            <Menu />
          </button>
          <div className="search">
            <Search size={16} />
            <input placeholder="Search projects, sites, regions…" />
            <kbd>⌘ K</kbd>
          </div>
          <button className="primary" onClick={() => setWizard(true)}>
            <Plus size={16} /> New project
          </button>
        </header>
        {selected ? (
          <Detail project={selected} back={() => setSelected(undefined)} />
        ) : (
          <div className="overview">
            <div className="page-intro">
              <div>
                <span className="eyebrow">Global portfolio · September 2026</span>
                <h1>Earth intelligence.</h1>
                <p>Monitor carbon and biodiversity performance across every landscape.</p>
              </div>
              <button
                className="filter"
                onClick={() => setFilter(filter === 'All regions' ? 'Active only' : 'All regions')}
              >
                {filter}
                <ChevronDown size={15} />
              </button>
            </div>
            <section className="overview-map">
              <MapPanel projects={projects} onSelect={selectProject} />
              <div className="map-overlay">
                <span className="eyebrow">Live portfolio</span>
                <strong>{projects.length * 2} monitored sites</strong>
                <div>
                  <i className="active-dot" /> All systems operational
                </div>
              </div>
            </section>
            <section className="portfolio-stats">
              <div className="stats-intro">
                <span className="eyebrow">Portfolio overview</span>
                <p>Verified environmental performance across six active regions.</p>
              </div>
              <Metric
                label="Active projects"
                value={`${projects.length}`}
                trend="+2 this quarter"
              />
              <Metric
                label="Protected area"
                value={compact.format(totals.area)}
                suffix=" ha"
                trend="+8.2%"
              />
              <Metric
                label="Carbon impact"
                value={compact.format(totals.carbon)}
                suffix=" tCO₂e"
                trend="+12.8%"
              />
              <Metric
                label="Biodiversity index"
                value={`${totals.biodiversity}`}
                suffix="/100"
                trend="+4.1%"
              />
            </section>
            <section className="projects-section">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">Project portfolio</span>
                  <h2>Priority landscapes</h2>
                </div>
                <button>
                  View all projects <ArrowUpRight size={15} />
                </button>
              </div>
              <div className="project-list">
                {projects.slice(0, 4).map((project, index) => (
                  <button
                    className="project-row"
                    key={project.id}
                    onClick={() => setSelected(project)}
                  >
                    <span className="project-index">0{index + 1}</span>
                    <span className="project-name">
                      <strong>{project.name}</strong>
                      <small>
                        {project.country} · {project.area.toLocaleString()} ha
                      </small>
                    </span>
                    <span className="project-carbon">
                      <small>CARBON</small>
                      {compact.format(project.carbon)} tCO₂e
                    </span>
                    <span className="project-health">
                      <small>HEALTH</small>
                      <i>
                        <span style={{ width: `${project.health}%` }} />
                      </i>
                      {project.health}
                    </span>
                    <ArrowUpRight size={18} />
                  </button>
                ))}
              </div>
            </section>
          </div>
        )}
      </main>
      {wizard && <CreateWizard close={() => setWizard(false)} />}
    </div>
  )
}

export default App
