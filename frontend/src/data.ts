export type Project = {
  id: string
  name: string
  country: string
  status: 'Active' | 'Planning'
  area: number
  carbon: number
  biodiversity: number
  progress: number
  health: number
  coordinates: [number, number]
  polygon: [number, number][]
  series: { year: string; carbon: number; biodiversity: number }[]
}

const years = ['2022', '2023', '2024', '2025', '2026']

function series(carbon: number, biodiversity: number) {
  return years.map((year, index) => ({
    year,
    carbon: Math.round(carbon * (0.36 + index * 0.16)),
    biodiversity: Math.round((biodiversity - 15 + index * 3.75) * 10) / 10,
  }))
}

function polygon(lng: number, lat: number): [number, number][] {
  return [
    [lng - 2.3, lat - 1.2],
    [lng + 1.8, lat - 1.4],
    [lng + 2.6, lat + 1.1],
    [lng - 1.2, lat + 1.8],
    [lng - 2.3, lat - 1.2],
  ]
}

export const projects: Project[] = [
  {
    id: 'amazon',
    name: 'Amazon Canopy Recovery',
    country: 'Brazil',
    status: 'Active',
    area: 12450,
    carbon: 184290,
    biodiversity: 88,
    progress: 78,
    health: 87,
    coordinates: [-62.22, -3.46],
    polygon: polygon(-62.22, -3.46),
    series: series(184290, 88),
  },
  {
    id: 'sundarbans',
    name: 'Sundarbans Blue Carbon',
    country: 'Bangladesh',
    status: 'Active',
    area: 8940,
    carbon: 92450,
    biodiversity: 81,
    progress: 74,
    health: 82,
    coordinates: [89.18, 21.95],
    polygon: polygon(89.18, 21.95),
    series: series(92450, 81),
  },
  {
    id: 'congo',
    name: 'Congo Basin Corridors',
    country: 'DR Congo',
    status: 'Active',
    area: 18120,
    carbon: 147800,
    biodiversity: 76,
    progress: 69,
    health: 78,
    coordinates: [22.05, -0.68],
    polygon: polygon(22.05, -0.68),
    series: series(147800, 76),
  },
  {
    id: 'mau',
    name: 'Mau Forest Watershed',
    country: 'Kenya',
    status: 'Active',
    area: 7360,
    carbon: 68900,
    biodiversity: 84,
    progress: 82,
    health: 85,
    coordinates: [35.58, -0.55],
    polygon: polygon(35.58, -0.55),
    series: series(68900, 84),
  },
  {
    id: 'borneo',
    name: 'Borneo Peatland Renewal',
    country: 'Indonesia',
    status: 'Active',
    area: 10220,
    carbon: 110200,
    biodiversity: 79,
    progress: 71,
    health: 80,
    coordinates: [114.46, 0.95],
    polygon: polygon(114.46, 0.95),
    series: series(110200, 79),
  },
  {
    id: 'sierra',
    name: 'Sierra Meadow Resilience',
    country: 'United States',
    status: 'Planning',
    area: 4840,
    carbon: 44600,
    biodiversity: 73,
    progress: 54,
    health: 68,
    coordinates: [-120.1, 38.71],
    polygon: polygon(-120.1, 38.71),
    series: series(44600, 73),
  },
]
