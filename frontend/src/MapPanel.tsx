import { useEffect, useMemo, useRef } from 'react'
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
  const token = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const center = useMemo<[number, number]>(() => (focused ? centroid(focused) : [18, 8]), [focused])

  useEffect(() => {
    if (!container.current || !token) return
    mapboxgl.accessToken = token
    const map = new mapboxgl.Map({
      container: container.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center,
      zoom: focused ? 6.4 : 1.35,
      projection: 'mercator',
      attributionControl: false,
    })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-right')
    map.addControl(new mapboxgl.AttributionControl({ compact: true }))
    map.on('load', () => {
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
        new mapboxgl.Marker({ element: el })
          .setLngLat(centroid(site.geometry))
          .setPopup(
            new mapboxgl.Popup({ offset: 20, closeButton: false }).setHTML(
              `<strong>${site.properties.project}</strong><span>${site.properties.name} · ${site.properties.area_ha.toLocaleString()} ha</span>`,
            ),
          )
          .addTo(map)
      })
    })
    return () => map.remove()
  }, [center, focused, onSelect, sites, token])

  if (token) {
    return <div className="mapbox-container" ref={container} />
  }

  if (focused) {
    const [lng, lat] = center
    return (
      <div className="map-fallback site-map">
        <div className="map-grid" />
        <svg className="site-polygon" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon points={projectRing(focused.coordinates[0])} />
        </svg>
        <div className="site-map-label">
          <span>Site boundary</span>
          {lat.toFixed(2)}°, {lng.toFixed(2)}°
        </div>
      </div>
    )
  }

  return (
    <div className="map-fallback">
      <div className="map-grid" />
      <div className="continent c1" />
      <div className="continent c2" />
      <div className="continent c3" />
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
        <span>Mapbox preview mode</span>
        Add <code>VITE_MAPBOX_TOKEN</code> for satellite tiles
      </div>
    </div>
  )
}
