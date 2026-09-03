import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  BarChart3,
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
import { MapPanel } from './MapPanel'
import {
  clearSession,
  createProject,
  getProject,
  getProjects,
  getSite,
  getSites,
  login,
  readSession,
  register,
  saveSession,
  type ProjectDetail,
  type ProjectSummary,
  type SiteDetail,
  type SiteFeature,
} from './api'

const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

type View = { kind: 'overview' } | { kind: 'project'; id: string } | { kind: 'site'; id: string }

function healthLabel(score: number) {
  if (score >= 80) return 'EXCELLENT'
  if (score >= 60) return 'ON TRACK'
  if (score >= 40) return 'NEEDS ATTENTION'
  return 'AT RISK'
}

function LoginScreen({ onAuthenticated }: { onAuthenticated: (name: string) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('admin@darukaa.earth')
  const [password, setPassword] = useState('darukaa-demo')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      const session =
        mode === 'login' ? await login(email, password) : await register(name, email, password)
      saveSession(session)
      onAuthenticated(session.user.name)
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
            <input required value={name} onChange={(e) => setName(e.target.value)} />
          </label>
        )}
        <label>
          Email
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          Password
          <input
            required
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
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
  onHome,
}: {
  open: boolean
  close: () => void
  userName: string
  onLogout: () => void
  onHome: () => void
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
          <button
            className={index === 0 ? 'active' : ''}
            key={label}
            onClick={() => {
              onHome()
              close()
            }}
          >
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

function HealthCard({
  health,
  biodiversity,
  progress,
  carbonShare,
}: {
  health: number
  biodiversity: number
  progress: number
  carbonShare: number
}) {
  return (
    <section className="health-card">
      <span className="eyebrow">Composite indicator</span>
      <h3>Project health</h3>
      <div className="health-score">
        <strong>{health}</strong>
        <span>{healthLabel(health)}</span>
      </div>
      {[
        ['Carbon delivery', Math.round(carbonShare)],
        ['Biodiversity', Math.round(biodiversity)],
        ['Restoration', Math.round(progress)],
      ].map(([label, score]) => (
        <div className="health-line" key={label}>
          <div>
            <span>{label}</span>
            <b>{score}</b>
          </div>
          <i>
            <span style={{ width: `${Math.min(Number(score), 100)}%` }} />
          </i>
        </div>
      ))}
      <p>Weighted from the latest verified observations across all project sites.</p>
    </section>
  )
}

function ProjectView({
  id,
  sites,
  back,
  onSite,
}: {
  id: string
  sites: SiteFeature[]
  back: () => void
  onSite: (siteId: string) => void
}) {
  const [project, setProject] = useState<ProjectDetail>()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getProject(id)
      .then((data) => active && setProject(data))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [id])

  const projectSites = useMemo(
    () => sites.filter((site) => site.properties.project_id === id),
    [id, sites],
  )

  if (error) return <ErrorState message={error} onBack={back} />
  if (!project) return <LoadingState label="Loading project analytics" />

  const carbonShare = Math.min((project.carbon_tco2e / (project.carbon_tco2e || 1)) * 92, 100)

  return (
    <div className="detail-view">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={16} /> All projects
      </button>
      <div className="detail-title">
        <div>
          <span className="eyebrow">
            {project.country} · {project.status}
          </span>
          <h1>{project.name}</h1>
          <p>
            {project.description || 'Landscape restoration monitored across all project sites.'}
          </p>
        </div>
        <div className="status-badge">
          <i /> {project.status} project
        </div>
      </div>
      <section className="detail-metrics">
        <Metric
          label="Carbon stored"
          value={compact.format(project.carbon_tco2e)}
          suffix=" tCO₂e"
        />
        <Metric label="Biodiversity" value={`${project.biodiversity_index}`} suffix="/100" />
        <Metric label="Protected area" value={compact.format(project.area_ha)} suffix=" ha" />
        <Metric label="Restoration" value={`${project.progress}`} suffix="%" />
      </section>
      <div className="detail-map-row">
        <section className="detail-map">
          <MapPanel
            sites={projectSites}
            focused={projectSites[0]?.geometry}
            onSelect={(site) => onSite(site.properties.id)}
          />
          <div className="map-caption">
            <span>{project.site_count} monitored sites</span>
            <span>{project.area_ha.toLocaleString()} hectares</span>
          </div>
        </section>
        <HealthCard
          health={project.health}
          biodiversity={project.biodiversity_index}
          progress={project.progress}
          carbonShare={carbonShare}
        />
      </div>
      <section className="site-strip">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Geographical sites</span>
            <h3>Click a site for detailed analytics</h3>
          </div>
        </div>
        <div className="site-chips">
          {projectSites.map((site) => (
            <button key={site.properties.id} onClick={() => onSite(site.properties.id)}>
              <strong>{site.properties.name}</strong>
              <span>{site.properties.area_ha.toLocaleString()} ha</span>
            </button>
          ))}
        </div>
      </section>
      <AnalyticsCharts id={project.id} series={project.series} />
    </div>
  )
}

function SiteView({ id, back }: { id: string; back: () => void }) {
  const [site, setSite] = useState<SiteDetail>()
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    getSite(id)
      .then((data) => active && setSite(data))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [id])

  if (error) return <ErrorState message={error} onBack={back} />
  if (!site) return <LoadingState label="Loading site analytics" />

  return (
    <div className="detail-view">
      <button className="back-button" onClick={back}>
        <ArrowLeft size={16} /> Back to project
      </button>
      <div className="detail-title">
        <div>
          <span className="eyebrow">{site.project}</span>
          <h1>{site.name}</h1>
          <p>Site-level carbon and habitat performance measured over time.</p>
        </div>
      </div>
      <section className="detail-metrics">
        <Metric label="Carbon stored" value={compact.format(site.carbon_tco2e)} suffix=" tCO₂e" />
        <Metric label="Biodiversity" value={`${site.biodiversity_index}`} suffix="/100" />
        <Metric label="Site area" value={compact.format(site.area_ha)} suffix=" ha" />
        <Metric label="Restoration" value={`${site.progress}`} suffix="%" />
      </section>
      <div className="detail-map-row">
        <section className="detail-map">
          <MapPanel
            sites={[
              {
                type: 'Feature',
                id: site.id,
                geometry: site.geometry,
                properties: {
                  id: site.id,
                  name: site.name,
                  project_id: site.project_id,
                  project: site.project,
                  status: 'active',
                  area_ha: site.area_ha,
                },
              },
            ]}
            focused={site.geometry}
          />
          <div className="map-caption">
            <span>Site boundary</span>
            <span>{site.area_ha.toLocaleString()} hectares</span>
          </div>
        </section>
        <HealthCard
          health={Math.round(site.biodiversity_index * 0.5 + site.progress * 0.5)}
          biodiversity={site.biodiversity_index}
          progress={site.progress}
          carbonShare={92}
        />
      </div>
      <AnalyticsCharts id={site.id} series={site.series} />
    </div>
  )
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="state-panel">
      <div className="spinner" />
      <p>{label}…</p>
    </div>
  )
}

function ErrorState({ message, onBack }: { message: string; onBack?: () => void }) {
  return (
    <div className="state-panel">
      <span className="eyebrow">Something went wrong</span>
      <h3>{message}</h3>
      <p>Confirm the API is running on {import.meta.env.VITE_API_URL || 'port 18765'}.</p>
      {onBack && (
        <button className="secondary" onClick={onBack}>
          Go back
        </button>
      )}
    </div>
  )
}

const emptyDraft = { name: '', country: '', description: '', points: [] as [number, number][] }

function CreateWizard({ close, onCreated }: { close: () => void; onCreated: () => void }) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  function addPoint(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    const lng = Number((x * 360 - 180).toFixed(3))
    const lat = Number((90 - y * 180).toFixed(3))
    setDraft((current) => ({ ...current, points: [...current.points, [lng, lat]] }))
  }

  async function submit() {
    setPending(true)
    setError('')
    try {
      const ring = [...draft.points, draft.points[0]]
      await createProject({
        name: draft.name,
        country: draft.country,
        description: draft.description,
        sites: [
          {
            name: `${draft.country || draft.name} Site 01`,
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
        ],
      })
      setStep(4)
      onCreated()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project')
    } finally {
      setPending(false)
    }
  }

  const canContinue =
    step === 1 ? draft.name.length > 2 && draft.country.length > 1 : draft.points.length >= 3

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
                  <input
                    value={draft.name}
                    placeholder="Atlantic Forest Recovery"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label>
                  Country
                  <input
                    value={draft.country}
                    placeholder="Brazil"
                    onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                  />
                </label>
                <label className="full">
                  Purpose
                  <textarea
                    value={draft.description}
                    placeholder="Restore fragmented habitat and measure long-term carbon sequestration."
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
              </div>
            </>
          )}
          {step === 2 && (
            <div className="draw-step">
              <span className="eyebrow">02 — Geospatial sites</span>
              <h3>Draw the project boundary</h3>
              <p>
                Click the map to place at least three points. The polygon is stored in PostGIS and
                its area is computed server-side.
              </p>
              <div className="draw-canvas" onClick={addPoint}>
                {draft.points.length > 2 && (
                  <svg className="draw-preview" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={draft.points
                        .map(
                          ([lng, lat]) =>
                            `${((lng + 180) / 360) * 100},${((90 - lat) / 180) * 100}`,
                        )
                        .join(' ')}
                    />
                  </svg>
                )}
                {draft.points.map(([lng, lat], index) => (
                  <i
                    key={`${lng}-${lat}-${index}`}
                    className="draw-point"
                    style={{
                      left: `${((lng + 180) / 360) * 100}%`,
                      top: `${((90 - lat) / 180) * 100}%`,
                    }}
                  />
                ))}
                <span>
                  {draft.points.length === 0
                    ? 'Click points to define a polygon'
                    : `${draft.points.length} points placed`}
                </span>
              </div>
              {draft.points.length > 0 && (
                <button
                  className="text-link"
                  onClick={() => setDraft({ ...draft, points: [] })}
                  type="button"
                >
                  Clear polygon
                </button>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="review-step">
              <Sparkles />
              <span className="eyebrow">Ready for review</span>
              <h3>{draft.name}</h3>
              <p>
                {draft.country} · 1 geographical site · {draft.points.length} boundary points
              </p>
              {error && <p className="form-error">{error}</p>}
            </div>
          )}
          {step === 4 && (
            <div className="review-step success">
              <Globe2 />
              <span className="eyebrow">Project created</span>
              <h3>{draft.name} is live</h3>
              <p>The polygon was stored in PostGIS and now appears on your global map.</p>
            </div>
          )}
        </div>
        <footer>
          <button
            className="secondary"
            onClick={() => (step > 1 && step < 4 ? setStep(step - 1) : close())}
          >
            {step > 1 && step < 4 ? 'Back' : 'Cancel'}
          </button>
          <button
            className="primary"
            disabled={pending || (step < 3 && !canContinue)}
            onClick={() => {
              if (step === 3) return submit()
              if (step === 4) return close()
              setStep(step + 1)
            }}
          >
            {pending
              ? 'Creating…'
              : step === 3
                ? 'Create project'
                : step === 4
                  ? 'Done'
                  : 'Continue'}
            <ArrowUpRight size={16} />
          </button>
        </footer>
      </div>
    </div>
  )
}

function App() {
  const [userName, setUserName] = useState(() => readSession()?.user.name ?? '')
  const [view, setView] = useState<View>({ kind: 'overview' })
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sites, setSites] = useState<SiteFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizard, setWizard] = useState(false)
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')

  const [refreshKey, setRefreshKey] = useState(0)
  const reload = useCallback(() => setRefreshKey((key) => key + 1), [])

  useEffect(() => {
    if (!userName) return
    let active = true
    Promise.all([getProjects(), getSites()])
      .then(([projectList, siteCollection]) => {
        if (!active) return
        setProjects(projectList)
        setSites(siteCollection.features)
        setError('')
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [refreshKey, userName])

  const totals = useMemo(
    () => ({
      area: projects.reduce((sum, item) => sum + item.area_ha, 0),
      carbon: projects.reduce((sum, item) => sum + item.carbon_tco2e, 0),
      biodiversity: projects.length
        ? Math.round(
            projects.reduce((sum, item) => sum + item.biodiversity_index, 0) / projects.length,
          )
        : 0,
    }),
    [projects],
  )

  const visible = useMemo(
    () =>
      projects.filter((project) =>
        `${project.name} ${project.country}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [projects, query],
  )

  const openSite = useCallback(
    (site: SiteFeature) => setView({ kind: 'site', id: site.properties.id }),
    [],
  )

  if (!userName) {
    return <LoginScreen onAuthenticated={setUserName} />
  }

  return (
    <div className="app-shell">
      <Sidebar
        open={menu}
        close={() => setMenu(false)}
        userName={userName}
        onHome={() => setView({ kind: 'overview' })}
        onLogout={() => {
          clearSession()
          setUserName('')
        }}
      />
      <main>
        <header className="topbar">
          <button className="menu-button" onClick={() => setMenu(true)} aria-label="Open menu">
            <Menu />
          </button>
          <div className="search">
            <Search size={16} />
            <input
              placeholder="Search projects, sites, regions…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <button className="primary" onClick={() => setWizard(true)}>
            <Plus size={16} /> New project
          </button>
        </header>

        {view.kind === 'project' && (
          <ProjectView
            id={view.id}
            sites={sites}
            back={() => setView({ kind: 'overview' })}
            onSite={(id) => setView({ kind: 'site', id })}
          />
        )}
        {view.kind === 'site' && (
          <SiteView id={view.id} back={() => setView({ kind: 'overview' })} />
        )}
        {view.kind === 'overview' && (
          <div className="overview">
            <div className="page-intro">
              <div>
                <span className="eyebrow">Global portfolio</span>
                <h1>Earth intelligence.</h1>
                <p>Monitor carbon and biodiversity performance across every landscape.</p>
              </div>
            </div>

            {error && <ErrorState message={error} />}
            {!error && loading && <LoadingState label="Loading portfolio" />}

            {!error && !loading && (
              <>
                <section className="overview-map">
                  <MapPanel sites={sites} onSelect={openSite} />
                  <div className="map-overlay">
                    <span className="eyebrow">Live portfolio</span>
                    <strong>{sites.length} monitored sites</strong>
                    <div>
                      <i className="active-dot" /> Connected to PostGIS
                    </div>
                  </div>
                </section>
                <section className="portfolio-stats">
                  <div className="stats-intro">
                    <span className="eyebrow">Portfolio overview</span>
                    <p>Verified environmental performance across all active regions.</p>
                  </div>
                  <Metric label="Active projects" value={`${projects.length}`} />
                  <Metric label="Protected area" value={compact.format(totals.area)} suffix=" ha" />
                  <Metric
                    label="Carbon impact"
                    value={compact.format(totals.carbon)}
                    suffix=" tCO₂e"
                  />
                  <Metric
                    label="Biodiversity index"
                    value={`${totals.biodiversity}`}
                    suffix="/100"
                  />
                </section>
                <section className="projects-section">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">Project portfolio</span>
                      <h2>All landscapes</h2>
                    </div>
                  </div>
                  {visible.length === 0 ? (
                    <div className="state-panel">
                      <span className="eyebrow">No projects yet</span>
                      <h3>Create your first landscape</h3>
                      <p>Draw a polygon to start monitoring carbon and biodiversity.</p>
                      <button className="primary" onClick={() => setWizard(true)}>
                        <Plus size={16} /> New project
                      </button>
                    </div>
                  ) : (
                    <div className="project-list">
                      {visible.map((project, index) => (
                        <button
                          className="project-row"
                          key={project.id}
                          onClick={() => setView({ kind: 'project', id: project.id })}
                        >
                          <span className="project-index">
                            {String(index + 1).padStart(2, '0')}
                          </span>
                          <span className="project-name">
                            <strong>{project.name}</strong>
                            <small>
                              {project.country} · {project.area_ha.toLocaleString()} ha ·{' '}
                              {project.site_count} sites
                            </small>
                          </span>
                          <span className="project-carbon">
                            <small>CARBON</small>
                            {compact.format(project.carbon_tco2e)} tCO₂e
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
                  )}
                </section>
              </>
            )}
          </div>
        )}
      </main>
      {wizard && <CreateWizard close={() => setWizard(false)} onCreated={reload} />}
    </div>
  )
}

export default App
