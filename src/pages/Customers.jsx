import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import {
  YEAR_OPTIONS,
  ENGINE_OPTIONS,
  useNhtsaMakes,
  useNhtsaModels,
} from '../hooks/useNhtsa'

const emptyV = () => ({
  year: '', makeId: '', make: '', model: '', engine: '',
  plate: '', vin: '', nickname: '',
})

// ── Single vehicle row ─────────────────────────────────────────────────────────
function VRow({ v, i, onChange, onRemove }) {
  const set = (k, val) => onChange(i, { ...v, [k]: val })

  const { makes, loading: makesLoading }   = useNhtsaMakes()
  const { models, loading: modelsLoading } = useNhtsaModels(v.make)

  const handleYearChange = (e) => {
    onChange(i, { ...v, year: e.target.value })
  }

  const handleMakeChange = (e) => {
    const selected = makes.find(m => m.name === e.target.value)
    onChange(i, { ...v, make: e.target.value, makeId: selected?.id ?? '', model: '', engine: '' })
  }

  const handleModelChange = (e) => {
    onChange(i, { ...v, model: e.target.value })
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
            {makes.map(m => (
              <option key={m.id} value={m.name}>{m.name}</option>
            ))}
          </select>
        </div>

        {/* Model — cascades from Make via NHTSA */}
        <div className="fg">
          <label>Model {modelsLoading && <Loading />}</label>
          <select value={v.model} onChange={handleModelChange} disabled={!v.make || modelsLoading}>
            <option value="">{!v.make ? 'Select Make first' : 'Select…'}</option>
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>

        {/* Engine — static curated list, always available */}
        <div className="fg">
          <label>Engine</label>
          <select value={v.engine} onChange={e => set('engine', e.target.value)}>
            <option value="">Select…</option>
            {ENGINE_OPTIONS.map(eng => (
              <option key={eng} value={eng}>{eng}</option>
            ))}
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
