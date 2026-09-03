import { useEffect, useMemo, useRef, useState } from 'react'
import { Map as MapIcon } from 'lucide-react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import type { SiteFeature } from './api'

type Props = {
  sites: SiteFeature[]
  focused?: SiteFeature['geometry']
  onSelect?: (site: SiteFeature) => void
}

function centroid(geometry: SiteFeature['geometry']): [number, number] {
  const ring = geometry.coordinates[0]
  const total = ring.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), {
    lng: 0,
    lat: 0,
  })
  return [total.lng / ring.length, total.lat / ring.length]
}

function projectRing(ring: [number, number][]) {
  const lngs = ring.map(([lng]) => lng)
  const lats = ring.map(([, lat]) => lat)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  return ring
    .map(([lng, lat]) => {
      const x = ((lng - minLng) / (maxLng - minLng || 1)) * 100
      const y = (1 - (lat - minLat) / (maxLat - minLat || 1)) * 100
      return `${x},${y}`
    })
    .join(' ')
}

export function MapPanel({ sites, focused, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const configuredToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const token = configuredToken?.startsWith('pk.') ? configuredToken : undefined
  const [mapFailed, setMapFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const center = useMemo<[number, number]>(() => (focused ? centroid(focused) : [18, 8]), [focused])

  useEffect(() => {
    if (!container.current || !token || mapFailed) return
    let map: mapboxgl.Map
    try {
      mapboxgl.accessToken = token
      map = new mapboxgl.Map({
        container: container.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center,
        zoom: focused ? 6.4 : 1.35,
        projection: 'mercator',
        attributionControl: false,
      })
    } catch {
      queueMicrotask(() => setMapFailed(true))
      return
    }
    const failGracefully = () => setMapFailed(true)
    map.once('error', failGracefully)
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }))
    map.on('load', () => {
      setMapReady(true)
      map.addSource('sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: sites },
      })
      map.addLayer({
        id: 'site-fill',
        type: 'fill',
        source: 'sites',
        paint: { 'fill-color': '#b9ff67', 'fill-opacity': 0.22 },
      })
      map.addLayer({
        id: 'site-line',
        type: 'line',
        source: 'sites',
        paint: { 'line-color': '#d5ff95', 'line-width': 1.6 },
      })
      if (!onSelect) return
      map.on('click', 'site-fill', (event) => {
        const feature = event.features?.[0] as unknown as
          { properties?: { id?: string } } | undefined
        const match = sites.find((site) => site.properties.id === feature?.properties?.id)
        if (match) onSelect(match)
      })
      map.on('mouseenter', 'site-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'site-fill', () => {
        map.getCanvas().style.cursor = ''
      })
      sites.forEach((site) => {
        const el = document.createElement('button')
        el.className = 'map-marker'
        el.setAttribute('aria-label', `Open ${site.properties.name}`)
        el.onclick = () => onSelect(site)
        const popup = document.createElement('div')
        const title = document.createElement('strong')
        const details = document.createElement('span')
        title.textContent = site.properties.project
        details.textContent = `${site.properties.name} · ${site.properties.area_ha.toLocaleString()} ha`
        popup.append(title, details)
        new mapboxgl.Marker({ element: el })
          .setLngLat(centroid(site.geometry))
          .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setDOMContent(popup))
          .addTo(map)
      })
    })
    return () => {
      map.off('error', failGracefully)
      map.remove()
    }
  }, [center, focused, mapFailed, onSelect, sites, token])

  if (token && !mapFailed) {
    return (
      <div className="mapbox-wrap">
        <div className="mapbox-container" ref={container} />
        {!mapReady && (
          <div className="map-loading" role="status">
            <span />
            Loading satellite map…
          </div>
        )}
      </div>
    )
  }

  if (focused) {
    const [lng, lat] = center
    return (
      <div className="map-fallback site-map" aria-label="Simplified site boundary map">
        <div className="map-grid" />
        <svg className="site-polygon" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={projectRing(focused.coordinates[0])} />
        </svg>
        <div className="site-map-label">
          <span>Site boundary</span>
          {lat.toFixed(2)}°, {lng.toFixed(2)}°
        </div>
        <div className="map-token-note">
          <span>Basic map mode</span>
          Satellite imagery is temporarily unavailable
        </div>
      </div>
    )
  }

  return (
    <div className="map-fallback" aria-label="Simplified project map">
      <div className="map-grid" />
      <div className="continent c1" />
      <div className="continent c2" />
      <div className="continent c3" />
      {sites.length === 0 && (
        <div className="map-empty">
          <MapIcon />
          <strong>No sites to display</strong>
          <span>Create a project and draw its first boundary.</span>
        </div>
      )}
      {sites.map((site) => {
        const [lng, lat] = centroid(site.geometry)
        return (
          <button
            className="fallback-pin"
            key={site.properties.id}
            style={{ left: `${((lng + 180) / 360) * 100}%`, top: `${((90 - lat) / 180) * 100}%` }}
            onClick={() => onSelect?.(site)}
            aria-label={`Open ${site.properties.name}`}
          >
            <span>
              {site.properties.project}
              <small>{site.properties.name}</small>
            </span>
          </button>
        )
      })}
      <div className="map-token-note">
        <span>Basic map mode</span>
        Satellite imagery is temporarily unavailable
      </div>
    </div>
  )
}
