import { useEffect, useRef, useState } from 'react'
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

export function MapPanel({ sites, focused, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markersRef = useRef<mapboxgl.Marker[]>([])
  const sitesRef = useRef(sites)
  const selectRef = useRef(onSelect)
  const configuredToken = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined
  const token = configuredToken?.startsWith('pk.') ? configuredToken : undefined
  const [mapFailed, setMapFailed] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  useEffect(() => {
    sitesRef.current = sites
    selectRef.current = onSelect
  }, [onSelect, sites])

  useEffect(() => {
    if (!container.current || !token || mapFailed) return
    let map: mapboxgl.Map
    try {
      mapboxgl.accessToken = token
      map = new mapboxgl.Map({
        container: container.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: [18, 8],
        zoom: 1.35,
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
      mapRef.current = map
      setMapReady(true)
      map.addSource('sites', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: sitesRef.current },
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
      map.on('click', 'site-fill', (event) => {
        const feature = event.features?.[0] as unknown as
          { properties?: { id?: string } } | undefined
        const match = sitesRef.current.find(
          (site) => site.properties.id === feature?.properties?.id,
        )
        if (match) selectRef.current?.(match)
      })
      map.on('mouseenter', 'site-fill', () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', 'site-fill', () => {
        map.getCanvas().style.cursor = ''
      })
    })
    return () => {
      map.off('error', failGracefully)
      markersRef.current.forEach((marker) => marker.remove())
      markersRef.current = []
      map.remove()
      mapRef.current = null
    }
  }, [mapFailed, token])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    const source = map.getSource('sites') as mapboxgl.GeoJSONSource | undefined
    source?.setData({ type: 'FeatureCollection', features: sites })
    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = sites.map((site) => {
      const el = document.createElement('button')
      el.className = 'map-marker'
      el.type = 'button'
      el.setAttribute('aria-label', `Open ${site.properties.name}`)
      el.onclick = () => selectRef.current?.(site)
      const popup = document.createElement('div')
      const title = document.createElement('strong')
      const details = document.createElement('span')
      title.textContent = site.properties.project
      details.textContent = `${site.properties.name} · ${site.properties.area_ha.toLocaleString()} ha`
      popup.append(title, details)
      return new mapboxgl.Marker({ element: el })
        .setLngLat(centroid(site.geometry))
        .setPopup(new mapboxgl.Popup({ offset: 20, closeButton: false }).setDOMContent(popup))
        .addTo(map)
    })
  }, [mapReady, sites])

  useEffect(() => {
    const map = mapRef.current
    if (!mapReady || !map) return
    if (focused) {
      const bounds = new mapboxgl.LngLatBounds()
      focused.coordinates[0].forEach((point) => bounds.extend(point))
      map.fitBounds(bounds, { padding: 56, maxZoom: 14 })
    } else if (sites.length) {
      const bounds = new mapboxgl.LngLatBounds()
      sites.forEach((site) => site.geometry.coordinates[0].forEach((point) => bounds.extend(point)))
      map.fitBounds(bounds, { padding: 56, maxZoom: 8 })
    }
  }, [focused, mapReady, sites])

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

  return (
    <div className="map-fallback map-unavailable" role="status">
      <MapIcon />
      <strong>{sites.length ? 'Map imagery unavailable' : 'No sites to display'}</strong>
      <span>
        {sites.length
          ? token
            ? 'Mapbox could not load. Site data remains available below.'
            : 'Add VITE_MAPBOX_TOKEN to view exact site boundaries.'
          : 'Create a project and draw its first exact boundary.'}
      </span>
    </div>
  )
}
