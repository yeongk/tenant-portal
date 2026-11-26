/**
 * useNhtsa.js
 * -----------
 * Vehicle pickers for the Year → Make → Model → Engine dropdowns.
 *
 * Makes and models come straight from the NHTSA vPIC public API. All vPIC
 * fetch results are cached in a module-level Map — one fetch per unique URL
 * across all component instances and re-renders.
 *
 * Engines come from our own backend (fastapi-sam GET /api/vehicle/engines),
 * which asks EPA's FuelEconomy.gov for the engines offered for that
 * year/make/model and caches the answer in DynamoDB. vPIC itself has no
 * engine data on its make/model endpoints. EPA covers model years 1984 on;
 * for older vehicles, anything EPA doesn't list, or when the lookup fails,
 * the hook falls back to the static curated list (ENGINE_OPTIONS), which
 * covers every layout a restoration shop will realistically encounter.
 * The form always offers "Other" with a free-text field for engine swaps.
 *
 * Endpoints used:
 *   Makes  : GET /vehicles/GetMakesForVehicleType/car?format=json
 *   Models : GET /vehicles/GetModelsForMakeYear/make/{make}/modelyear/{year}?format=json
 *            (falls back to GetModelsForMake/{make} when no year is chosen,
 *            or when vPIC has no models on file for that year — common for
 *            pre-1981 classics)
 *   Engines: GET {VITE_API_URL}/api/vehicle/engines?year=&make=&model=
 */

import { useState, useEffect } from 'react'
import { useApi } from './useApi'

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
// Curated for high-end / classic / exotic restoration shops — the fallback
// when EPA has nothing for the vehicle. Grouped by layout for easy scanning.
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

// "Other" is not a list entry of its own in the form: choosing it opens a
// free-text field, and whatever is typed there is what gets saved.
export const OTHER_ENGINE = 'Other'
const CURATED_ENGINES = ENGINE_OPTIONS.filter(e => e !== OTHER_ENGINE)

// FuelEconomy.gov has no data before this model year.
export const EPA_FIRST_YEAR = 1984

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

// ── Models (cascade from make name, filtered by year when one is chosen) ──────
const uniqueSorted = results => [...new Set(results.map(r => r.Model_Name).filter(Boolean))].sort()

export function useNhtsaModels(makeName, year) {
  const [models, setModels] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!makeName) { setModels([]); return }
    let live = true
    setLoading(true)
    const make = encodeURIComponent(makeName)
    const allYears = `${BASE}/vehicles/GetModelsForMake/${make}?format=json`
    const load = year
      ? nhtsaFetch(`${BASE}/vehicles/GetModelsForMakeYear/make/${make}/modelyear/${encodeURIComponent(year)}?format=json`)
          .then(results => (results.length ? results : nhtsaFetch(allYears)))
      : nhtsaFetch(allYears)
    load
      .then(results => { if (live) setModels(uniqueSorted(results)) })
      .catch(() => { if (live) setModels([]) })
      .finally(() => live && setLoading(false))
    return () => { live = false }
  }, [makeName, year])

  return { models, loading }
}

// ── Engines (EPA via our backend, curated list as fallback) ───────────────────
// Cached per year/make/model for the life of the page, like the vPIC calls.
const engineCache = new Map()

/**
 * Engine choices for a vehicle.
 *   options  — engine labels for the dropdown (never includes "Other")
 *   source   — 'epa' when the list came from FuelEconomy.gov, else 'curated'
 *   details  — the EPA option objects (cylinders, displacement_l, turbo,
 *              models, transmissions …) keyed by label; empty for 'curated'
 *   loading  — true while the backend lookup is in flight
 *   resolvedFor — `${year}|${make}|${model}` the options belong to, so a
 *              caller can tell a stale list from the one for its inputs
 */
const engineKey = (year, make, model) => `${year ?? ''}|${make ?? ''}|${model ?? ''}`

const wantsEpa = (year, make, model) => {
  const yr = Number(year)
  return !!(yr && make && model && yr >= EPA_FIRST_YEAR)
}

export function useEngineOptions(year, make, model) {
  const { get } = useApi()
  // Start in "loading" when a lookup is about to run, so a saved EPA label
  // isn't briefly treated as a free-text "Other" engine on first render.
  const [state, setState] = useState(() => {
    const epa = wantsEpa(year, make, model)
    return {
      options: CURATED_ENGINES, source: 'curated', details: {}, loading: epa,
      resolvedFor: epa ? null : engineKey(year, make, model),
    }
  })

  useEffect(() => {
    const yr = Number(year)
    const resolvedFor = engineKey(year, make, model)
    const curated = { options: CURATED_ENGINES, source: 'curated', details: {}, loading: false, resolvedFor }
    if (!wantsEpa(year, make, model)) {
      setState(curated)
      return
    }
    let live = true
    const key = `${yr}|${make.toLowerCase()}|${model.toLowerCase()}`
    if (!engineCache.has(key)) {
      const qs = new URLSearchParams({ year: String(yr), make, model })
      const p = get(`/vehicle/engines?${qs}`).catch(err => { engineCache.delete(key); throw err })
      engineCache.set(key, p)
    }
    setState(s => ({ ...s, loading: true }))
    engineCache.get(key)
      .then(res => {
        if (!live) return
        const epa = (res?.options ?? []).filter(o => o?.label)
        if (res?.source === 'epa' && epa.length) {
          setState({
            options: epa.map(o => o.label),
            source: 'epa',
            details: Object.fromEntries(epa.map(o => [o.label, o])),
            loading: false,
            resolvedFor,
          })
        } else {
          setState(curated)
        }
      })
      .catch(() => {
        if (live) setState(curated)
      })
    return () => { live = false }
  }, [year, make, model, get])

  return state
}

/**
 * The entry in an engine list that a decoded VIN engine (GET
 * /api/vehicle/decode/{vin} → engine) stands for, or null when none does.
 *   EPA list:     same cylinders and displacement (±0.05 L); turbo breaks ties.
 *   curated list: the layout, e.g. "Flat-6", "Inline-4", "V8".
 */
export function matchVinEngine(vinEngine, { options, source, details }) {
  if (!vinEngine) return null
  if (vinEngine.label === 'Electric' && options.includes('Electric')) return 'Electric'
  if (source !== 'epa') {
    return vinEngine.layout && options.includes(vinEngine.layout) ? vinEngine.layout : null
  }
  const { cylinders, displacement_l: displ } = vinEngine
  if (!cylinders || !displ) return null
  const same = options.filter(label => {
    const d = details[label]
    return d && d.cylinders === cylinders && d.displacement_l != null
      && Math.abs(d.displacement_l - displ) < 0.05
  })
  if (same.length <= 1) return same[0] ?? null
  const turbo = !!vinEngine.turbo
  return same.find(label => !!details[label].turbo === turbo) ?? same[0]
}
