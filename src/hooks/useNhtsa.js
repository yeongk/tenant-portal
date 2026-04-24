/**
 * useNhtsa.js
 * -----------
 * Thin wrapper around the NHTSA vPIC public API.
 * All results are cached in a module-level Map so repeated renders
 * (or multiple VRow instances) never re-fetch the same data.
 *
 * Endpoints used:
 *   Makes   : GET /vehicles/GetMakesForVehicleType/car?format=json
 *   Models  : GET /vehicles/GetModelsForMake/{make}?format=json
 *   Engines : GET /vehicles/GetModelsForMakeIdYear/makeId/{id}/modelyear/{yr}/vehicletype/car?format=json
 *             Fields used: EngineCylinders, DisplacementCC, FuelTypePrimary
 *             (EngineConfiguration / DisplacementL are sparsely populated;
 *              EngineCylinders + DisplacementCC are far more reliable.)
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

// ── Year list (current year → 1900) — pure computation, no fetch needed ───────
const CURRENT_YEAR = new Date().getFullYear()
export const YEAR_OPTIONS = Array.from(
  { length: CURRENT_YEAR - 1900 + 1 },
  (_, i) => String(CURRENT_YEAR - i)
)

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

// ── Engines (cascade from makeId + year) ───────────────────────────────────────
// Strategy: call GetModelsForMakeIdYear which returns one record per model
// variant. Each record may carry EngineCylinders, DisplacementCC, and
// FuelTypePrimary. We build a human-readable label from those three fields
// (e.g. "6-cyl 3500cc Gasoline") and deduplicate across all variants.
// Falls back to FuelTypePrimary-only labels when cylinder/displacement are null.
export function useNhtsaEngines(makeId, year) {
  const [engines, setEngines] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!makeId || !year) { setEngines([]); return }
    let live = true
    setLoading(true)
    const url =
      `${BASE}/vehicles/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}/vehicletype/car?format=json`
    nhtsaFetch(url)
      .then(results => {
        if (!live) return

        const labelSet = new Set()

        results.forEach(r => {
          const cyl  = r.EngineCylinders ? `${r.EngineCylinders}-cyl` : ''
          const cc   = r.DisplacementCC  ? `${Math.round(Number(r.DisplacementCC))}cc` : ''
          const fuel = r.FuelTypePrimary || ''

          // Build a label from whatever fields are available
          const parts = [cyl, cc, fuel].filter(Boolean)
          if (parts.length > 0) labelSet.add(parts.join(' '))
        })

        // If NHTSA returned records but all engine fields were null,
        // surface at least the fuel types to give the user something.
        if (labelSet.size === 0 && results.length > 0) {
          results.forEach(r => {
            if (r.FuelTypePrimary) labelSet.add(r.FuelTypePrimary)
          })
        }

        setEngines([...labelSet].sort())
      })
      .catch(() => {})
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [makeId, year])

  return { engines, loading }
}
