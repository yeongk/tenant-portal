import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

// ── Reference Data → Labor Rates ─────────────────────────────────────────────
//
// Hourly rates per worker designation (Reference Data → Worker Designation),
// optionally narrowed to a labor type (Reference Data → Labor Type) and/or an
// experience level, each effective from a date. The API returns rates in the
// shop's worker-designation order. A price change is a new
// rate with a later effective date, so past rates stay on record. Backend:
// fastapi-sam app/service/labor_rate.py, /api/labor-rates.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const fmtCents = (c) => usd.format((c ?? 0) / 100)
const toCents = (dollars) => Math.round(parseFloat(dollars) * 100)
const todayIso = () => {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

const STATUS_BADGE = {
  current:    <span className="badge badge-green">Current</span>,
  scheduled:  <span className="badge badge-blue">Scheduled</span>,
  superseded: <span className="badge badge-gray">Past</span>,
}

const smallInput = { padding: '4px 8px', fontSize: 13 }

// ── Add rate ──────────────────────────────────────────────────────────────────

function AddRateModal({ laborTypes, designations, levels, rates, onClose, onCreated }) {
  const { post } = useApi()
  const toast    = useToast()
  const [f, setF] = useState({
    worker_designation_code: designations[0]?.code ?? '',
    labor_type_code: '',
    experience_level: '',
    rate: '',
    effective_from: todayIso(),
    notes: '',
  })
  const [saving, setSaving] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  // The rate this one would follow, so the admin sees what they're replacing.
  const current = rates.find(r =>
    r.worker_designation_code === f.worker_designation_code &&
    (r.labor_type_code ?? '') === f.labor_type_code &&
    (r.experience_level ?? '') === f.experience_level &&
    r.status === 'current')

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      await post('/labor-rates', {
        worker_designation_code: f.worker_designation_code,
        labor_type_code: f.labor_type_code || null,
        experience_level: f.experience_level || null,
        rate_cents: toCents(f.rate),
        effective_from: f.effective_from,
        notes: f.notes || null,
      })
      onCreated()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <h2>Add labor rate</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="fg"><label>Worker designation</label>
            <select value={f.worker_designation_code} required
              onChange={e => set('worker_designation_code', e.target.value)}>
              {designations.map(d => <option key={d.code} value={d.code}>{d.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="fg" style={{ flex: 3 }}><label>Labor type</label>
              <select value={f.labor_type_code} onChange={e => set('labor_type_code', e.target.value)}>
                <option value="">All labor types</option>
                {laborTypes.map(t => <option key={t.code} value={t.code}>{t.name} ({t.code})</option>)}
              </select>
            </div>
            <div className="fg" style={{ flex: 2 }}><label>Experience level</label>
              <select value={f.experience_level} onChange={e => set('experience_level', e.target.value)}>
                <option value="">All levels</option>
                {levels.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6, marginBottom: 12 }}>
            Leave both as “All” for this designation’s general rate. When pricing work, the
            most specific matching rate is used.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="fg" style={{ flex: 1 }}><label>Hourly rate (USD)</label>
              <input type="number" min="0.01" step="0.01" value={f.rate} required
                onChange={e => set('rate', e.target.value)} placeholder="e.g. 165.00" />
            </div>
            <div className="fg" style={{ flex: 1 }}><label>Effective from</label>
              <input type="date" value={f.effective_from} required
                onChange={e => set('effective_from', e.target.value)} />
            </div>
          </div>
          {current && (
            <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: -6, marginBottom: 12 }}>
              Current rate is {fmtCents(current.rate_cents)} since {current.effective_from}.
              {f.effective_from > current.effective_from
                ? ` The new rate replaces it from ${f.effective_from}; the old rate stays on record.`
                : ' Pick a later date to replace it.'}
            </p>
          )}
          <div className="fg"><label>Notes</label>
            <input value={f.notes} maxLength={300} onChange={e => set('notes', e.target.value)}
              placeholder="Optional, e.g. 2027 price list" />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !f.worker_designation_code}>
              {saving ? 'Adding…' : 'Add rate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LaborRates() {
  const { get, patch, del } = useApi()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [rates,      setRates]      = useState([])
  const [levels,     setLevels]     = useState([])
  const [laborTypes, setLaborTypes] = useState([])
  const [designations, setDesignations] = useState([])
  const [loading,    setLoading]    = useState(true)
  const [adding,     setAdding]     = useState(false)
  const [typeFilter, setTypeFilter] = useState('')
  const [desigFilter, setDesigFilter] = useState('')
  const [showPast,   setShowPast]   = useState(false)

  const [editingId, setEditingId] = useState(null)
  const [editF,     setEditF]     = useState({})
  const [saving,    setSaving]    = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([get('/labor-rates'), get('/reference/labor-types'),
                 get('/reference/worker-designations')])
      .then(([r, lt, wd]) => {
        setRates(r.items ?? [])
        setLevels(r.experience_levels ?? [])
        setLaborTypes((lt.items ?? []).filter(t => t.active))
        setDesignations((wd.items ?? []).filter(d => d.active))
      })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const pastCount = rates.filter(r => r.status === 'superseded').length
  // The API already returns rates in worker-designation order.
  const visible = useMemo(() => rates.filter(r =>
    (!desigFilter || r.worker_designation_code === desigFilter) &&
    (!typeFilter || (r.labor_type_code ?? 'ALL') === typeFilter) &&
    (showPast || r.status !== 'superseded')
  ), [rates, typeFilter, desigFilter, showPast])
  const filterTypes = useMemo(() => {
    const seen = new Map()
    rates.forEach(r => r.labor_type_code &&
      seen.set(r.labor_type_code, r.labor_type_name ?? r.labor_type_code))
    return [...seen.entries()]
  }, [rates])
  const filterDesigs = useMemo(() => {
    const seen = new Map()
    rates.forEach(r =>
      seen.set(r.worker_designation_code, r.worker_designation_name ?? r.worker_designation_code))
    return [...seen.entries()]
  }, [rates])

  const startEdit = (r) => {
    setEditingId(r.rate_id)
    setEditF({ rate: (r.rate_cents / 100).toFixed(2), notes: r.notes ?? '' })
  }

  const saveEdit = async (r) => {
    setSaving(true)
    try {
      await patch(`/labor-rates/${encodeURIComponent(r.rate_id)}`,
                  { rate_cents: toCents(editF.rate), notes: editF.notes })
      toast('Saved')
      setEditingId(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r) => {
    const who = [r.labor_type_name ?? r.labor_type_code ?? 'all labor types',
                 r.experience_level ?? 'all levels'].join(', ')
    const what = `${r.worker_designation_name ?? r.worker_designation_code} (${who}) ` +
                 `at ${fmtCents(r.rate_cents)} from ${r.effective_from}`
    if (!confirm(`Delete the rate for ${what}?`)) return
    try {
      await del(`/labor-rates/${encodeURIComponent(r.rate_id)}`)
      toast('Deleted')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      {adding && (
        <AddRateModal laborTypes={laborTypes} designations={designations} levels={levels} rates={rates}
          onClose={() => setAdding(false)}
          onCreated={() => { setAdding(false); toast('Rate added'); load() }} />
      )}

      <div className="ph">
        <h1>Labor Rates</h1>
        {isAdmin && (
          <button className="btn btn-primary" disabled={loading || designations.length === 0}
            onClick={() => setAdding(true)}>
            + Add rate
          </button>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        Hourly rates for each worker designation, optionally by labor type and experience
        level. To change a price,
        add a new rate with the date it takes effect; earlier rates are kept for past jobs and
        quotes.
      </p>

      {!loading && rates.length > 0 && (
        <div className="fbar" style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 14 }}>
          <select value={desigFilter} onChange={e => setDesigFilter(e.target.value)}>
            <option value="">All designations</option>
            {filterDesigs.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
            <option value="">Any labor type</option>
            <option value="ALL">All-labor-types rates</option>
            {filterTypes.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
          </select>
          <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <input type="checkbox" style={{ minWidth: 0 }} checked={showPast}
              onChange={e => setShowPast(e.target.checked)} />
            Show past rates{pastCount ? ` (${pastCount})` : ''}
          </label>
        </div>
      )}

      <div className="card">
        {loading ? <div className="spinner" /> : designations.length === 0 && rates.length === 0 ? (
          <div className="empty">
            <strong>No worker designations yet</strong>
            Rates are set per worker designation. {isAdmin
              ? <>Set up your designations first under <Link to="/reference/worker-designations">Worker Designation</Link>.</>
              : 'Your shop admin hasn’t set these up yet.'}
          </div>
        ) : rates.length === 0 ? (
          <div className="empty">
            <strong>No labor rates yet</strong>
            {isAdmin ? (
              <>
                Add an hourly rate for each worker designation you bill.
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={() => setAdding(true)}>Add rate</button>
                </div>
              </>
            ) : 'Your shop admin hasn’t set these up yet.'}
          </div>
        ) : visible.length === 0 ? (
          <div className="empty"><strong>No rates match</strong>Change the filter or show past rates.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Worker designation</th>
                <th>Experience level</th>
                <th>Labor type</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Hourly rate</th>
                <th style={{ whiteSpace: 'nowrap' }}>Effective from</th>
                <th>Status</th>
                <th>Notes</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(r => {
                const editing = editingId === r.rate_id
                return (
                  <tr key={r.rate_id} style={{ opacity: r.status === 'superseded' && !editing ? 0.6 : 1 }}>
                    <td style={{ fontWeight: 500 }}>
                      {r.worker_designation_name
                        ?? <em style={{ color: 'var(--muted)', fontWeight: 400 }}>Deleted ({r.worker_designation_code})</em>}
                    </td>
                    <td>{r.experience_level ?? <span style={{ color: 'var(--muted)' }}>All levels</span>}</td>
                    <td>
                      {!r.labor_type_code
                        ? <span style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>All labor types</span>
                        : <>
                            {r.labor_type_name ?? <em style={{ color: 'var(--muted)' }}>Deleted labor type</em>}
                            <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 6 }}>{r.labor_type_code}</span>
                          </>}
                    </td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {editing ? (
                        <input type="number" min="0.01" step="0.01" value={editF.rate}
                          onChange={e => setEditF(x => ({ ...x, rate: e.target.value }))}
                          style={{ ...smallInput, width: 100, textAlign: 'right' }} />
                      ) : fmtCents(r.rate_cents)}
                    </td>
                    <td style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{r.effective_from}</td>
                    <td>{STATUS_BADGE[r.status]}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {editing ? (
                        <input value={editF.notes} maxLength={300}
                          onChange={e => setEditF(x => ({ ...x, notes: e.target.value }))}
                          style={{ ...smallInput, width: '100%' }} />
                      ) : (r.notes || '—')}
                    </td>
                    {isAdmin && (
                      <td>
                        {editing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm"
                              disabled={saving || !(parseFloat(editF.rate) > 0)}
                              onClick={() => saveEdit(r)}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>Edit</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => remove(r)}>Delete</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
