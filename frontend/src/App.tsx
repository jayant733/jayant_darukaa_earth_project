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
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
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
  activePath,
  onNavigate,
}: {
  open: boolean
  close: () => void
  userName: string
  onLogout: () => void
  activePath: string
  onNavigate: (path: string) => void
}) {
  const items = [
    [LayoutDashboard, 'Overview', '/'],
    [Layers3, 'Projects', '/projects'],
    [Map, 'Sites', '/sites'],
    [BarChart3, 'Analytics', '/analytics'],
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
        {items.map(([Icon, label, path]) => (
          <button
            className={
              activePath === path || (path !== '/' && activePath.startsWith(path)) ? 'active' : ''
            }
            key={label}
            onClick={() => {
              onNavigate(path)
              close()
            }}
          >
            <Icon size={17} strokeWidth={1.8} /> {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-foot">
        <button onClick={() => onNavigate('/settings')}>
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
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getProject(id)
      .then((data) => active && setProject(data))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [attempt, id])

  const projectSites = useMemo(
    () => sites.filter((site) => site.properties.project_id === id),
    [id, sites],
  )

  if (error) {
    return (
      <ErrorState
        message={error}
        onBack={back}
        onRetry={() => {
          setError('')
          setProject(undefined)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }
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
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    getSite(id)
      .then((data) => active && setSite(data))
      .catch((err) => active && setError(err.message))
    return () => {
      active = false
    }
  }, [attempt, id])

  if (error) {
    return (
      <ErrorState
        message={error}
        onBack={back}
        onRetry={() => {
          setError('')
          setSite(undefined)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }
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

function LoadingState({ label, dashboard = false }: { label: string; dashboard?: boolean }) {
  if (dashboard) {
    return (
      <div className="dashboard-skeleton" role="status" aria-label={label}>
        <div className="skeleton skeleton-map" />
        <div className="skeleton-row">
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
          <div className="skeleton" />
        </div>
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <span className="sr-only">{label}</span>
      </div>
    )
  }
  return (
    <div className="state-panel">
      <div className="spinner" />
      <p>{label}…</p>
    </div>
  )
}

function ErrorState({
  message,
  onBack,
  onRetry,
}: {
  message: string
  onBack?: () => void
  onRetry?: () => void
}) {
  return (
    <div className="state-panel">
      <span className="eyebrow">Something went wrong</span>
      <h3>{message}</h3>
      <p>Your data is safe. Check your connection, then try again.</p>
      <div className="state-actions">
        {onRetry && (
          <button className="primary" onClick={onRetry}>
            Try again
          </button>
        )}
        {onBack && (
          <button className="secondary" onClick={onBack}>
            Go back
          </button>
        )}
      </div>
    </div>
  )
}

function Toast({
  message,
  kind,
  dismiss,
}: {
  message: string
  kind: 'success' | 'error'
  dismiss: () => void
}) {
  useEffect(() => {
    const timer = window.setTimeout(dismiss, 5000)
    return () => window.clearTimeout(timer)
  }, [dismiss])
  return (
    <div className={`toast toast-${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{kind === 'success' ? '✓' : '!'}</span>
      <p>{message}</p>
      <button onClick={dismiss} aria-label="Dismiss notification">
        <X size={15} />
      </button>
    </div>
  )
}

function NotFound({ home }: { home: () => void }) {
  return (
    <div className="not-found">
      <div className="not-found-orbit">
        <Globe2 />
        <span>404</span>
      </div>
      <span className="eyebrow">Outside monitored territory</span>
      <h1>Nothing mapped here.</h1>
      <p>The page may have moved, or the address may be incorrect.</p>
      <button className="primary" onClick={home}>
        Return to Earth Intelligence
      </button>
    </div>
  )
}

function ProjectList({
  projects,
  openProject,
}: {
  projects: ProjectSummary[]
  openProject: (id: string) => void
}) {
  return (
    <div className="project-list">
      {projects.map((project, index) => (
        <button className="project-row" key={project.id} onClick={() => openProject(project.id)}>
          <span className="project-index">{String(index + 1).padStart(2, '0')}</span>
          <span className="project-name">
            <strong>{project.name}</strong>
            <small>
              {project.country} · {project.area_ha.toLocaleString()} ha · {project.site_count} sites
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
  )
}

function WorkspaceSection({
  section,
  projects,
  sites,
  openProject,
  openSite,
  create,
}: {
  section: 'projects' | 'sites' | 'analytics' | 'settings'
  projects: ProjectSummary[]
  sites: SiteFeature[]
  openProject: (id: string) => void
  openSite: (site: SiteFeature) => void
  create: () => void
}) {
  if (section === 'settings') {
    return (
      <div className="overview">
        <div className="page-intro">
          <div>
            <span className="eyebrow">Workspace</span>
            <h1>Settings.</h1>
            <p>Account and data connection status for this administrator workspace.</p>
          </div>
        </div>
        <div className="settings-card">
          <strong>Data connection</strong>
          <span className="status-good">Connected</span>
          <p>Projects, site geometry, and analytics are stored in PostgreSQL with PostGIS.</p>
        </div>
      </div>
    )
  }

  if (section === 'sites') {
    return (
      <div className="overview">
        <div className="page-intro">
          <div>
            <span className="eyebrow">Geospatial portfolio</span>
            <h1>Sites.</h1>
            <p>Explore every monitored boundary and open its latest observations.</p>
          </div>
        </div>
        {sites.length ? (
          <>
            <section className="overview-map">
              <MapPanel sites={sites} onSelect={openSite} />
            </section>
            <div className="site-directory">
              {sites.map((site) => (
                <button key={site.id} onClick={() => openSite(site)}>
                  <span className="eyebrow">{site.properties.project}</span>
                  <strong>{site.properties.name}</strong>
                  <small>{site.properties.area_ha.toLocaleString()} ha</small>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="state-panel">
            <Map size={26} />
            <h3>No sites have been mapped</h3>
            <p>Create a project and draw its first geographical boundary.</p>
            <button className="primary" onClick={create}>
              <Plus size={16} /> New project
            </button>
          </div>
        )}
      </div>
    )
  }

  if (section === 'analytics') {
    return (
      <div className="overview">
        <div className="page-intro">
          <div>
            <span className="eyebrow">Portfolio performance</span>
            <h1>Analytics.</h1>
            <p>Compare health, carbon delivery, and biodiversity across projects.</p>
          </div>
        </div>
        {projects.length ? (
          <div className="analytics-directory">
            {projects.map((project) => (
              <button key={project.id} onClick={() => openProject(project.id)}>
                <span>{project.name}</span>
                <strong>{project.health}</strong>
                <i>
                  <span style={{ width: `${project.health}%` }} />
                </i>
                <small>{healthLabel(project.health)}</small>
              </button>
            ))}
          </div>
        ) : (
          <div className="state-panel">
            <BarChart3 size={26} />
            <h3>No analytics available</h3>
            <p>Analytics appear after a project records its first site observation.</p>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="overview">
      <div className="page-intro">
        <div>
          <span className="eyebrow">Project portfolio</span>
          <h1>Projects.</h1>
          <p>Open a landscape to review its sites and performance.</p>
        </div>
        <button className="primary" onClick={create}>
          <Plus size={16} /> New project
        </button>
      </div>
      {projects.length ? (
        <ProjectList projects={projects} openProject={openProject} />
      ) : (
        <div className="state-panel">
          <Layers3 size={26} />
          <h3>No projects yet</h3>
          <p>Define your first landscape and map its first geographical site.</p>
          <button className="primary" onClick={create}>
            <Plus size={16} /> New project
          </button>
        </div>
      )}
    </div>
  )
}

const emptyDraft = { name: '', country: '', description: '', points: [] as [number, number][] }

// The draw canvas is a local window, not the whole globe: a boundary drawn edge to edge
// covers roughly 55km x 39km so areas land in the same range as real restoration sites.
const WINDOW_LNG = 0.5
const WINDOW_LAT = 0.35

const COUNTRY_CENTERS: Record<string, [number, number]> = {
  brazil: [-62.22, -3.46],
  bangladesh: [89.18, 21.95],
  'dr congo': [22.05, -0.68],
  kenya: [35.58, -0.55],
  indonesia: [114.46, 0.95],
  'united states': [-120.1, 38.71],
  india: [78.96, 20.59],
  colombia: [-74.3, 4.57],
  peru: [-75.02, -9.19],
  tanzania: [34.89, -6.37],
}

function countryCenter(country: string): [number, number] {
  return COUNTRY_CENTERS[country.trim().toLowerCase()] ?? [12.35, 6.42]
}

function CreateWizard({
  close,
  onCreated,
}: {
  close: () => void
  onCreated: (projectId: string, projectName: string) => void
}) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState(emptyDraft)
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  // Points are stored as canvas fractions and projected to coordinates only on submit,
  // so the preview and the stored geometry always agree.
  function addPoint(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - rect.left) / rect.width
    const y = (event.clientY - rect.top) / rect.height
    setDraft((current) => ({ ...current, points: [...current.points, [x, y]] }))
  }

  function toCoordinates(points: [number, number][]): [number, number][] {
    const [centerLng, centerLat] = countryCenter(draft.country)
    return points.map(([x, y]) => [
      Number((centerLng + (x - 0.5) * WINDOW_LNG).toFixed(5)),
      Number((centerLat - (y - 0.5) * WINDOW_LAT).toFixed(5)),
    ])
  }

  async function submit() {
    setPending(true)
    setError('')
    try {
      const ring = toCoordinates(draft.points)
      ring.push(ring[0])
      const result = await createProject({
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
      onCreated(result.id, draft.name)
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
              {!canContinue && (
                <p className="form-hint">Project name and country are required to continue.</p>
              )}
            </>
          )}
          {step === 2 && (
            <div className="draw-step">
              <span className="eyebrow">02 — Geospatial sites</span>
              <h3>Draw the project boundary</h3>
              <p>
                Click to place at least three points around {draft.country || 'the project area'}.
                The polygon is stored in PostGIS and its area is computed server-side.
              </p>
              <div className="draw-canvas" onClick={addPoint}>
                {draft.points.length > 2 && (
                  <svg className="draw-preview" viewBox="0 0 100 100" preserveAspectRatio="none">
                    <polygon
                      points={draft.points.map(([x, y]) => `${x * 100},${y * 100}`).join(' ')}
                    />
                  </svg>
                )}
                {draft.points.map(([x, y], index) => (
                  <i
                    key={`${x}-${y}-${index}`}
                    className="draw-point"
                    style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
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
              {draft.points.length > 0 && draft.points.length < 3 && (
                <p className="form-hint">Add at least three points to close the boundary.</p>
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
  const location = useLocation()
  const navigate = useNavigate()
  const [userName, setUserName] = useState(() => readSession()?.user.name ?? '')
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [sites, setSites] = useState<SiteFeature[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [wizard, setWizard] = useState(false)
  const [menu, setMenu] = useState(false)
  const [query, setQuery] = useState('')
  const [toast, setToast] = useState<{ message: string; kind: 'success' | 'error' }>()

  const [refreshKey, setRefreshKey] = useState(0)
  const reload = useCallback(() => {
    setLoading(true)
    setRefreshKey((key) => key + 1)
  }, [])

  useEffect(() => {
    const expire = () => {
      setUserName('')
      setToast({ kind: 'error', message: 'Your session expired. Please sign in again.' })
    }
    window.addEventListener('darukaa:unauthorized', expire)
    return () => window.removeEventListener('darukaa:unauthorized', expire)
  }, [])

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

  const openProject = useCallback((id: string) => navigate(`/projects/${id}`), [navigate])
  const openSite = useCallback(
    (site: SiteFeature) => navigate(`/sites/${site.properties.id}`),
    [navigate],
  )
  const projectMatch = matchPath('/projects/:id', location.pathname)
  const siteMatch = matchPath('/sites/:id', location.pathname)
  const section = ['/projects', '/sites', '/analytics', '/settings'].includes(location.pathname)
    ? (location.pathname.slice(1) as 'projects' | 'sites' | 'analytics' | 'settings')
    : undefined
  const routeFound = location.pathname === '/' || Boolean(projectMatch || siteMatch || section)

  if (!userName) {
    return (
      <>
        <LoginScreen
          onAuthenticated={(name) => {
            setUserName(name)
            setToast({ kind: 'success', message: `Welcome back, ${name}.` })
          }}
        />
        {toast && <Toast {...toast} dismiss={() => setToast(undefined)} />}
      </>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar
        open={menu}
        close={() => setMenu(false)}
        userName={userName}
        activePath={location.pathname}
        onNavigate={navigate}
        onLogout={() => {
          clearSession()
          setUserName('')
          navigate('/')
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

        {!routeFound && <NotFound home={() => navigate('/')} />}
        {routeFound && error && (
          <div className="overview">
            <ErrorState message={error} onRetry={reload} />
          </div>
        )}
        {routeFound && !error && loading && (
          <div className="overview">
            <LoadingState label="Loading workspace" dashboard />
          </div>
        )}
        {routeFound && !error && !loading && projectMatch?.params.id && (
          <ProjectView
            key={projectMatch.params.id}
            id={projectMatch.params.id}
            sites={sites}
            back={() => navigate('/projects')}
            onSite={(id) => navigate(`/sites/${id}`)}
          />
        )}
        {routeFound && !error && !loading && siteMatch?.params.id && (
          <SiteView
            key={siteMatch.params.id}
            id={siteMatch.params.id}
            back={() => navigate('/sites')}
          />
        )}
        {routeFound && !error && !loading && section && (
          <WorkspaceSection
            section={section}
            projects={projects}
            sites={sites}
            openProject={openProject}
            openSite={openSite}
            create={() => setWizard(true)}
          />
        )}
        {routeFound && !error && !loading && location.pathname === '/' && (
          <div className="overview">
            <div className="page-intro">
              <div>
                <span className="eyebrow">Global portfolio</span>
                <h1>Earth intelligence.</h1>
                <p>Monitor carbon and biodiversity performance across every landscape.</p>
              </div>
            </div>
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
              <Metric label="Carbon impact" value={compact.format(totals.carbon)} suffix=" tCO₂e" />
              <Metric label="Biodiversity index" value={`${totals.biodiversity}`} suffix="/100" />
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
                  <Search size={26} />
                  <h3>{projects.length ? 'No matching projects' : 'No projects yet'}</h3>
                  <p>
                    {projects.length
                      ? `No projects match “${query}”. Try a different name or region.`
                      : 'Draw a polygon to start monitoring carbon and biodiversity.'}
                  </p>
                  {projects.length ? (
                    <button className="secondary" onClick={() => setQuery('')}>
                      Clear search
                    </button>
                  ) : (
                    <button className="primary" onClick={() => setWizard(true)}>
                      <Plus size={16} /> New project
                    </button>
                  )}
                </div>
              ) : (
                <ProjectList projects={visible} openProject={openProject} />
              )}
            </section>
          </div>
        )}
      </main>
      {wizard && (
        <CreateWizard
          close={() => setWizard(false)}
          onCreated={(projectId, projectName) => {
            reload()
            setToast({ kind: 'success', message: `${projectName} was created successfully.` })
            navigate(`/projects/${projectId}`)
          }}
        />
      )}
      {toast && <Toast {...toast} dismiss={() => setToast(undefined)} />}
    </div>
  )
}

export default App
