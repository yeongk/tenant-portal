import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useNhtsaMakes, useNhtsaModels, useNhtsaEngines } from '../hooks/useNhtsa'

const emptyV = () => ({ year: '', makeId: '', make: '', model: '', engine: '', plate: '', vin: '', nickname: '' })

// ── Single vehicle row with cascading NHTSA dropdowns ─────────────────────────
function VRow({ v, i, onChange, onRemove }) {
  const set = (k, val) => onChange(i, { ...v, [k]: val })

  const { makes, loading: makesLoading } = useNhtsaMakes()
  const { models, loading: modelsLoading } = useNhtsaModels(v.make)
  const { engines, loading: enginesLoading } = useNhtsaEngines(v.makeId, v.year)

  const handleMakeChange = (e) => {
    const selected = makes.find(m => m.name === e.target.value)
    onChange(i, { ...v, make: e.target.value, makeId: selected?.id ?? '', model: '', engine: '' })
  }

  const handleModelChange = (e) => {
    onChange(i, { ...v, model: e.target.value, engine: '' })
  }

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
        {/* Year — free text; drives engine lookup */}
        <div className="fg">
          <label>Year</label>
          <input
            value={v.year}
            onChange={e => set('year', e.target.value)}
            placeholder="1973"
            maxLength={4}
          />
        </div>

        {/* Make — NHTSA dropdown */}
        <div className="fg">
          <label>Make {makesLoading && <span style={{ fontSize: 11, color: 'var(--muted)' }}>loading…</span>}</label>
          <select value={v.make} onChange={handleMakeChange} disabled={makesLoading}>
            <option value="">Select…</option>
            {makes.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Model — cascades from Make */}
        <div className="fg">
          <label>Model {modelsLoading && <span style={{ fontSize: 11, color: 'var(--muted)' }}>loading…</span>}</label>
          <select value={v.model} onChange={handleModelChange} disabled={!v.make || modelsLoading}>
            <option value="">Select…</option>
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Engine — cascades from Make + Year */}
        <div className="fg">
          <label>
            Engine {enginesLoading && <span style={{ fontSize: 11, color: 'var(--muted)' }}>loading…</span>}
          </label>
          <select value={v.engine} onChange={e => set('engine', e.target.value)} disabled={!v.makeId || !v.year || enginesLoading}>
            <option value="">Select…</option>
            {engines.map(eng => (
              <option key={eng} value={eng}>{eng}</option>
            ))}
            {/* Always allow a manual fallback */}
            {!enginesLoading && engines.length > 0 && <option value="Other">Other</option>}
          </select>
        </div>

        <div className="fg">
          <label>License Plate</label>
          <input value={v.plate} onChange={e => set('plate', e.target.value)} />
        </div>

        <div className="fg">
          <label>VIN</label>
          <input value={v.vin} onChange={e => set('vin', e.target.value)} />
        </div>
      </div>

      <div className="fg">
        <label>Nickname</label>
        <input value={v.nickname} onChange={e => set('nickname', e.target.value)} placeholder="The Grey Ghost" />
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

  const sf = (k, v) => setF(x => ({ ...x, [k]: v }))
  const upV = (i, v) => setV(vs => vs.map((x, j) => j === i ? v : x))
  const rmV = (i) => setV(vs => vs.filter((_, j) => j !== i))

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true)
    // Strip internal makeId before sending to API
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
          <div className="fg"><label>Full Name</label><input value={f.full_name} onChange={e => sf('full_name', e.target.value)} required /></div>
          <div className="fg"><label>Email</label><input type="email" value={f.email} onChange={e => sf('email', e.target.value)} required /></div>
          <div className="fg"><label>Phone</label><input value={f.phone} onChange={e => sf('phone', e.target.value)} /></div>

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
            <input type="checkbox" id="cl" checked={cl} onChange={e => setCl(e.target.checked)} style={{ width: 'auto' }} />
            <label htmlFor="cl" style={{ fontWeight: 400, cursor: 'pointer' }}>Create portal login for this customer</label>
          </div>

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Saving…' : 'Add Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function Customers() {
  const { get } = useApi()
  const toast = useToast()
  const [customers, setC] = useState([])
  const [loading, setL] = useState(true)
  const [modal, setModal] = useState(false)

  const load = () => {
    setL(true)
    get('/customers')
      .then(d => setC(d.items ?? []))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setL(false))
  }

  useEffect(load, [])

  return (
    <div>
      {modal && <Modal onClose={() => setModal(false)} onDone={() => { setModal(false); load() }} />}
      <div className="ph">
        <h1>Customers</h1>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Customer</button>
      </div>
      <div className="card">
        {loading ? <div className="spinner" /> : customers.length === 0 ? (
          <div className="empty"><strong>No customers yet</strong>Add your first customer.</div>
        ) : (
          <table>
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Vehicles</th></tr></thead>
            <tbody>
              {customers.map(c => (
                <tr key={c.customer_id}>
                  <td style={{ fontWeight: 500 }}>{c.full_name}</td>
                  <td>{c.email}</td>
                  <td>{c.phone || '—'}</td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                    {(c.vehicles ?? [])
                      .map(v => `${v.year || ''} ${v.make || ''} ${v.model || ''}`.trim())
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
