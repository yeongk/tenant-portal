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
 *   Engines : GET /vehicles/GetModelsForMakeIdYear/makeId/{makeId}/modelyear/{year}/vehicletype/car?format=json
 *             → returns engine descriptions per variant (ElectromotiveForce, DisplacementCC, etc.)
 *             We pull EngineConfiguration + DisplacementL fields and deduplicate.
 */

import { useState, useEffect } from 'react'

const BASE = 'https://vpic.nhtsa.dot.gov/api'

// ── Module-level in-memory cache ──────────────────────────────────────────────
const cache = new Map()

async function nhtsaFetch(url) {
  if (cache.has(url)) return cache.get(url)
  // Return pending promise so concurrent callers share the same inflight request
  const promise = fetch(url)
    .then(r => { if (!r.ok) throw new Error(`NHTSA ${r.status}`); return r.json() })
    .then(d => d.Results ?? [])
    .catch(err => { cache.delete(url); throw err })
  cache.set(url, promise)
  return promise
}

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
      .catch(() => {}) // silently degrade; user can still type
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [])

  return { makes, loading }
}

// ── Models (depend on make name) ───────────────────────────────────────────────
export function useNhtsaModels(makeName) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!makeName) { setModels([]); return }
    let live = true
    setLoading(true)
    const encoded = encodeURIComponent(makeName)
    nhtsaFetch(`${BASE}/vehicles/GetModelsForMake/${encoded}?format=json`)
      .then(results => {
        if (!live) return
        const sorted = [...new Set(results.map(r => r.Model_Name))].sort()
        setModels(sorted)
      })
      .catch(() => {})
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [makeName])

  return { models, loading }
}

// ── Engines (depend on makeId + year) ──────────────────────────────────────────
// NHTSA doesn't have a dedicated engine endpoint; we use GetModelsForMakeIdYear
// which returns vehicle variants with engine fields: EngineConfiguration,
// DisplacementL, FuelTypePrimary. We combine them into readable strings.
export function useNhtsaEngines(makeId, year) {
  const [engines, setEngines] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!makeId || !year || String(year).length !== 4) { setEngines([]); return }
    let live = true
    setLoading(true)
    const url = `${BASE}/vehicles/GetModelsForMakeIdYear/makeId/${makeId}/modelyear/${year}/vehicletype/car?format=json`
    nhtsaFetch(url)
      .then(results => {
        if (!live) return
        const set = new Set()
        results.forEach(r => {
          const cfg  = r.EngineConfiguration  || ''
          const disp = r.DisplacementL ? `${parseFloat(r.DisplacementL).toFixed(1)}L` : ''
          const fuel = r.FuelTypePrimary || ''
          const label = [cfg, disp, fuel].filter(Boolean).join(' ').trim()
          if (label) set.add(label)
        })
        setEngines([...set].sort())
      })
      .catch(() => {})
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [makeId, year])

  return { engines, loading }
}
