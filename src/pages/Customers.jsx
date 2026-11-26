import React, { useEffect, useRef, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import {
  YEAR_OPTIONS,
  OTHER_ENGINE,
  useNhtsaMakes,
  useNhtsaModels,
  useEngineOptions,
  matchVinEngine,
} from '../hooks/useNhtsa'

// Select value for the "Other (type it in)" choice. Never saved: the typed
// text is what goes into vehicle.engine.
const OTHER_VALUE = '__other__'

// A 17-character VIN (1981 on): letters and digits, no I, O or Q.
const VIN_RE = /^[A-HJ-NPR-Z0-9]{17}$/i

// Fields a VIN decode can fill, in the order the preview lists them.
const VIN_FIELDS = [
  ['year',   'Year'],
  ['make',   'Make'],
  ['model',  'Model'],
  ['engine', 'Engine'],
]

// vPIC answers ErrorCode "0" for a clean decode; any other code is a
// warning worth showing (e.g. "1 - Check Digit (9th position) does not calculate properly").
const vinWarning = (r) => {
  const code = String(r.error_code ?? '').split(',')[0].trim()
  return code && code !== '0' ? r.error_text : null
}

const emptyV = () => ({
  year: '', makeId: '', make: '', model: '', engine: '',
  plate: '', vin: '', nickname: '',
})

// ── VIN decode preview / result, shown under a vehicle row ──────────────────
function VinDecodePanel({ state, current, onToggle, onApply, onCancel }) {
  if (state.status === 'idle' || state.status === 'loading') return null

  const box = {
    border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px',
    marginBottom: 8, fontSize: 13, background: 'var(--bg)',
  }
  const muted = { color: 'var(--muted)' }

  if (state.status === 'error') {
    return (
      <div style={{ ...box, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ color: 'var(--danger)' }}>{state.message}</span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>Dismiss</button>
      </div>
    )
  }

  if (state.status === 'applied') {
    return (
      <div style={{ ...box, ...muted }}>
        {state.filled.length
          ? `Filled in from the VIN: ${state.filled.join(', ')}. Review, then save.`
          : 'Nothing was changed.'}
      </div>
    )
  }

  // preview
  const { result: r, proposed, changes, picked } = state
  const about = [r.trim, r.series, r.body_class, r.drive_type, r.transmission].filter(Boolean)
  const warning = vinWarning(r)
  const anyPicked = changes.some(k => picked[k])

  return (
    <div style={box}>
      <div style={{ marginBottom: 6 }}>
        <strong>NHTSA: {[r.year, r.make, r.model].filter(Boolean).join(' ') || 'decoded'}</strong>
        {about.length > 0 && <span style={muted}> · {about.join(' · ')}</span>}
      </div>
      {warning && (
        <div style={{ color: 'var(--danger)', marginBottom: 6 }}>{warning}</div>
      )}
      {changes.length === 0 ? (
        <div style={{ ...muted, marginBottom: 6 }}>The VIN matches what's entered — nothing to change.</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
          <thead>
            <tr style={{ ...muted, textAlign: 'left', fontSize: 12 }}>
              <th style={{ width: 24 }} />
              <th>Field</th>
              <th>Now</th>
              <th>From VIN</th>
            </tr>
          </thead>
          <tbody>
            {VIN_FIELDS.filter(([k]) => changes.includes(k)).map(([k, label]) => (
              <tr key={k} style={{ borderTop: '1px solid var(--border)' }}>
                <td>
                  <input
                    type="checkbox"
                    checked={!!picked[k]}
                    onChange={() => onToggle(k)}
                    aria-label={`Use ${label} from the VIN`}
                  />
                </td>
                <td>{label}</td>
                <td style={muted}>{current[k] || '—'}</td>
                <td>
                  <strong>{proposed[k]}</strong>
                  {k === 'engine' && (
                    <div style={{ ...muted, fontSize: 11 }}>
                      matched to the engine list when it has this engine
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onCancel}>
          {changes.length ? 'Cancel' : 'Close'}
        </button>
        {changes.length > 0 && (
          <button type="button" className="btn btn-primary btn-sm" onClick={onApply} disabled={!anyPicked}>
            Apply selected
          </button>
        )}
      </div>
    </div>
  )
}

// ── Single vehicle row ─────────────────────────────────────────────────────────
function VRow({ v, i, onChange, onRemove }) {
  const set = (k, val) => onChange(i, { ...v, [k]: val })

  const { get } = useApi()
  const { makes, loading: makesLoading }   = useNhtsaMakes()
  const { models, loading: modelsLoading } = useNhtsaModels(v.make, v.year)
  const engines = useEngineOptions(v.year, v.make, v.model)
  const {
    options: engineOptions, source: engineSource, loading: enginesLoading,
  } = engines

  // A saved make that isn't in vPIC's car list (e.g. one a VIN decode filled
  // in for a truck or motorcycle maker) still shows as chosen.
  const makeChoices = v.make && makes.length && !makes.some(m => m.name === v.make)
    ? [{ id: `saved-${v.make}`, name: v.make }, ...makes]
    : makes

  // A saved model that vPIC doesn't list for this year still shows as chosen.
  const modelChoices = v.model && !models.includes(v.model) ? [v.model, ...models] : models

  // "Other" is chosen when the user picked it, or when the saved engine isn't
  // in the current list (a swap typed in earlier, or a value from the generic
  // list on a vehicle EPA now has engines for) — so nothing saved is hidden.
  const [otherPicked, setOtherPicked] = useState(false)
  const engineIsOther = otherPicked || (!enginesLoading && !!v.engine && !engineOptions.includes(v.engine))
  const otherInput = useRef(null)

  // Year and model now narrow the lists below them, so changing either
  // clears what depended on it (as changing the make already did).
  const handleYearChange = (e) => {
    setOtherPicked(false)
    onChange(i, { ...v, year: e.target.value, model: '', engine: '' })
  }

  const handleMakeChange = (e) => {
    const selected = makes.find(m => m.name === e.target.value)
    setOtherPicked(false)
    onChange(i, { ...v, make: e.target.value, makeId: selected?.id ?? '', model: '', engine: '' })
  }

  const handleModelChange = (e) => {
    setOtherPicked(false)
    onChange(i, { ...v, model: e.target.value, engine: '' })
  }

  // ── VIN decode (fastapi-sam GET /api/vehicle/decode/{vin} → NHTSA vPIC) ──
  //   idle | loading | preview (proposed changes, a checkbox each) | applied | error
  const [vinDecode, setVinDecode] = useState({ status: 'idle' })
  // After Apply, the decoded engine is matched to an entry in the engine
  // list once that list has loaded for the new year/make/model.
  const [pendingEngine, setPendingEngine] = useState(null)
  const vinReady = VIN_RE.test((v.vin ?? '').trim())

  const handleVinChange = (e) => {
    if (vinDecode.status !== 'idle') setVinDecode({ status: 'idle' })
    set('vin', e.target.value)
  }

  const decodeVin = async () => {
    const vin = v.vin.trim().toUpperCase()
    setVinDecode({ status: 'loading' })
    try {
      const r = await get(`/vehicle/decode/${encodeURIComponent(vin)}`)
      if (!r.decoded) {
        setVinDecode({ status: 'error', message: `NHTSA couldn't decode this VIN${r.error_text ? `: ${r.error_text}` : '.'}` })
        return
      }
      const make = r.make
        ? makes.find(m => m.name.toLowerCase() === r.make.toLowerCase()) ?? { id: '', name: r.make }
        : null
      const proposed = {
        year:   r.year ? String(r.year) : '',
        make:   make?.name ?? '',
        makeId: make?.id ?? '',
        model:  r.model ?? '',
        engine: r.engine?.label ?? '',
      }
      const changes = VIN_FIELDS
        .map(([k]) => k)
        .filter(k => proposed[k] && proposed[k] !== (v[k] ?? ''))
      setVinDecode({
        status: 'preview', vin, result: r, proposed, changes,
        picked: Object.fromEntries(changes.map(k => [k, true])),
      })
    } catch (err) {
      setVinDecode({ status: 'error', message: err.message || 'VIN decode failed' })
    }
  }

  const togglePicked = (k) =>
    setVinDecode(d => ({ ...d, picked: { ...d.picked, [k]: !d.picked[k] } }))

  const applyVinDecode = () => {
    const { proposed, picked, result, vin } = vinDecode
    const next = { ...v, vin }
    for (const [k] of VIN_FIELDS) {
      if (picked[k]) next[k] = proposed[k]
    }
    if (picked.make) next.makeId = proposed.makeId
    // Same cascade as the dropdowns: a new year or make clears the model and
    // engine, and a new model clears the engine, unless those came from the
    // VIN too.
    const yearOrMake = (picked.year && proposed.year !== v.year) || (picked.make && proposed.make !== v.make)
    if (yearOrMake && !picked.model) next.model = ''
    if ((yearOrMake || (picked.model && proposed.model !== v.model)) && !picked.engine) next.engine = ''
    setOtherPicked(false)
    setPendingEngine(picked.engine
      ? { key: `${next.year}|${next.make}|${next.model}`, engine: result.engine }
      : null)
    onChange(i, next)
    const filled = VIN_FIELDS.filter(([k]) => picked[k]).map(([, label]) => label.toLowerCase())
    setVinDecode({ status: 'applied', filled })
  }

  useEffect(() => {
    if (!pendingEngine) return
    const key = `${v.year}|${v.make}|${v.model}`
    if (pendingEngine.key !== key) { setPendingEngine(null); return }   // edited since
    if (engines.loading || engines.resolvedFor !== key) return            // list not ready yet
    const match = matchVinEngine(pendingEngine.engine, engines)
    setPendingEngine(null)
    if (match && match !== v.engine) onChange(i, { ...v, engine: match })
  }, [pendingEngine, engines, v, i, onChange])

  const handleEngineChange = (e) => {
    if (e.target.value === OTHER_VALUE) {
      setOtherPicked(true)
      set('engine', '')
      setTimeout(() => otherInput.current?.focus(), 0)
    } else {
      setOtherPicked(false)
      set('engine', e.target.value)
    }
  }

  const Loading = () => (
    <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>loading…</span>
  )

  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <strong style={{ fontSize: 13 }}>Vehicle {i + 1}</strong>
        {i > 0 && (
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: 13 }}
            onClick={() => onRemove(i)}
          >
            Remove
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>

        {/* Year — dropdown, current year → 1900 */}
        <div className="fg">
          <label>Year</label>
          <select value={v.year} onChange={handleYearChange}>
            <option value="">Select…</option>
            {YEAR_OPTIONS.map(yr => (
              <option key={yr} value={yr}>{yr}</option>
            ))}
          </select>
        </div>

        {/* Make — NHTSA dropdown */}
        <div className="fg">
          <label>Make {makesLoading && <Loading />}</label>
          <select value={v.make} onChange={handleMakeChange} disabled={makesLoading}>
            <option value="">Select…</option>
            {makeChoices.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Model — cascades from Make (and Year) via NHTSA */}
        <div className="fg">
          <label>Model {modelsLoading && <Loading />}</label>
          <select value={v.model} onChange={handleModelChange} disabled={!v.make || modelsLoading}>
            <option value="">{!v.make ? 'Select Make first' : 'Select…'}</option>
            {modelChoices.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Engine — EPA's engines for this year/make/model when it has any,
            otherwise the curated list; "Other" opens a free-text field */}
        <div className="fg">
          <label>
            Engine{' '}
            {enginesLoading ? <Loading /> : (
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                {engineSource === 'epa' ? '· EPA list' : '· generic list'}
              </span>
            )}
          </label>
          <select
            value={engineIsOther ? OTHER_VALUE : v.engine}
            onChange={handleEngineChange}
            disabled={enginesLoading}
          >
            <option value="">Select…</option>
            {engineOptions.map(eng => (
              <option key={eng} value={eng}>{eng}</option>
            ))}
            <option value={OTHER_VALUE}>Other (type it in)…</option>
          </select>
          {engineIsOther && (
            <input
              ref={otherInput}
              style={{ marginTop: 6 }}
              value={v.engine === OTHER_ENGINE ? '' : v.engine}
              onChange={e => set('engine', e.target.value)}
              placeholder="e.g. 3.8 L Flat-6 (993 RS swap)"
              maxLength={120}
            />
          )}
        </div>

        <div className="fg">
          <label>License Plate</label>
          <input value={v.plate} onChange={e => set('plate', e.target.value)} />
        </div>

        <div className="fg">
          <label>VIN</label>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              style={{ flex: 1, minWidth: 0 }}
              value={v.vin}
              onChange={handleVinChange}
              onKeyDown={e => {
                // Enter decodes instead of submitting the customer form.
                if (e.key === 'Enter') { e.preventDefault(); if (vinReady) decodeVin() }
              }}
              maxLength={32}
              spellCheck={false}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={decodeVin}
              disabled={!vinReady || vinDecode.status === 'loading'}
              title={vinReady
                ? 'Look this VIN up with NHTSA and fill in year, make, model and engine'
                : 'Enter a 17-character VIN (1981 or later) to decode it'}
            >
              {vinDecode.status === 'loading' ? 'Decoding…' : 'Decode'}
            </button>
          </div>
        </div>

      </div>

      <VinDecodePanel
        state={vinDecode}
        current={v}
        onToggle={togglePicked}
        onApply={applyVinDecode}
        onCancel={() => setVinDecode({ status: 'idle' })}
      />

      <div className="fg">
        <label>Nickname</label>
        <input value={v.nickname} onChange={e => set('nickname', e.target.value)} placeholder="The Grey Ghost" />
      </div>
    </div>
  )
}

// ── Vehicle detail modal — read-only, opened via the hover "View" link ─────────
function VehicleDetailModal({ vehicle, onClose }) {
  const rows = [
    ['Nickname', vehicle.nickname],
    ['Year', vehicle.year],
    ['Make', vehicle.make],
    ['Model', vehicle.model],
    ['Engine', vehicle.engine],
    ['License Plate', vehicle.plate],
    ['VIN', vehicle.vin],
  ]
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-hd">
          <h2>Vehicle Detail</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div style={{ fontSize: 13, lineHeight: 2 }}>
          {rows.map(([label, val]) => (
            <div key={label} style={{
              display: 'flex', justifyContent: 'space-between',
              borderBottom: '1px solid var(--border)', padding: '4px 0',
            }}>
              <span style={{ color: 'var(--muted)' }}>{label}</span>
              <span style={{ fontWeight: 500 }}>{val || '—'}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
          <button className="btn btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Customer modal ─────────────────────────────────────────────────────────
function Modal({ onClose, onDone }) {
  const { post } = useApi()
  const toast = useToast()
  const [f, setF] = useState({ full_name: '', email: '', phone: '' })
  const [vehicles, setV] = useState([emptyV()])
  const [cl, setCl] = useState(true)
  const [loading, setLoading] = useState(false)

  const sf  = (k, val) => setF(x => ({ ...x, [k]: val }))
  const upV = (i, val) => setV(vs => vs.map((x, j) => j === i ? val : x))
  const rmV = (i)      => setV(vs => vs.filter((_, j) => j !== i))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    const vehiclesPayload = vehicles.map(({ makeId, ...rest }) => rest)
    try {
      await post('/customers', { ...f, vehicles: vehiclesPayload, create_login: cl })
      toast('Customer added')
      onDone()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <h2>Add Customer</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={submit}>
          <div className="fg">
            <label>Full Name</label>
            <input value={f.full_name} onChange={e => sf('full_name', e.target.value)} required />
          </div>
          <div className="fg">
            <label>Email</label>
            <input type="email" value={f.email} onChange={e => sf('email', e.target.value)} required />
          </div>
          <div className="fg">
            <label>Phone</label>
            <input value={f.phone} onChange={e => sf('phone', e.target.value)} />
          </div>

          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Vehicles</div>
          {vehicles.map((v, i) => (
            <VRow key={i} v={v} i={i} onChange={upV} onRemove={rmV} />
          ))}

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginBottom: 14 }}
            onClick={() => setV(vs => [...vs, emptyV()])}
          >
            + Add Vehicle
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <input
              type="checkbox" id="cl" checked={cl}
              onChange={e => setCl(e.target.checked)}
              style={{ width: 'auto' }}
            />
            <label htmlFor="cl" style={{ fontWeight: 400, cursor: 'pointer' }}>
              Create portal login for this customer
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving…' : 'Add Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Customers() {
  const { get, patch } = useApi()
  const toast = useToast()
  const { cogGroup } = useAuth()
  const canManage = cogGroup === 'SHOP_ADMIN' || cogGroup === 'SUPERVISOR'
  const [customers, setC] = useState([])
  const [loading, setL] = useState(true)
  const [modal, setModal] = useState(false)
  const [viewVehicle, setViewVehicle] = useState(null)

  // Row-level edit — vehicles only. SHOP_ADMIN/SUPERVISOR only (server-enforced too).
  const [editingId, setEditingId] = useState(null)
  const [editVehicles, setEditVehicles] = useState([])
  const [saving, setSaving] = useState(false)

  const load = () => {
    setL(true)
    get('/customers')
      .then(d => setC(d.items ?? []))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setL(false))
  }

  useEffect(load, [])

  const startEdit = (c) => {
    setEditingId(c.customer_id)
    setEditVehicles((c.vehicles ?? []).map(v => ({ ...v })))
  }
  const cancelEdit = () => { setEditingId(null); setEditVehicles([]) }
  const upV = (i, val) => setEditVehicles(vs => vs.map((x, j) => j === i ? val : x))
  const rmV = (i)      => setEditVehicles(vs => vs.filter((_, j) => j !== i))
  const saveEdit = async (id) => {
    setSaving(true)
    try {
      const payload = editVehicles.map(({ makeId, ...rest }) => rest)
      await patch(`/customers/${id}`, { vehicles: payload })
      toast('Customer updated')
      setEditingId(null)
      load()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      {modal && <Modal onClose={() => setModal(false)} onDone={() => { setModal(false); load() }} />}
      {viewVehicle && <VehicleDetailModal vehicle={viewVehicle} onClose={() => setViewVehicle(null)} />}

      <div className="ph">
        <h1>Customers</h1>
        {canManage && <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Customer</button>}
      </div>
      <div className="card">
        {loading ? <div className="spinner" /> : customers.length === 0 ? (
          <div className="empty"><strong>No customers yet</strong>Add your first customer.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Phone</th><th>Vehicles</th>
                {canManage && <th></th>}
              </tr>
            </thead>
            <tbody>
              {customers.map(c => {
                const editing = editingId === c.customer_id
                return (
                  <React.Fragment key={c.customer_id}>
                    <tr>
                      <td style={{ fontWeight: 500 }}>{c.full_name}</td>
                      <td>{c.email}</td>
                      <td>{c.phone || '—'}</td>
                      <td className="vehicle-cell" style={{ color: 'var(--muted)', fontSize: 13 }}>
                        {editing ? (
                          <span>editing below…</span>
                        ) : (c.vehicles ?? []).length === 0 ? '—' : (
                          (c.vehicles ?? []).map((v, i) => (
                            <div key={v.vehicle_id ?? i} className="vehicle-row-hover">
                              <span>{`${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim() || 'Vehicle'}</span>
                              <a className="vehicle-view-link" onClick={() => setViewVehicle(v)}>View</a>
                            </div>
                          ))
                        )}
                      </td>
                      {canManage && (
                        <td>
                          {!editing && (
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(c)}>Edit</button>
                          )}
                        </td>
                      )}
                    </tr>
                    {editing && (
                      <tr>
                        <td colSpan={canManage ? 5 : 4} style={{ background: 'var(--bg)' }}>
                          <div style={{ fontWeight: 500, fontSize: 13, marginBottom: 8 }}>Edit Vehicles</div>
                          {editVehicles.map((v, i) => (
                            <VRow key={i} v={v} i={i} onChange={upV} onRemove={rmV} />
                          ))}
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
                            <button type="button" className="btn btn-secondary btn-sm"
                              onClick={() => setEditVehicles(vs => [...vs, emptyV()])}>
                              + Add Vehicle
                            </button>
                            <div style={{ flex: 1 }} />
                            <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                            <button className="btn btn-primary btn-sm" disabled={saving}
                              onClick={() => saveEdit(c.customer_id)}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
