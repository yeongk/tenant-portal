import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import { parseCsv, toCsv, downloadText } from '../utils/csv'

// ── Parts Catalog ─────────────────────────────────────────────────────────────
//
// The shop's parts master: part numbers, category, originality, vendor offers
// and fitment. Two ways in for a new shop: "Add part" (one at a time — the
// same form work-order screens will use for quick add) and "Import CSV" (an
// existing parts list, previewed before anything is written). Categories and
// attribute lists come from fastapi-sam reference_data.py via
// GET /api/parts/options. Backend: app/service/part_catalog.py.

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
const fmtCents = (c) => (c == null ? '—' : usd.format(c / 100))
const toCents = (v) => (v === '' || v == null ? null : Math.round(parseFloat(v) * 100))
const splitList = (s) => (s || '').split(/[;,|\n]/).map(x => x.trim()).filter(Boolean)
const muted = { color: 'var(--muted)' }
const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }
const smallInput = { padding: '4px 8px', fontSize: 13 }

const SOURCE_BADGE = {
  manual:    ['badge-gray',   'Manual'],
  quick_add: ['badge-blue',   'Quick add'],
  import:    ['badge-purple', 'Import'],
  default:   ['badge-green',  'Starter set'],
  invoice:   ['badge-yellow', 'Invoice'],
  supplier:  ['badge-blue',   'Supplier'],
}
const SourceBadge = ({ source }) => {
  const [cls, label] = SOURCE_BADGE[source] ?? ['badge-gray', source || '—']
  return <span className={`badge ${cls}`}>{label}</span>
}

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}

const Select = ({ value, onChange, options, blank, ...rest }) => (
  <select value={value ?? ''} onChange={e => onChange(e.target.value)} {...rest}>
    <option value="">{blank}</option>
    {options.map(o => typeof o === 'string'
      ? <option key={o} value={o}>{o}</option>
      : <option key={o.value} value={o.value}>{o.label}</option>)}
  </select>
)

// ── Add part ──────────────────────────────────────────────────────────────────

const emptyPart = {
  part_number: '', description: '', category: '', originality: '', manufacturer: '',
  alt: '', notes: '',
  vendor_name: '', vendor_part_number: '', cost: '', condition: '', source_type: '',
  make: '', model: '', year_from: '', year_to: '', variant: '', qty: '',
}

function AddPartModal({ opts, onClose, onCreated, onOpenExisting }) {
  const { get, post } = useApi()
  const toast = useToast()
  const [f, setF] = useState(emptyPart)
  const [saving, setSaving] = useState(false)
  const [dup, setDup] = useState(null)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))
  const pn = useDebounced(f.part_number.trim(), 400)

  // Live duplicate check — part numbers are matched ignoring punctuation.
  useEffect(() => {
    if (!pn) { setDup(null); return }
    let live = true
    get(`/parts/lookup?part_number=${encodeURIComponent(pn)}`)
      .then(r => live && setDup(r.part))
      .catch(() => live && setDup(null))
    return () => { live = false }
  }, [pn])

  const submit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        part_number: f.part_number, description: f.description,
        category: f.category || null, originality: f.originality || null,
        manufacturer: f.manufacturer || null, notes: f.notes || null,
        alt_part_numbers: splitList(f.alt), source: 'manual',
      }
      if (f.vendor_name.trim()) {
        body.offer = {
          vendor_name: f.vendor_name, vendor_part_number: f.vendor_part_number || null,
          cost_cents: toCents(f.cost), condition: f.condition || null,
          source_type: f.source_type || null, preferred: true,
        }
      }
      if (f.make.trim() && f.model.trim()) {
        body.fitment = [{
          make: f.make, model: f.model,
          year_from: f.year_from ? Number(f.year_from) : null,
          year_to: f.year_to ? Number(f.year_to) : null,
          variant: f.variant || null, qty_per_vehicle: f.qty ? Number(f.qty) : null,
        }]
      }
      const created = await post('/parts', body)
      onCreated(created)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const row = { display: 'flex', gap: 12 }
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="modal-hd">
          <h2>Add part</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div style={row}>
            <div className="fg" style={{ flex: 2 }}><label>Part number</label>
              <input value={f.part_number} onChange={e => set('part_number', e.target.value)}
                required maxLength={60} placeholder="e.g. 964.351.951.00" style={mono} />
            </div>
            <div className="fg" style={{ flex: 3 }}><label>Description</label>
              <input value={f.description} onChange={e => set('description', e.target.value)}
                required maxLength={200} placeholder="e.g. Brake pad set, front" />
            </div>
          </div>
          {dup && (
            <p style={{ fontSize: 13, color: 'var(--danger)', marginTop: -6, marginBottom: 12 }}>
              Already in the catalog: <strong>{dup.part_number}</strong> — {dup.description}.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => onOpenExisting(dup)}>
                Open it
              </button>
            </p>
          )}
          <div style={row}>
            <div className="fg" style={{ flex: 1 }}><label>Category</label>
              <Select value={f.category} onChange={v => set('category', v)} blank="—"
                options={opts.categories.map(c => ({ value: c.code, label: c.name }))} />
            </div>
            <div className="fg" style={{ flex: 1 }}><label>Originality</label>
              <Select value={f.originality} onChange={v => set('originality', v)} blank="—"
                options={opts.originality} />
            </div>
          </div>
          <div style={row}>
            <div className="fg" style={{ flex: 1 }}><label>Manufacturer / brand</label>
              <input value={f.manufacturer} onChange={e => set('manufacturer', e.target.value)} maxLength={80} />
            </div>
            <div className="fg" style={{ flex: 1 }}><label>Alternate / superseded numbers</label>
              <input value={f.alt} onChange={e => set('alt', e.target.value)}
                placeholder="Separate with ; or ," style={mono} />
            </div>
          </div>

          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                             padding: '10px 14px 2px', marginBottom: 14 }}>
            <legend style={{ fontSize: 13, padding: '0 6px', ...muted }}>Vendor offer (optional)</legend>
            <div style={row}>
              <div className="fg" style={{ flex: 2 }}><label>Vendor</label>
                <input value={f.vendor_name} onChange={e => set('vendor_name', e.target.value)}
                  maxLength={80} placeholder="e.g. Pelican Parts" />
              </div>
              <div className="fg" style={{ flex: 2 }}><label>Vendor part number</label>
                <input value={f.vendor_part_number} onChange={e => set('vendor_part_number', e.target.value)}
                  maxLength={60} style={mono} />
              </div>
              <div className="fg" style={{ flex: 1 }}><label>Cost (USD)</label>
                <input type="number" min="0" step="0.01" value={f.cost} onChange={e => set('cost', e.target.value)} />
              </div>
            </div>
            <div style={row}>
              <div className="fg" style={{ flex: 1 }}><label>Condition</label>
                <Select value={f.condition} onChange={v => set('condition', v)} blank="—" options={opts.condition} />
              </div>
              <div className="fg" style={{ flex: 1 }}><label>Supplier type</label>
                <Select value={f.source_type} onChange={v => set('source_type', v)} blank="—" options={opts.source_type} />
              </div>
            </div>
          </fieldset>

          <fieldset style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                             padding: '10px 14px 2px', marginBottom: 14 }}>
            <legend style={{ fontSize: 13, padding: '0 6px', ...muted }}>Fits (optional)</legend>
            <div style={row}>
              <div className="fg" style={{ flex: 2 }}><label>Make</label>
                <input value={f.make} onChange={e => set('make', e.target.value)} maxLength={40} placeholder="e.g. Porsche" />
              </div>
              <div className="fg" style={{ flex: 2 }}><label>Model</label>
                <input value={f.model} onChange={e => set('model', e.target.value)} maxLength={60} placeholder="e.g. 911 Carrera 4" />
              </div>
              <div className="fg" style={{ flex: 1 }}><label>Variant</label>
                <input value={f.variant} onChange={e => set('variant', e.target.value)} maxLength={60} placeholder="964" />
              </div>
            </div>
            <div style={row}>
              <div className="fg" style={{ flex: 1 }}><label>Year from</label>
                <input type="number" min="1885" max="2100" value={f.year_from} onChange={e => set('year_from', e.target.value)} />
              </div>
              <div className="fg" style={{ flex: 1 }}><label>Year to</label>
                <input type="number" min="1885" max="2100" value={f.year_to} onChange={e => set('year_to', e.target.value)} />
              </div>
              <div className="fg" style={{ flex: 1 }}><label>Qty per vehicle</label>
                <input type="number" min="1" value={f.qty} onChange={e => set('qty', e.target.value)} />
              </div>
            </div>
          </fieldset>

          <div className="fg"><label>Notes</label>
            <textarea rows={2} value={f.notes} onChange={e => set('notes', e.target.value)} maxLength={1000} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving || !!dup}>
              {saving ? 'Adding…' : 'Add part'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Part detail (edit, vendor offers, fitment) ────────────────────────────────

function PartDetailModal({ partId, opts, canEdit, canDelete, onClose, onChanged, onDeleted }) {
  const { get, patch, put, del } = useApi()
  const toast = useToast()
  const [p, setP] = useState(null)
  const [editing, setEditing] = useState(false)
  const [ef, setEf] = useState({})
  const [offer, setOffer] = useState(null)   // new-offer form, or null
  const [fit, setFit] = useState(null)       // new-fitment form, or null
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    get(`/parts/${partId}`).then(setP).catch(e => { toast(e.message, 'error'); onClose() })
  }, [partId])

  const run = async (fn, okMsg) => {
    setBusy(true)
    try {
      const r = await fn()
      if (r && r.catalog_part_id) setP(r)
      if (okMsg) toast(okMsg)
      onChanged()
      return true
    } catch (e) {
      toast(e.message, 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  const startEdit = () => {
    setEf({
      part_number: p.part_number, description: p.description, category: p.category ?? '',
      originality: p.originality ?? '', manufacturer: p.manufacturer ?? '',
      alt: (p.alt_part_numbers || []).join('; '), superseded_by: p.superseded_by ?? '',
      nla: p.nla, notes: p.notes ?? '',
    })
    setEditing(true)
  }
  const saveEdit = async () => {
    const ok = await run(() => patch(`/parts/${partId}`, {
      part_number: ef.part_number, description: ef.description,
      category: ef.category, originality: ef.originality, manufacturer: ef.manufacturer,
      alt_part_numbers: splitList(ef.alt), superseded_by: ef.superseded_by,
      nla: ef.nla, notes: ef.notes,
    }), 'Saved')
    if (ok) setEditing(false)
  }

  const saveOffer = async () => {
    const ok = await run(() => put(`/parts/${partId}/offers`, {
      vendor_name: offer.vendor_name, vendor_part_number: offer.vendor_part_number || null,
      cost_cents: toCents(offer.cost), quoted_on: offer.quoted_on || null,
      lead_time_days: offer.lead ? Number(offer.lead) : null,
      condition: offer.condition || null, source_type: offer.source_type || null,
      preferred: !!offer.preferred, notes: offer.notes || null,
    }), 'Vendor offer saved')
    if (ok) setOffer(null)
  }
  const editOffer = (o) => setOffer({
    vendor_name: o.vendor_name, vendor_part_number: o.vendor_part_number ?? '',
    cost: o.last_cost_cents != null ? (o.last_cost_cents / 100).toFixed(2) : '',
    quoted_on: o.last_quoted_at ?? '', lead: o.lead_time_days ?? '',
    condition: o.condition ?? '', source_type: o.source_type ?? '',
    preferred: !!o.preferred, notes: o.notes ?? '', existing: true,
  })

  const saveFit = async () => {
    const ok = await run(() => put(`/parts/${partId}/fitment`, {
      make: fit.make, model: fit.model,
      year_from: fit.year_from ? Number(fit.year_from) : null,
      year_to: fit.year_to ? Number(fit.year_to) : null,
      variant: fit.variant || null, qty_per_vehicle: fit.qty ? Number(fit.qty) : null,
    }), 'Fitment saved')
    if (ok) setFit(null)
  }

  const removePart = async () => {
    if (!confirm(`Delete ${p.part_number} (${p.description}) and its vendor offers and fitment?`)) return
    try { await del(`/parts/${partId}`); toast('Part deleted'); onDeleted() }
    catch (e) { toast(e.message, 'error') }
  }

  const sec = { fontSize: 13, fontWeight: 600, margin: '18px 0 8px', display: 'flex',
                justifyContent: 'space-between', alignItems: 'center' }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 860 }}>
        {!p ? <div className="spinner" /> : (
          <>
            <div className="modal-hd">
              <h2 style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={mono}>{p.part_number}</span>
                <span style={{ fontWeight: 400 }}>{p.description}</span>
              </h2>
              <button className="modal-close" onClick={onClose}>×</button>
            </div>

            {!editing ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px 18px', fontSize: 13 }}>
                <div><span style={muted}>Category</span><br />{p.category_name ?? '—'}</div>
                <div><span style={muted}>Originality</span><br />{p.originality ?? '—'}</div>
                <div><span style={muted}>Manufacturer</span><br />{p.manufacturer ?? '—'}</div>
                <div><span style={muted}>Alternate numbers</span><br />
                  <span style={mono}>{p.alt_part_numbers.length ? p.alt_part_numbers.join(', ') : '—'}</span></div>
                <div><span style={muted}>Superseded by</span><br /><span style={mono}>{p.superseded_by ?? '—'}</span></div>
                <div><span style={muted}>Availability</span><br />
                  {p.nla ? <span className="badge badge-yellow">No longer available new</span> : 'Available'}</div>
                <div style={{ gridColumn: '1 / -1' }}><span style={muted}>Notes</span><br />{p.notes || '—'}</div>
                <div style={{ gridColumn: '1 / -1', ...muted, fontSize: 12 }}>
                  Added via <SourceBadge source={p.source} />{p.source_ref ? ` from ${p.source_ref}` : ''}
                </div>
              </div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="fg" style={{ flex: 2 }}><label>Part number</label>
                    <input value={ef.part_number} onChange={e => setEf(x => ({ ...x, part_number: e.target.value }))} style={mono} /></div>
                  <div className="fg" style={{ flex: 3 }}><label>Description</label>
                    <input value={ef.description} onChange={e => setEf(x => ({ ...x, description: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="fg" style={{ flex: 1 }}><label>Category</label>
                    <Select value={ef.category} onChange={v => setEf(x => ({ ...x, category: v }))} blank="—"
                      options={opts.categories.map(c => ({ value: c.code, label: c.name }))} /></div>
                  <div className="fg" style={{ flex: 1 }}><label>Originality</label>
                    <Select value={ef.originality} onChange={v => setEf(x => ({ ...x, originality: v }))} blank="—"
                      options={opts.originality} /></div>
                  <div className="fg" style={{ flex: 1 }}><label>Manufacturer</label>
                    <input value={ef.manufacturer} onChange={e => setEf(x => ({ ...x, manufacturer: e.target.value }))} /></div>
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div className="fg" style={{ flex: 2 }}><label>Alternate numbers</label>
                    <input value={ef.alt} onChange={e => setEf(x => ({ ...x, alt: e.target.value }))} style={mono} /></div>
                  <div className="fg" style={{ flex: 1 }}><label>Superseded by</label>
                    <input value={ef.superseded_by} onChange={e => setEf(x => ({ ...x, superseded_by: e.target.value }))} style={mono} /></div>
                </div>
                <div className="fg"><label>Notes</label>
                  <textarea rows={2} value={ef.notes} onChange={e => setEf(x => ({ ...x, notes: e.target.value }))} /></div>
                <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                  <input type="checkbox" checked={ef.nla} onChange={e => setEf(x => ({ ...x, nla: e.target.checked }))} />
                  No longer available new
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-primary btn-sm" disabled={busy} onClick={saveEdit}>Save</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Vendor offers */}
            <div style={sec}>
              <span>Vendor offers ({p.offers.length})</span>
              {canEdit && !offer && (
                <button className="btn btn-secondary btn-sm" onClick={() => setOffer({
                  vendor_name: '', vendor_part_number: '', cost: '', quoted_on: '', lead: '',
                  condition: '', source_type: '', preferred: p.offers.length === 0, notes: '' })}>
                  + Add offer
                </button>
              )}
            </div>
            {p.offers.length > 0 && (
              <table>
                <thead><tr>
                  <th>Vendor</th><th>Vendor PN</th><th style={{ textAlign: 'right' }}>Cost</th>
                  <th>Quoted</th><th>Lead</th><th>Condition</th><th>Supplier type</th>{canEdit && <th></th>}
                </tr></thead>
                <tbody>
                  {p.offers.map(o => (
                    <tr key={o.vendor_id}>
                      <td>{o.vendor_name} {o.preferred && <span className="badge badge-green">Preferred</span>}</td>
                      <td style={mono}>{o.vendor_part_number ?? '—'}</td>
                      <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{fmtCents(o.last_cost_cents)}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{o.last_quoted_at ?? '—'}</td>
                      <td>{o.lead_time_days != null ? `${o.lead_time_days} d` : '—'}</td>
                      <td>{o.condition ?? '—'}</td>
                      <td>{o.source_type ?? '—'}</td>
                      {canEdit && (
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => editOffer(o)}>Edit</button>{' '}
                          <button className="btn btn-secondary btn-sm" disabled={busy}
                            onClick={() => confirm(`Remove ${o.vendor_name}'s offer?`) &&
                              run(() => del(`/parts/${partId}/offers/${encodeURIComponent(o.vendor_id)}`), 'Offer removed')}>
                            Remove
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {p.offers.length === 0 && !offer && <p style={{ ...muted, fontSize: 13 }}>No vendor offers yet.</p>}
            {offer && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input placeholder="Vendor" value={offer.vendor_name} disabled={offer.existing}
                    onChange={e => setOffer(x => ({ ...x, vendor_name: e.target.value }))} style={{ ...smallInput, flex: '2 1 160px' }} />
                  <input placeholder="Vendor PN" value={offer.vendor_part_number}
                    onChange={e => setOffer(x => ({ ...x, vendor_part_number: e.target.value }))} style={{ ...smallInput, ...mono, flex: '2 1 120px' }} />
                  <input placeholder="Cost" type="number" min="0" step="0.01" value={offer.cost}
                    onChange={e => setOffer(x => ({ ...x, cost: e.target.value }))} style={{ ...smallInput, flex: '1 1 80px' }} />
                  <input type="date" title="Quoted on" value={offer.quoted_on}
                    onChange={e => setOffer(x => ({ ...x, quoted_on: e.target.value }))} style={{ ...smallInput, flex: '1 1 130px' }} />
                  <input placeholder="Lead days" type="number" min="0" value={offer.lead}
                    onChange={e => setOffer(x => ({ ...x, lead: e.target.value }))} style={{ ...smallInput, flex: '1 1 80px' }} />
                  <Select value={offer.condition} onChange={v => setOffer(x => ({ ...x, condition: v }))}
                    blank="Condition" options={opts.condition} style={{ ...smallInput, flex: '1 1 110px' }} />
                  <Select value={offer.source_type} onChange={v => setOffer(x => ({ ...x, source_type: v }))}
                    blank="Supplier type" options={opts.source_type} style={{ ...smallInput, flex: '1 1 140px' }} />
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                    <input type="checkbox" checked={offer.preferred}
                      onChange={e => setOffer(x => ({ ...x, preferred: e.target.checked }))} /> Preferred vendor
                  </label>
                  <span style={{ flex: 1 }} />
                  <button className="btn btn-primary btn-sm" disabled={busy || !offer.vendor_name.trim()} onClick={saveOffer}>Save offer</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setOffer(null)}>Cancel</button>
                </div>
              </div>
            )}

            {/* Fitment */}
            <div style={sec}>
              <span>Fits ({p.fitment.length})</span>
              {canEdit && !fit && (
                <button className="btn btn-secondary btn-sm"
                  onClick={() => setFit({ make: '', model: '', year_from: '', year_to: '', variant: '', qty: '' })}>
                  + Add fitment
                </button>
              )}
            </div>
            {p.fitment.length > 0 && (
              <table>
                <thead><tr><th>Make</th><th>Model</th><th>Variant</th><th>Years</th><th>Qty / vehicle</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {p.fitment.map(x => (
                    <tr key={x.fit_id}>
                      <td>{x.make}</td><td>{x.model}</td><td>{x.variant ?? '—'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {x.year_from || x.year_to ? `${x.year_from ?? '…'}–${x.year_to ?? '…'}` : 'All years'}
                      </td>
                      <td>{x.qty_per_vehicle ?? '—'}</td>
                      {canEdit && (
                        <td><button className="btn btn-secondary btn-sm" disabled={busy}
                          onClick={() => run(() => del(`/parts/${partId}/fitment/${encodeURIComponent(x.fit_id)}`), 'Fitment removed')}>
                          Remove</button></td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {p.fitment.length === 0 && !fit && <p style={{ ...muted, fontSize: 13 }}>No fitment recorded.</p>}
            {fit && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: 12, marginTop: 8,
                            display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <input placeholder="Make" value={fit.make} onChange={e => setFit(x => ({ ...x, make: e.target.value }))} style={{ ...smallInput, flex: '2 1 120px' }} />
                <input placeholder="Model" value={fit.model} onChange={e => setFit(x => ({ ...x, model: e.target.value }))} style={{ ...smallInput, flex: '2 1 140px' }} />
                <input placeholder="Variant" value={fit.variant} onChange={e => setFit(x => ({ ...x, variant: e.target.value }))} style={{ ...smallInput, flex: '1 1 90px' }} />
                <input placeholder="From" type="number" value={fit.year_from} onChange={e => setFit(x => ({ ...x, year_from: e.target.value }))} style={{ ...smallInput, flex: '1 1 70px' }} />
                <input placeholder="To" type="number" value={fit.year_to} onChange={e => setFit(x => ({ ...x, year_to: e.target.value }))} style={{ ...smallInput, flex: '1 1 70px' }} />
                <input placeholder="Qty" type="number" min="1" value={fit.qty} onChange={e => setFit(x => ({ ...x, qty: e.target.value }))} style={{ ...smallInput, flex: '1 1 60px' }} />
                <button className="btn btn-primary btn-sm" disabled={busy || !fit.make.trim() || !fit.model.trim()} onClick={saveFit}>Save</button>
                <button className="btn btn-secondary btn-sm" onClick={() => setFit(null)}>Cancel</button>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 22 }}>
              <div>{canDelete && <button className="btn btn-secondary" onClick={removePart}>Delete part</button>}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {canEdit && !editing && <button className="btn btn-secondary" onClick={startEdit}>Edit details</button>}
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── CSV import ────────────────────────────────────────────────────────────────

// Catalog fields a CSV can fill, with the header names they're recognized by
// (compared lower-case, letters and digits only).
const IMPORT_FIELDS = [
  ['part_number',        'Part number',        ['partnumber', 'partno', 'part', 'pn', 'oemnumber', 'oempartnumber', 'number', 'partnum']],
  ['description',        'Description',        ['description', 'desc', 'name', 'partname', 'itemdescription']],
  ['category',           'Category',           ['category', 'partcategory', 'group']],
  ['originality',        'Originality',        ['originality', 'origin', 'parttype', 'type']],
  ['manufacturer',       'Manufacturer',       ['manufacturer', 'brand', 'mfr', 'mfg', 'maker']],
  ['alt_part_numbers',   'Alternate numbers',  ['altpartnumbers', 'alternatenumbers', 'alternates', 'altnumbers', 'supersedes', 'supersession', 'crossreference']],
  ['notes',              'Notes',              ['notes', 'note', 'comments', 'memo']],
  ['vendor',             'Vendor',             ['vendor', 'supplier', 'vendorname', 'suppliername', 'source']],
  ['vendor_part_number', 'Vendor part number', ['vendorpartnumber', 'vendorpn', 'supplierpartnumber', 'supplierpn', 'sku', 'vendorsku', 'suppliersku', 'itemnumber']],
  ['cost',               'Cost (USD)',         ['cost', 'unitcost', 'price', 'unitprice', 'lastcost']],
  ['condition',          'Condition',          ['condition']],
  ['source_type',        'Supplier type',      ['suppliertype', 'sourcetype', 'vendortype']],
  ['lead_time_days',     'Lead time (days)',   ['leadtime', 'leadtimedays', 'leaddays']],
  ['make',               'Fits: make',         ['make', 'vehiclemake', 'marque']],
  ['model',              'Fits: model',        ['model', 'vehiclemodel']],
  ['year_from',          'Fits: year from',    ['yearfrom', 'fromyear', 'startyear', 'year']],
  ['year_to',            'Fits: year to',      ['yearto', 'toyear', 'endyear']],
  ['variant',            'Fits: variant',      ['variant', 'submodel', 'chassis', 'series']],
  ['qty_per_vehicle',    'Fits: qty / vehicle',['qtypervehicle', 'qty', 'quantity', 'qtyper']],
]
const headerKey = (h) => h.toLowerCase().replace(/[^a-z0-9]/g, '')
const CHUNK = 200
const MAX_ROWS = 5000

function templateCsv() {
  return toCsv([
    IMPORT_FIELDS.map(([k]) => k),
    ['964.351.951.00', 'Brake pad set, front', 'Brake System', 'OEM Replacement', 'Textar',
     '964 351 951 01', '', 'Pelican Parts', 'PEL-964-351', '89.95', 'New', 'Specialty Supplier', '3',
     'Porsche', '911 Carrera 4', '1989', '1994', '964', '1'],
    ['964.351.951.00', '', '', '', '', '', '', 'Stoddard', 'STD-12345', '84.50', 'New', 'Specialty Supplier', '7',
     'Porsche', '911 Carrera 2', '1990', '1994', '964', '1'],
    ['W111-720-01-78', 'Door seal, front left', 'Seals, Gaskets & Rubber', 'Replica', '', '', 'Rubber, reproduction',
     'SMS Auto Fabrics', '', '145.00', 'New', 'Specialty Supplier', '', 'Mercedes-Benz', '280 SE Coupe', '1968', '1971', 'W111', '1'],
  ])
}

function ImportModal({ opts, onClose, onDone }) {
  const { post } = useApi()
  const toast = useToast()
  const fileRef = useRef(null)
  const [step, setStep] = useState('file')          // file | map | preview | running | done
  const [fileName, setFileName] = useState('')
  const [headers, setHeaders] = useState([])
  const [data, setData] = useState([])               // rows without header
  const [map, setMap] = useState({})                 // field -> column index ('' = not used)
  const [mode, setMode] = useState('skip')
  const [preview, setPreview] = useState(null)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)
  const [busy, setBusy] = useState(false)

  const onFile = async (file) => {
    if (!file) return
    const text = await file.text()
    const rows = parseCsv(text)
    if (rows.length < 2) { toast('That file has no data rows', 'error'); return }
    if (rows.length - 1 > MAX_ROWS) { toast(`Please split the file — up to ${MAX_ROWS} rows per import`, 'error'); return }
    const hdr = rows[0].map(h => h.trim())
    const auto = {}
    IMPORT_FIELDS.forEach(([field, , aliases]) => {
      const idx = hdr.findIndex(h => headerKey(h) === headerKey(field) || aliases.includes(headerKey(h)))
      auto[field] = idx === -1 ? '' : String(idx)
    })
    setFileName(file.name); setHeaders(hdr); setData(rows.slice(1)); setMap(auto); setStep('map')
  }

  const buildRows = useCallback(() => data.map((r, i) => {
    const o = { row: i + 2 }
    IMPORT_FIELDS.forEach(([field]) => {
      const idx = map[field]
      if (idx !== '' && idx != null) {
        const v = (r[Number(idx)] ?? '').trim()
        if (v !== '') o[field] = v
      }
    })
    return o
  }), [data, map])

  // Rows are sent in chunks; a part's rows must stay in the same chunk so they merge.
  const chunks = useCallback(() => {
    const rows = buildRows()
    const byPart = new Map()
    rows.forEach(r => {
      const k = (r.part_number || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || `__row${r.row}`
      if (!byPart.has(k)) byPart.set(k, [])
      byPart.get(k).push(r)
    })
    const out = [[]]
    for (const group of byPart.values()) {
      if (out[out.length - 1].length + group.length > CHUNK && out[out.length - 1].length) out.push([])
      out[out.length - 1].push(...group)
    }
    return out.filter(c => c.length)
  }, [buildRows])

  const merge = (acc, r) => ({
    summary: Object.fromEntries(Object.keys(r.summary).map(k => [k, (acc?.summary?.[k] ?? 0) + r.summary[k]])),
    rows: [...(acc?.rows ?? []), ...r.rows],
  })

  const runAll = async (path) => {
    let acc = null
    const parts = chunks()
    for (let i = 0; i < parts.length; i++) {
      const r = await post(path, { rows: parts[i], mode, file_name: fileName })
      acc = merge(acc, r)
      setProgress(Math.round(((i + 1) / parts.length) * 100))
    }
    acc.rows.sort((a, b) => a.row - b.row)
    return acc
  }

  const doPreview = async () => {
    setBusy(true); setProgress(0)
    try { setPreview(await runAll('/parts/import/preview')); setStep('preview') }
    catch (e) { toast(e.message, 'error') }
    finally { setBusy(false) }
  }

  const doImport = async () => {
    setStep('running'); setProgress(0)
    try { setResult(await runAll('/parts/import')); setStep('done'); onDone() }
    catch (e) { toast(e.message, 'error'); setStep('preview') }
  }

  const ACTION_BADGE = { create: ['badge-green', 'New'], update: ['badge-blue', 'Update'],
                         skip: ['badge-gray', 'Skip'], error: ['badge-red', 'Error'] }
  const summaryLine = (s) => (
    <div style={{ display: 'flex', gap: 18, fontSize: 14, margin: '6px 0 14px', flexWrap: 'wrap' }}>
      <span><strong>{s.create}</strong> new parts</span>
      <span><strong>{s.update}</strong> to update</span>
      <span><strong>{s.skip}</strong> already in catalog (skipped)</span>
      <span style={s.error_rows ? { color: 'var(--danger)' } : undefined}>
        <strong>{s.error_rows}</strong> rows with errors</span>
    </div>
  )
  const shownRows = (rows) => {
    const notable = rows.filter(r => r.action !== 'create')
    return (notable.length ? notable : rows).slice(0, 300)
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && step !== 'running' && onClose()}>
      <div className="modal" style={{ maxWidth: 900 }}>
        <div className="modal-hd">
          <h2>Import parts from CSV</h2>
          {step !== 'running' && <button className="modal-close" onClick={onClose}>×</button>}
        </div>

        {step === 'file' && (
          <div>
            <p style={{ fontSize: 14, marginTop: 0 }}>
              Upload your existing parts list as a CSV file — from Excel or Google Sheets use
              <em> File → Save as / Download → CSV</em>. One row per part; extra rows with the same part
              number add more vendor offers or fitments. Nothing is saved until you review a preview.
            </p>
            <p style={{ fontSize: 13, ...muted }}>
              Categories and originality use your platform lists (e.g. “Brake System” or PT13; “NOS (New Old
              Stock)”). Columns are matched by name; you can adjust the matching on the next step.
            </p>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '16px 0' }}>
              <button className="btn btn-secondary" onClick={() => downloadText('parts-catalog-template.csv', templateCsv())}>
                Download template
              </button>
              <button className="btn btn-primary" onClick={() => fileRef.current?.click()}>Choose CSV file…</button>
              <input ref={fileRef} type="file" accept=".csv,text/csv,.txt" style={{ display: 'none' }}
                onChange={e => onFile(e.target.files?.[0])} />
            </div>
          </div>
        )}

        {step === 'map' && (
          <div>
            <p style={{ fontSize: 14, marginTop: 0 }}>
              <strong>{fileName}</strong> — {data.length} rows. Check which column fills each field.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px 24px',
                          maxHeight: '45vh', overflowY: 'auto', padding: '4px 2px' }}>
              {IMPORT_FIELDS.map(([field, label]) => (
                <label key={field} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                  <span style={{ width: 150, flexShrink: 0 }}>
                    {label}{field === 'part_number' && <span style={{ color: 'var(--danger)' }}> *</span>}
                  </span>
                  <select value={map[field] ?? ''} onChange={e => setMap(m => ({ ...m, [field]: e.target.value }))}
                    style={{ ...smallInput, flex: 1, minWidth: 0 }}>
                    <option value="">— not in file —</option>
                    {headers.map((h, i) => <option key={i} value={String(i)}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <div style={{ margin: '16px 0 4px', fontSize: 13 }}>
              <strong>Parts already in your catalog:</strong>
              <label style={{ marginLeft: 14 }}><input type="radio" checked={mode === 'skip'} onChange={() => setMode('skip')} /> Skip them</label>
              <label style={{ marginLeft: 14 }}><input type="radio" checked={mode === 'update'} onChange={() => setMode('update')} /> Update them (fill in fields, add or refresh vendor offers and fitment)</label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setStep('file')}>Back</button>
              <button className="btn btn-primary" disabled={busy || map.part_number === ''} onClick={doPreview}>
                {busy ? `Checking… ${progress}%` : 'Preview import'}
              </button>
            </div>
          </div>
        )}

        {step === 'preview' && preview && (
          <div>
            {summaryLine(preview.summary)}
            <p style={{ fontSize: 13, ...muted, marginTop: -6 }}>
              {preview.rows.some(r => r.action !== 'create')
                ? 'Rows that won’t simply be added are listed below. Rows with errors are left out of the import.'
                : 'Every row will be added as shown.'}
            </p>
            <div style={{ maxHeight: '42vh', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}>
              <table>
                <thead><tr><th style={{ width: 60 }}>Row</th><th>Part number</th><th style={{ width: 90 }}>Result</th><th>Details</th></tr></thead>
                <tbody>
                  {shownRows(preview.rows).map(r => {
                    const [cls, label] = ACTION_BADGE[r.action]
                    return (
                      <tr key={r.row}>
                        <td style={muted}>{r.row}</td>
                        <td style={mono}>{r.part_number || '—'}</td>
                        <td><span className={`badge ${cls}`}>{label}</span></td>
                        <td style={{ fontSize: 13 }}>{[r.message, r.detail].filter(Boolean).join(' · ') || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setStep('map')}>Back</button>
              <button className="btn btn-primary"
                disabled={preview.summary.create + preview.summary.update === 0} onClick={doImport}>
                Import {preview.summary.create + preview.summary.update} parts
              </button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div style={{ padding: '24px 0' }}>
            <p style={{ fontSize: 14 }}>Importing… {progress}%</p>
            <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${progress}%`, height: '100%', background: 'var(--accent)', transition: 'width .2s' }} />
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div>
            <p style={{ fontSize: 15, marginTop: 0 }}><strong>Import finished.</strong></p>
            {summaryLine(result.summary)}
            {result.summary.error_rows > 0 && (
              <button className="btn btn-secondary btn-sm" onClick={() => downloadText(
                `${fileName.replace(/\.csv$/i, '')}-errors.csv`,
                toCsv([['row', 'part_number', 'error'],
                       ...result.rows.filter(r => r.action === 'error').map(r => [r.row, r.part_number ?? '', r.message])]))}>
                Download rows with errors
              </button>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={onClose}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PartsCatalog() {
  const { get } = useApi()
  const { isAdmin, cogGroup } = useAuth()
  const toast = useToast()
  const canEdit = isAdmin || cogGroup === 'SUPERVISOR'

  const [opts, setOpts] = useState({ categories: [], originality: [], condition: [], source_type: [] })
  const [items, setItems] = useState([])
  const [cursor, setCursor] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [q, setQ] = useState('')
  const [category, setCategory] = useState('')
  const [modal, setModal] = useState(null)          // 'add' | 'import' | {partId}
  const dq = useDebounced(q.trim(), 300)

  useEffect(() => { get('/parts/options').then(setOpts).catch(e => toast(e.message, 'error')) }, [])

  const query = useMemo(() => {
    const p = new URLSearchParams({ limit: '50' })
    if (dq) p.set('q', dq)
    if (category) p.set('category', category)
    return p
  }, [dq, category])

  const load = useCallback(() => {
    setLoading(true)
    get(`/parts?${query}`)
      .then(r => { setItems(r.items ?? []); setCursor(r.next_cursor) })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [query])
  useEffect(load, [load])

  const loadMore = async () => {
    setLoadingMore(true)
    try {
      const p = new URLSearchParams(query); p.set('cursor', cursor)
      const r = await get(`/parts?${p}`)
      setItems(x => [...x, ...(r.items ?? [])]); setCursor(r.next_cursor)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoadingMore(false) }
  }

  const filtered = dq || category
  return (
    <div>
      {modal === 'add' && (
        <AddPartModal opts={opts} onClose={() => setModal(null)}
          onOpenExisting={(p) => setModal({ partId: p.catalog_part_id })}
          onCreated={(p) => { toast('Part added'); load(); setModal({ partId: p.catalog_part_id }) }} />
      )}
      {modal === 'import' && <ImportModal opts={opts} onClose={() => setModal(null)} onDone={load} />}
      {modal?.partId && (
        <PartDetailModal partId={modal.partId} opts={opts} canEdit={canEdit} canDelete={isAdmin}
          onClose={() => setModal(null)} onChanged={load}
          onDeleted={() => { setModal(null); load() }} />
      )}

      <div className="ph">
        <h1>Parts Catalog</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {isAdmin && <button className="btn btn-secondary" onClick={() => setModal('import')}>Import CSV</button>}
          {canEdit && <button className="btn btn-primary" onClick={() => setModal('add')}>+ Add part</button>}
        </div>
      </div>

      <p style={{ ...muted, fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        Your shop’s parts master — numbers, categories, vendor prices and what each part fits. Part numbers are
        matched ignoring spaces, dots and dashes.
      </p>

      <div className="fbar">
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search part number, description or brand"
          style={{ minWidth: 320 }} />
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {opts.categories.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div className="spinner" /> : items.length === 0 ? (
          filtered ? (
            <div className="empty"><strong>No matching parts</strong>Try another search or category.</div>
          ) : (
            <div className="empty">
              <strong>Your catalog is empty</strong>
              {isAdmin
                ? <>The quickest start is importing the parts list you already keep in a spreadsheet.
                    <div style={{ marginTop: 14, display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button className="btn btn-primary" onClick={() => setModal('import')}>Import CSV</button>
                      <button className="btn btn-secondary" onClick={() => setModal('add')}>Add a part</button>
                    </div></>
                : canEdit ? 'Add parts as you quote and order them.' : 'Your shop hasn’t added any parts yet.'}
            </div>
          )
        ) : (
          <>
            <table>
              <thead>
                <tr>
                  <th>Part number</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Originality</th>
                  <th style={{ textAlign: 'right' }}>Last cost</th>
                  <th>Vendor</th>
                  <th style={{ textAlign: 'right' }}>Fits</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => (
                  <tr key={p.catalog_part_id} onClick={() => setModal({ partId: p.catalog_part_id })}
                    style={{ cursor: 'pointer' }}>
                    <td style={{ ...mono, whiteSpace: 'nowrap' }}>
                      {p.part_number}
                      {p.nla && <span className="badge badge-yellow" style={{ marginLeft: 6 }}>NLA</span>}
                    </td>
                    <td>
                      {p.description}
                      {p.manufacturer && <span style={{ ...muted, fontSize: 12, marginLeft: 6 }}>{p.manufacturer}</span>}
                    </td>
                    <td style={{ fontSize: 13 }}>{p.category_name ?? '—'}</td>
                    <td style={{ fontSize: 13 }}>{p.originality ?? '—'}</td>
                    <td style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                      {fmtCents(p.last_cost_cents)}
                    </td>
                    <td style={{ fontSize: 13 }}>
                      {p.last_vendor_name ?? '—'}
                      {p.vendor_count > 1 && <span style={{ ...muted, fontSize: 12 }}> +{p.vendor_count - 1}</span>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{p.fitment_count || '—'}</td>
                    <td><SourceBadge source={p.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cursor && (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <button className="btn btn-secondary" disabled={loadingMore} onClick={loadMore}>
                  {loadingMore ? 'Loading…' : 'Load more'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
