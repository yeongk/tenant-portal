/**
 * useNhtsa.js
 * -----------
 * Wrapper around the NHTSA vPIC public API for Make and Model data.
 * All fetch results are cached in a module-level Map — one fetch per
 * unique URL across all component instances and re-renders.
 *
 * Engine data is NOT sourced from NHTSA. The vPIC endpoint
 * (GetModelsForMakeIdYear) returns null for EngineCylinders /
 * DisplacementCC / FuelTypePrimary on the vast majority of records.
 * Engine options are instead provided as a static curated list
 * (ENGINE_OPTIONS) that covers every configuration a restoration shop
 * will realistically encounter.
 *
 * Endpoints used:
 *   Makes  : GET /vehicles/GetMakesForVehicleType/car?format=json
 *   Models : GET /vehicles/GetModelsForMake/{make}?format=json
 */

import { useState, useEffect } from 'react'

const BASE = 'https://vpic.nhtsa.dot.gov/api'

// ── Module-level in-memory cache ──────────────────────────────────────────────
const cache = new Map()

async function nhtsaFetch(url) {
  if (cache.has(url)) return cache.get(url)
  const promise = fetch(url)
    .then(r => { if (!r.ok) throw new Error(`NHTSA ${r.status}`); return r.json() })
    .then(d => d.Results ?? [])
    .catch(err => { cache.delete(url); throw err })
  cache.set(url, promise)
  return promise
}

// ── Year list (current year → 1900) ───────────────────────────────────────────
const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 1900 + 1 },
  (_, i) => String(CURRENT_YEAR - i)
)

// ── Static engine options ─────────────────────────────────────────────────────
// Curated for high-end / classic / exotic restoration shops.
// Grouped by layout then displacement for easy scanning.
export const ENGINE_OPTIONS = [
  // Flat / Boxer
  'Flat-2 (Boxing Twin)',
  'Flat-4',
  'Flat-6',
  'Flat-8',
  // Inline
  'Inline-3',
  'Inline-4',
  'Inline-5',
  'Inline-6',
  'Inline-8',
  // V configurations
  'V6',
  'V8',
  'V10',
  'V12',
  'V16',
  // Rotary
  'Rotary (Single Rotor)',
  'Rotary (Twin Rotor)',
  'Rotary (Triple Rotor)',
  // Electric / Hybrid
  'Electric (Single Motor)',
  'Electric (Dual Motor)',
  'Electric (Tri Motor)',
  'Hybrid – Inline-4',
  'Hybrid – V6',
  'Hybrid – V8',
  // Other
  'Other',
]

// ── Makes ─────────────────────────────────────────────────────────────────────
export function useNhtsaMakes() {
  const [makes, setMakes] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let live = true
    setLoading(true)
    nhtsaFetch(`${BASE}/vehicles/GetMakesForVehicleType/car?format=json`)
      .then(results => {
        if (!live) return
        const sorted = results
          .map(r => ({ id: r.MakeId, name: r.MakeName }))
          .sort((a, b) => a.name.localeCompare(b.name))
        setMakes(sorted)
      })
      .catch(() => {})
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [])

  return { makes, loading }
}

// ── Models (cascade from make name) ───────────────────────────────────────────
export function useNhtsaModels(makeName) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!makeName) { setModels([]); return }
    let live = true
    setLoading(true)
    nhtsaFetch(`${BASE}/vehicles/GetModelsForMake/${encodeURIComponent(makeName)}?format=json`)
      .then(results => {
        if (!live) return
        setModels([...new Set(results.map(r => r.Model_Name))].sort())
      })
      .catch(() => {})
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [makeName])

  return { models, loading }
}
