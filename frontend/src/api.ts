export type ProjectSummary = {
  id: string
  name: string
  country: string
  description: string
  status: string
  site_count: number
  area_ha: number
  carbon_tco2e: number
  biodiversity_index: number
  progress: number
  health: number
}

export type SeriesPoint = {
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
  series: SeriesPoint[]
}

export type Session = { access_token: string; user: { id?: string; name: string; email: string } }

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

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = readSession()
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...init.headers,
    },
  })
  if (response.status === 401) {
    clearSession()
    throw new Error('Your session expired. Sign in again.')
  }
  if (!response.ok) {
    const detail = await response.json().catch(() => null)
    throw new Error(detail?.detail ?? `Request failed (${response.status})`)
  }
  return (await response.json()) as T
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

export const getProjects = () => request<ProjectSummary[]>('/projects')
export const getProject = (id: string) => request<ProjectDetail>(`/projects/${id}`)
export const getSites = () => request<SiteCollection>('/sites')
export const getSite = (id: string) => request<SiteDetail>(`/sites/${id}`)

export type NewProject = {
  name: string
  country: string
  description: string
  sites: { name: string; geometry: { type: 'Polygon'; coordinates: number[][][] } }[]
}

export function createProject(payload: NewProject) {
  return request<{ id: string }>('/projects', {
    method: 'POST',
    body: JSON.stringify({ ...payload, status: 'planning' }),
  })
}
