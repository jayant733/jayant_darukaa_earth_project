import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeft,
  ArrowUpRight,
  Activity,
  BarChart3,
  Edit3,
  Globe2,
  Layers3,
  LayoutDashboard,
  LogOut,
  Map,
  Menu,
  Plus,
  Search,
  Save,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { matchPath, useLocation, useNavigate } from 'react-router-dom'
import './App.css'
import { AnalyticsCharts } from './AnalyticsCharts'
import { MapPanel } from './MapPanel'
import {
  clearSession,
  createObservation,
  createProject,
  createSite,
  deleteObservation,
  deleteProject,
  deleteSite,
  getHealth,
  getMe,
  getPortfolioAnalytics,
  getProject,
  getProjects,
  getSite,
  getSites,
  login,
  readSession,
  register,
  saveSession,
  updateProject,
  updateObservation,
  updateSite,
  type HealthStatus,
  type PortfolioAnalytics,
  type PolygonGeometry,
  type ProjectDetail,
  type ProjectSummary,
  type SiteDetail,
  type SiteFeature,
} from './api'
import { PolygonEditor } from './PolygonEditor'

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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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
            <input
              id="register-name"
              name="name"
              autoComplete="name"
              required
              minLength={2}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        <label>
          Email
          <input
            id="auth-email"
            name="email"
            autoComplete="email"
            required
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Password
          <input
            id="auth-password"
            name="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={8}
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
  carbonShare?: number
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
        ...(carbonShare === undefined ? [] : [['Carbon delivery', Math.round(carbonShare)]]),
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
  onChanged,
  onDeleted,
}: {
  id: string
  sites: SiteFeature[]
  back: () => void
  onSite: (siteId: string) => void
  onChanged: (message: string) => void
  onDeleted: () => void
}) {
  const [project, setProject] = useState<ProjectDetail>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [addingSite, setAddingSite] = useState(false)
  const [pending, setPending] = useState(false)
  const [editDraft, setEditDraft] = useState({
    name: '',
    country: '',
    description: '',
    status: 'planning',
    carbon_target: 100000,
  })
  const [siteDraft, setSiteDraft] = useState<{ name: string; geometry?: PolygonGeometry }>({
    name: '',
  })

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

  const carbonShare = Math.min((project.carbon_tco2e / project.carbon_target) * 100, 100)

  function beginEdit() {
    setEditDraft({
      name: project!.name,
      country: project!.country,
      description: project!.description,
      status: project!.status,
      carbon_target: project!.carbon_target,
    })
    setEditing(true)
  }

  async function saveProject(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      await updateProject(id, {
        ...editDraft,
        status: editDraft.status as 'planning' | 'active' | 'completed',
      })
      setEditing(false)
      setAttempt((value) => value + 1)
      onChanged('Project details updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update project.')
    } finally {
      setPending(false)
    }
  }

  async function removeProject() {
    if (
      !window.confirm(
        `Delete ${project!.name} and all of its sites and observations? This cannot be undone.`,
      )
    )
      return
    setPending(true)
    try {
      await deleteProject(id)
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete project.')
      setPending(false)
    }
  }

  async function addSite(event: FormEvent) {
    event.preventDefault()
    if (!siteDraft.geometry) return
    setPending(true)
    setError('')
    try {
      await createSite(id, { name: siteDraft.name, geometry: siteDraft.geometry })
      setSiteDraft({ name: '' })
      setAddingSite(false)
      setAttempt((value) => value + 1)
      onChanged('Site added to the project.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to add site.')
    } finally {
      setPending(false)
    }
  }

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
        <div className="detail-actions">
          <div className="status-badge">
            <i /> {project.status} project
          </div>
          <button className="secondary" onClick={beginEdit}>
            <Edit3 size={15} /> Edit
          </button>
          <button className="secondary danger" onClick={removeProject} disabled={pending}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>
      {editing && (
        <form className="edit-panel" onSubmit={saveProject}>
          <div className="section-heading">
            <h3>Edit project</h3>
            <button type="button" onClick={() => setEditing(false)}>
              <X size={16} /> Close
            </button>
          </div>
          <div className="form-grid">
            <label>
              Project name
              <input
                required
                minLength={3}
                maxLength={180}
                value={editDraft.name}
                onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
              />
            </label>
            <label>
              Country
              <input
                required
                minLength={2}
                maxLength={120}
                value={editDraft.country}
                onChange={(event) => setEditDraft({ ...editDraft, country: event.target.value })}
              />
            </label>
            <label>
              Status
              <select
                value={editDraft.status}
                onChange={(event) => setEditDraft({ ...editDraft, status: event.target.value })}
              >
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
            <label>
              Carbon target (tCO₂e)
              <input
                type="number"
                min="1"
                required
                value={editDraft.carbon_target}
                onChange={(event) =>
                  setEditDraft({ ...editDraft, carbon_target: Number(event.target.value) })
                }
              />
            </label>
            <label className="full">
              Description
              <textarea
                value={editDraft.description}
                onChange={(event) =>
                  setEditDraft({ ...editDraft, description: event.target.value })
                }
              />
            </label>
          </div>
          <button className="primary" disabled={pending}>
            <Save size={15} /> {pending ? 'Saving…' : 'Save project'}
          </button>
        </form>
      )}
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
          <button className="secondary" onClick={() => setAddingSite((value) => !value)}>
            <Plus size={15} /> Add site
          </button>
        </div>
        {addingSite && (
          <form className="edit-panel" onSubmit={addSite}>
            <label className="field-label">
              Site name
              <input
                required
                minLength={2}
                maxLength={180}
                value={siteDraft.name}
                onChange={(event) => setSiteDraft({ ...siteDraft, name: event.target.value })}
              />
            </label>
            <PolygonEditor
              value={siteDraft.geometry}
              onChange={(geometry) => setSiteDraft({ ...siteDraft, geometry })}
            />
            <button className="primary" disabled={pending || !siteDraft.geometry}>
              {pending ? 'Adding…' : 'Add site'}
            </button>
          </form>
        )}
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

function SiteView({
  id,
  back,
  onChanged,
  onDeleted,
}: {
  id: string
  back: (projectId: string) => void
  onChanged: (message: string) => void
  onDeleted: (projectId: string) => void
}) {
  const [site, setSite] = useState<SiteDetail>()
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [editing, setEditing] = useState(false)
  const [observing, setObserving] = useState(false)
  const [editingObservationId, setEditingObservationId] = useState<string>()
  const [pending, setPending] = useState(false)
  const [editDraft, setEditDraft] = useState<{ name: string; geometry?: PolygonGeometry }>({
    name: '',
  })
  const [observation, setObservation] = useState({
    observed_on: new Date().toISOString().slice(0, 10),
    carbon_tco2e: 0,
    biodiversity_index: 50,
    restoration_progress: 0,
  })

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
        onBack={() => window.history.back()}
        onRetry={() => {
          setError('')
          setSite(undefined)
          setAttempt((value) => value + 1)
        }}
      />
    )
  }
  if (!site) return <LoadingState label="Loading site analytics" />

  async function saveSite(event: FormEvent) {
    event.preventDefault()
    if (!editDraft.geometry) return
    setPending(true)
    setError('')
    try {
      await updateSite(id, { name: editDraft.name, geometry: editDraft.geometry })
      setEditing(false)
      setAttempt((value) => value + 1)
      onChanged('Site details updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update site.')
    } finally {
      setPending(false)
    }
  }

  async function removeSite() {
    if (!window.confirm(`Delete ${site!.name} and all observations? This cannot be undone.`)) return
    setPending(true)
    try {
      await deleteSite(id)
      onDeleted(site!.project_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete site.')
      setPending(false)
    }
  }

  async function addObservation(event: FormEvent) {
    event.preventDefault()
    setPending(true)
    setError('')
    try {
      if (editingObservationId) {
        await updateObservation(editingObservationId, observation)
      } else {
        await createObservation(id, observation)
      }
      setObserving(false)
      setEditingObservationId(undefined)
      setAttempt((value) => value + 1)
      onChanged(editingObservationId ? 'Observation updated.' : 'Observation recorded.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to record observation.')
    } finally {
      setPending(false)
    }
  }

  function beginObservationEdit(point: SiteDetail['series'][number]) {
    if (!point.id) return
    setObservation({
      observed_on: point.date,
      carbon_tco2e: point.carbon,
      biodiversity_index: point.biodiversity,
      restoration_progress: point.progress,
    })
    setEditingObservationId(point.id)
    setObserving(true)
  }

  async function removeObservation(observationId: string) {
    if (!window.confirm('Delete this field observation? This cannot be undone.')) return
    setPending(true)
    setError('')
    try {
      await deleteObservation(observationId)
      setAttempt((value) => value + 1)
      onChanged('Observation deleted.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete observation.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="detail-view">
      <button className="back-button" onClick={() => back(site.project_id)}>
        <ArrowLeft size={16} /> Back to project
      </button>
      <div className="detail-title">
        <div>
          <span className="eyebrow">{site.project}</span>
          <h1>{site.name}</h1>
          <p>Site-level carbon and habitat performance measured over time.</p>
        </div>
        <div className="detail-actions">
          <button
            className="primary"
            onClick={() => {
              setEditingObservationId(undefined)
              setObservation({
                observed_on: new Date().toISOString().slice(0, 10),
                carbon_tco2e: 0,
                biodiversity_index: 50,
                restoration_progress: 0,
              })
              setObserving((value) => !value)
            }}
          >
            <Plus size={15} /> Add observation
          </button>
          <button
            className="secondary"
            onClick={() => {
              setEditDraft({ name: site.name, geometry: site.geometry })
              setEditing(true)
            }}
          >
            <Edit3 size={15} /> Edit site
          </button>
          <button className="secondary danger" disabled={pending} onClick={removeSite}>
            <Trash2 size={15} /> Delete
          </button>
        </div>
      </div>
      {observing && (
        <form className="edit-panel" onSubmit={addObservation}>
          <div className="section-heading">
            <h3>{editingObservationId ? 'Edit field observation' : 'Record field observation'}</h3>
            <button
              type="button"
              onClick={() => {
                setObserving(false)
                setEditingObservationId(undefined)
              }}
            >
              <X size={16} /> Close
            </button>
          </div>
          <div className="form-grid observation-grid">
            <label>
              Observation date
              <input
                type="date"
                required
                value={observation.observed_on}
                onChange={(event) =>
                  setObservation({ ...observation, observed_on: event.target.value })
                }
              />
            </label>
            <label>
              Carbon (tCO₂e)
              <input
                type="number"
                min="0"
                step="any"
                required
                value={observation.carbon_tco2e}
                onChange={(event) =>
                  setObservation({ ...observation, carbon_tco2e: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Biodiversity (/100)
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                required
                value={observation.biodiversity_index}
                onChange={(event) =>
                  setObservation({ ...observation, biodiversity_index: Number(event.target.value) })
                }
              />
            </label>
            <label>
              Restoration (%)
              <input
                type="number"
                min="0"
                max="100"
                step="any"
                required
                value={observation.restoration_progress}
                onChange={(event) =>
                  setObservation({
                    ...observation,
                    restoration_progress: Number(event.target.value),
                  })
                }
              />
            </label>
          </div>
          <button className="primary" disabled={pending}>
            {pending ? 'Saving…' : editingObservationId ? 'Save observation' : 'Record observation'}
          </button>
        </form>
      )}
      {editing && (
        <form className="edit-panel" onSubmit={saveSite}>
          <div className="section-heading">
            <h3>Edit site</h3>
            <button type="button" onClick={() => setEditing(false)}>
              <X size={16} /> Close
            </button>
          </div>
          <label className="field-label">
            Site name
            <input
              required
              minLength={2}
              maxLength={180}
              value={editDraft.name}
              onChange={(event) => setEditDraft({ ...editDraft, name: event.target.value })}
            />
          </label>
          <PolygonEditor
            value={editDraft.geometry}
            onChange={(geometry) => setEditDraft({ ...editDraft, geometry })}
          />
          <button className="primary" disabled={pending || !editDraft.geometry}>
            <Save size={15} /> {pending ? 'Saving…' : 'Save site'}
          </button>
        </form>
      )}
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
          health={site.health}
          biodiversity={site.biodiversity_index}
          progress={site.progress}
        />
      </div>
      <AnalyticsCharts id={site.id} series={site.series} />
      {site.series.length > 0 && (
        <section className="observation-history">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Source measurements</span>
              <h3>Observation history</h3>
            </div>
          </div>
          <div className="observation-table">
            {site.series.map((point) => (
              <div className="observation-row" key={point.id ?? point.date}>
                <strong>{new Date(`${point.date}T00:00:00`).toLocaleDateString()}</strong>
                <span>{point.carbon.toLocaleString()} tCO₂e</span>
                <span>{point.biodiversity}/100 biodiversity</span>
                <span>{point.progress}% restored</span>
                <div>
                  <button
                    className="icon-button"
                    type="button"
                    onClick={() => beginObservationEdit(point)}
                    disabled={!point.id}
                    aria-label={`Edit observation from ${point.date}`}
                  >
                    <Edit3 size={15} />
                  </button>
                  <button
                    className="icon-button danger"
                    type="button"
                    onClick={() => point.id && removeObservation(point.id)}
                    disabled={!point.id || pending}
                    aria-label={`Delete observation from ${point.date}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
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
  const [health, setHealth] = useState<HealthStatus>()
  const [healthError, setHealthError] = useState('')
  const [healthPending, setHealthPending] = useState(false)
  const [countryFilter, setCountryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [portfolio, setPortfolio] = useState<PortfolioAnalytics>()

  const checkHealth = useCallback(async () => {
    setHealthPending(true)
    setHealthError('')
    try {
      setHealth(await getHealth())
    } catch (err) {
      setHealth(undefined)
      setHealthError(err instanceof Error ? err.message : 'Health check failed.')
    } finally {
      setHealthPending(false)
    }
  }, [])

  useEffect(() => {
    if (section !== 'settings') return
    const timer = window.setTimeout(() => void checkHealth(), 0)
    return () => window.clearTimeout(timer)
  }, [checkHealth, section])

  useEffect(() => {
    if (section !== 'analytics') return
    let active = true
    getPortfolioAnalytics()
      .then((data) => active && setPortfolio(data))
      .catch(() => active && setPortfolio({ projects }))
    return () => {
      active = false
    }
  }, [projects, section])

  const analyticsSource = portfolio?.projects ?? projects
  const countries = useMemo(
    () => Array.from(new Set(analyticsSource.map((project) => project.country))).sort(),
    [analyticsSource],
  )
  const analyticsProjects = useMemo(
    () =>
      analyticsSource.filter(
        (project) =>
          (countryFilter === 'all' || project.country === countryFilter) &&
          (statusFilter === 'all' || project.status === statusFilter),
      ),
    [analyticsSource, countryFilter, statusFilter],
  )

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
        <div className="settings-card" aria-live="polite">
          <strong>API health</strong>
          {healthPending && <span className="status-neutral">Checking…</span>}
          {!healthPending && health && <span className="status-good">{health.status}</span>}
          {!healthPending && healthError && <span className="status-bad">Unavailable</span>}
          <p>
            {health
              ? `${health.service || 'Darukaa API'} responded successfully${health.database ? `; database is ${health.database}` : ''}.`
              : healthError || 'Checking the live service status.'}
          </p>
          <button className="secondary" disabled={healthPending} onClick={checkHealth}>
            <Activity size={15} /> Check again
          </button>
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
        <div className="analytics-filters" aria-label="Portfolio analytics filters">
          <label>
            Country
            <select
              value={countryFilter}
              onChange={(event) => setCountryFilter(event.target.value)}
            >
              <option value="all">All countries</option>
              {countries.map((country) => (
                <option key={country}>{country}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="planning">Planning</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </label>
          <span>
            {analyticsProjects.length} of {analyticsSource.length} projects
          </span>
        </div>
        {portfolio?.totals && analyticsSource.length > 0 && (
          <section className="portfolio-stats analytics-totals">
            <Metric
              label="Protected area"
              value={compact.format(portfolio.totals.area_ha)}
              suffix=" ha"
            />
            <Metric
              label="Carbon impact"
              value={compact.format(portfolio.totals.carbon_tco2e)}
              suffix=" tCO₂e"
            />
            <Metric
              label="Biodiversity index"
              value={`${portfolio.totals.biodiversity_index}`}
              suffix="/100"
            />
            <Metric
              label="Restoration"
              value={`${portfolio.totals.restoration_progress}`}
              suffix="%"
            />
          </section>
        )}
        {analyticsSource.length ? (
          <div className="analytics-directory">
            {analyticsProjects.map((project) => (
              <button key={project.id} onClick={() => openProject(project.id)}>
                <span>
                  <strong>{project.name}</strong>
                  <small>
                    {project.country} · {project.status}
                  </small>
                </span>
                <b>
                  {project.health}
                  <small>/100 health</small>
                </b>
                <div
                  className="analytics-bars"
                  aria-label={`${project.name}: health ${project.health}, biodiversity ${project.biodiversity_index}, restoration ${project.progress} percent`}
                >
                  <i>
                    <span style={{ width: `${project.health}%` }} />
                  </i>
                  <i>
                    <span style={{ width: `${project.biodiversity_index}%` }} />
                  </i>
                  <i>
                    <span style={{ width: `${project.progress}%` }} />
                  </i>
                </div>
                <small>Health · Biodiversity · Restoration</small>
              </button>
            ))}
            {analyticsProjects.length === 0 && (
              <div className="state-panel">
                <Search size={24} />
                <h3>No projects match</h3>
                <p>Change the country or status filters.</p>
              </div>
            )}
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

type DraftSite = { key: string; name: string; geometry?: PolygonGeometry }

function newDraftSite(index: number): DraftSite {
  return { key: crypto.randomUUID(), name: `Site ${String(index).padStart(2, '0')}` }
}

function CreateWizard({
  close,
  onCreated,
}: {
  close: () => void
  onCreated: (projectId: string, projectName: string) => void
}) {
  const [step, setStep] = useState(1)
  const [draft, setDraft] = useState({
    name: '',
    country: '',
    description: '',
    carbon_target: 100000,
    sites: [newDraftSite(1)],
  })
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit() {
    setPending(true)
    setError('')
    try {
      const result = await createProject({
        name: draft.name,
        country: draft.country,
        description: draft.description,
        carbon_target: draft.carbon_target,
        sites: draft.sites.map((site) => ({ name: site.name, geometry: site.geometry! })),
      })
      setStep(4)
      onCreated(result.id, draft.name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create project')
    } finally {
      setPending(false)
    }
  }

  const projectValid =
    draft.name.trim().length >= 3 && draft.country.trim().length >= 2 && draft.carbon_target > 0
  const sitesValid =
    draft.sites.length > 0 &&
    draft.sites.every((site) => site.name.trim().length >= 2 && site.geometry)
  const canContinue = step === 1 ? projectValid : step === 2 ? Boolean(sitesValid) : true

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-project-title"
    >
      <div className="wizard">
        <header>
          <div>
            <span className="eyebrow">New project</span>
            <h2 id="create-project-title">Define a landscape</h2>
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
              <h3>Tell us about the project</h3>
              <div className="form-grid">
                <label>
                  Project name
                  <input
                    id="project-name"
                    name="projectName"
                    autoComplete="off"
                    value={draft.name}
                    placeholder="Atlantic Forest Recovery"
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </label>
                <label>
                  Country
                  <input
                    id="project-country"
                    name="country"
                    autoComplete="country-name"
                    value={draft.country}
                    placeholder="Brazil"
                    onChange={(e) => setDraft({ ...draft, country: e.target.value })}
                  />
                </label>
                <label className="full">
                  Purpose
                  <textarea
                    id="project-purpose"
                    name="description"
                    value={draft.description}
                    placeholder="Restore fragmented habitat and measure long-term carbon sequestration."
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </label>
                <label>
                  Carbon target (tCO₂e)
                  <input
                    type="number"
                    min="1"
                    required
                    value={draft.carbon_target}
                    onChange={(e) => setDraft({ ...draft, carbon_target: Number(e.target.value) })}
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
              <div className="section-heading">
                <div>
                  <h3>Map project sites</h3>
                  <p>Draw exact boundaries or enter valid GeoJSON. Area is computed server-side.</p>
                </div>
                <button
                  className="secondary"
                  type="button"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      sites: [...draft.sites, newDraftSite(draft.sites.length + 1)],
                    })
                  }
                >
                  <Plus size={15} /> Add another site
                </button>
              </div>
              <div className="draft-sites">
                {draft.sites.map((site, index) => (
                  <section className="draft-site" key={site.key}>
                    <div className="draft-site-title">
                      <strong>Site {index + 1}</strong>
                      {draft.sites.length > 1 && (
                        <button
                          type="button"
                          className="text-link danger"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              sites: draft.sites.filter((item) => item.key !== site.key),
                            })
                          }
                        >
                          <Trash2 size={14} /> Remove site
                        </button>
                      )}
                    </div>
                    <label className="field-label">
                      Site name
                      <input
                        required
                        minLength={2}
                        maxLength={180}
                        value={site.name}
                        onChange={(event) =>
                          setDraft({
                            ...draft,
                            sites: draft.sites.map((item) =>
                              item.key === site.key ? { ...item, name: event.target.value } : item,
                            ),
                          })
                        }
                      />
                    </label>
                    <PolygonEditor
                      label={`${site.name || `Site ${index + 1}`} boundary`}
                      value={site.geometry}
                      onChange={(geometry) =>
                        setDraft({
                          ...draft,
                          sites: draft.sites.map((item) =>
                            item.key === site.key ? { ...item, geometry } : item,
                          ),
                        })
                      }
                    />
                  </section>
                ))}
              </div>
              {!sitesValid && (
                <p className="form-hint">Every site needs a name and a valid closed polygon.</p>
              )}
            </div>
          )}
          {step === 3 && (
            <div className="review-step">
              <Sparkles />
              <span className="eyebrow">Ready for review</span>
              <h3>{draft.name}</h3>
              <p>
                {draft.country} · {draft.sites.length} geographical{' '}
                {draft.sites.length === 1 ? 'site' : 'sites'} ·{' '}
                {compact.format(draft.carbon_target)} tCO₂e target
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
  const [userName, setUserName] = useState('')
  const [sessionChecked, setSessionChecked] = useState(() => !readSession())
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
    const session = readSession()
    if (!session) return
    getMe()
      .then((user) => setUserName(user.name))
      .catch(() => {
        clearSession()
        setUserName('')
      })
      .finally(() => setSessionChecked(true))
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

  const visible = useMemo(() => {
    const term = query.toLowerCase()
    const siteProjectIds = new Set(
      sites
        .filter((site) =>
          `${site.properties.name} ${site.properties.project}`.toLowerCase().includes(term),
        )
        .map((site) => site.properties.project_id),
    )
    return projects.filter(
      (project) =>
        `${project.name} ${project.country}`.toLowerCase().includes(term) ||
        siteProjectIds.has(project.id),
    )
  }, [projects, query, sites])

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

  if (!sessionChecked) {
    return <LoadingState label="Verifying your session" />
  }

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
          {location.pathname === '/' ? (
            <div className="search">
              <Search size={16} />
              <input
                id="project-search"
                name="projectSearch"
                aria-label="Search projects, sites and regions"
                autoComplete="off"
                placeholder="Search projects, sites, regions…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
          ) : (
            <div className="topbar-spacer" />
          )}
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
            onChanged={(message) => {
              reload()
              setToast({ kind: 'success', message })
            }}
            onDeleted={() => {
              reload()
              navigate('/projects')
              setToast({ kind: 'success', message: 'Project deleted.' })
            }}
          />
        )}
        {routeFound && !error && !loading && siteMatch?.params.id && (
          <SiteView
            key={siteMatch.params.id}
            id={siteMatch.params.id}
            back={(projectId) => navigate(`/projects/${projectId}`)}
            onChanged={(message) => {
              reload()
              setToast({ kind: 'success', message })
            }}
            onDeleted={(projectId) => {
              reload()
              navigate(`/projects/${projectId}`)
              setToast({ kind: 'success', message: 'Site deleted.' })
            }}
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
                <div>Loaded from the live project API</div>
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
