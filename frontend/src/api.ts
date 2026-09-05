export type ProjectSummary = {
  id: string
  name: string
  country: string
  description: string
  status: string
  carbon_target: number
  site_count: number
  area_ha: number
  carbon_tco2e: number
  biodiversity_index: number
  progress: number
  health: number
}

export type SeriesPoint = {
  id?: string
  date: string
  carbon: number
  biodiversity: number
  progress: number
}

export type ProjectDetail = ProjectSummary & { series: SeriesPoint[] }

export type SiteFeature = {
  type: 'Feature'
  id: string
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  properties: {
    id: string
    name: string
    project_id: string
    project: string
    status: string
    area_ha: number
    health?: number
  }
}

export type SiteCollection = { type: 'FeatureCollection'; features: SiteFeature[] }

export type SiteDetail = {
  id: string
  name: string
  area_ha: number
  project_id: string
  project: string
  geometry: { type: 'Polygon'; coordinates: [number, number][][] }
  carbon_tco2e: number
  biodiversity_index: number
  progress: number
  health: number
  series: SeriesPoint[]
}

export type Session = { access_token: string; user: { id?: string; name: string; email: string } }

export type PolygonGeometry = { type: 'Polygon'; coordinates: [number, number][][] }
export type ProjectStatus = 'planning' | 'active' | 'completed'
export type HealthStatus = {
  status: string
  service?: string
  database?: string
  checked_at?: string
}
export type Observation = {
  id: string
  site_id: string
  observed_on: string
  carbon_tco2e: number
  biodiversity_index: number
  restoration_progress: number
}
export type ObservationInput = Omit<Observation, 'id' | 'site_id'>
export type PortfolioAnalytics = {
  projects: ProjectSummary[]
  totals?: {
    area_ha: number
    carbon_tco2e: number
    biodiversity_index: number
    restoration_progress: number
  }
}

const SESSION_KEY = 'darukaa.session'

export const apiUrl = (import.meta.env.VITE_API_URL as string) || 'http://127.0.0.1:18765/api'

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as Session) : null
  } catch {
    return null
  }
}

export function saveSession(session: Session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
}

const REQUEST_TIMEOUT_MS = 15_000

function friendlyError(status: number, detail?: unknown) {
  if (status === 400 || status === 422) {
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return (
        detail
          .map((issue) => issue?.msg)
          .filter(Boolean)
          .join('. ') || 'Check the form and try again.'
      )
    }
    return 'Check the information you entered and try again.'
  }
  if (status === 403) return 'You do not have permission to complete this action.'
  if (status === 404) return 'The requested item could not be found.'
  if (status === 409) return typeof detail === 'string' ? detail : 'This item already exists.'
  if (status >= 500) return 'Darukaa is temporarily unavailable. Please try again shortly.'
  return 'We could not complete that request. Please try again.'
}

async function request<T>(path: string, init: RequestInit = {}, baseUrl = apiUrl): Promise<T> {
  const session = readSession()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...init.headers,
      },
    })
    if (response.status === 401) {
      clearSession()
      if (session) window.dispatchEvent(new Event('darukaa:unauthorized'))
      throw new Error(
        session ? 'Your session expired. Sign in again.' : 'Email or password is incorrect.',
      )
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      throw new Error(friendlyError(response.status, body?.detail))
    }
    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('The request took too long. Check your connection and try again.')
    }
    if (error instanceof TypeError) {
      throw new Error('Darukaa cannot reach the server. Check your connection and try again.')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export function login(email: string, password: string) {
  return request<Session>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export function register(name: string, email: string, password: string) {
  return request<Session>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, email, password }),
  })
}

export const getMe = () => request<Session['user']>('/auth/me')
export const getProjects = () => request<ProjectSummary[]>('/projects')
export const getProject = (id: string) => request<ProjectDetail>(`/projects/${id}`)
export const getSites = () => request<SiteCollection>('/sites')
export const getSite = (id: string) => request<SiteDetail>(`/sites/${id}`)
export async function getHealth(): Promise<HealthStatus> {
  const origin = apiUrl.replace(/\/api\/?$/, '')
  const [health, ready] = await Promise.all([
    request<HealthStatus>('/health', {}, origin),
    request<HealthStatus>('/ready', {}, origin),
  ])
  return { ...health, ...ready }
}

export const getPortfolioAnalytics = () => request<PortfolioAnalytics>('/analytics/portfolio')

export type NewProject = {
  name: string
  country: string
  description: string
  carbon_target?: number
  sites: { name: string; geometry: PolygonGeometry }[]
}

export function createProject(payload: NewProject) {
  return request<{ id: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ ...payload, status: 'planning' }),
  })
}

export function updateProject(
  id: string,
  payload: Partial<Pick<NewProject, 'name' | 'country' | 'description' | 'carbon_target'>> & {
    status?: ProjectStatus
  },
) {
  return request<ProjectDetail>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteProject(id: string) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' })
}

export function createSite(
  projectId: string,
  payload: { name: string; geometry: PolygonGeometry },
) {
  return request<{ id: string; message: string }>(`/projects/${projectId}/sites`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateSite(
  id: string,
  payload: Partial<{ name: string; project_id: string; geometry: PolygonGeometry }>,
) {
  return request<SiteDetail>(`/sites/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteSite(id: string) {
  return request<void>(`/sites/${id}`, { method: 'DELETE' })
}

export function createObservation(siteId: string, payload: ObservationInput) {
  return request<Observation>(`/sites/${siteId}/observations`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export function updateObservation(id: string, payload: Partial<ObservationInput>) {
  return request<Observation>(`/observations/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
}

export function deleteObservation(id: string) {
  return request<void>(`/observations/${id}`, { method: 'DELETE' })
}
