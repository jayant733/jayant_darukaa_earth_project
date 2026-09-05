import { waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  apiUrl,
  clearSession,
  getHealth,
  getProjects,
  login,
  readSession,
  saveSession,
  type Session,
} from '../src/api'

const session: Session = {
  access_token: 'test-token',
  user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
}

describe('session storage', () => {
  it('round-trips and clears a session', () => {
    saveSession(session)
    expect(readSession()).toEqual(session)

    clearSession()
    expect(readSession()).toBeNull()
  })

  it('returns null for malformed stored data', () => {
    localStorage.setItem('darukaa.session', '{not-json')
    expect(readSession()).toBeNull()
  })
})

describe('API requests', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    vi.stubGlobal('fetch', fetchMock)
  })

  it('posts login credentials to the configured API', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(session), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(login('test@example.com', 'secret')).resolves.toEqual(session)
    expect(fetchMock).toHaveBeenCalledWith(
      `${apiUrl}/auth/login`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com', password: 'secret' }),
        headers: { 'Content-Type': 'application/json' },
      }),
    )
  })

  it('adds the bearer token for authenticated requests', async () => {
    saveSession(session)
    fetchMock.mockResolvedValue(
      new Response('[]', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await getProjects()
    expect(fetchMock).toHaveBeenCalledWith(
      `${apiUrl}/projects`,
      expect.objectContaining({
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-token',
        },
      }),
    )
  })

  it('clears expired sessions and emits an unauthorized event', async () => {
    saveSession(session)
    const onUnauthorized = vi.fn()
    window.addEventListener('darukaa:unauthorized', onUnauthorized, { once: true })
    fetchMock.mockResolvedValue(new Response(null, { status: 401 }))

    await expect(getProjects()).rejects.toThrow('Your session expired. Sign in again.')
    expect(readSession()).toBeNull()
    await waitFor(() => expect(onUnauthorized).toHaveBeenCalledOnce())
  })

  it('surfaces validation details from the API', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ detail: [{ msg: 'Email is invalid' }] }), {
        status: 422,
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    await expect(login('invalid', 'secret')).rejects.toThrow('Email is invalid')
  })

  it('combines process health and database readiness', async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'healthy', service: 'darukaa-api' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ status: 'ready', database: 'reachable' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    await expect(getHealth()).resolves.toMatchObject({
      status: 'ready',
      service: 'darukaa-api',
      database: 'reachable',
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
