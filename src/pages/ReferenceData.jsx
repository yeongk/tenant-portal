import React, { useEffect, useMemo, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

// ── Reference Data pages ──────────────────────────────────────────────────────
//
// One component serves the three Reference Data submenus. Each data set has
// platform defaults (fastapi-sam app/service/reference_data.py) that a shop
// picks from to build its own list, then edits freely. Backend routes live in
// fastapi-sam app/service/reference_admin.py under /api/reference/{kind}.

export const REFERENCE_SETS = {
  'work-phases': {
    title:  'Work Phases',
    single: 'work phase',
    orderLabel: 'Seq',
    intro:  'The phases a job moves through, in order. Pick the defaults that fit ' +
            'your shop, then rename, reorder or add your own.',
  },
  'labor-types': {
    title:  'Labor Types',
    single: 'labor type',
    orderLabel: 'Order',
    intro:  'Categories of labor used for time entries, estimates and rates. Pick ' +
            'the defaults that fit your shop, then edit or add your own.',
  },
  'worker-designations': {
    title:  'Worker Designations',
    single: 'worker designation',
    orderLabel: 'Order',
    intro:  'Job titles for your team. Pick the defaults that fit your shop, then ' +
            'edit or add your own.',
  },
}

const smallInput = { padding: '4px 8px', fontSize: 13 }

// ── Pick defaults ─────────────────────────────────────────────────────────────

function PickDefaultsModal({ kind, cfg, defaults, onClose, onImported }) {
  const { post } = useApi()
  const toast    = useToast()
  const available = defaults.filter(d => !d.added)
  const [picked, setPicked] = useState(() => new Set(available.map(d => d.code)))
  const [saving, setSaving] = useState(false)

  const toggle = (code) => setPicked(s => {
    const n = new Set(s)
    n.has(code) ? n.delete(code) : n.add(code)
    return n
  })
  const allPicked = available.length > 0 && picked.size === available.length

  const submit = async () => {
    setSaving(true)
    try {
      const codes = available.filter(d => picked.has(d.code)).map(d => d.code)
      const r = await post(`/reference/${kind}/import`, { codes })
      onImported(r.added.length)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-hd">
          <h2>Add default {cfg.single}s</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {available.length === 0 ? (
          <div className="empty">
            <strong>All defaults added</strong>
            Every default {cfg.single} is already in your list.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          marginBottom: 10, fontSize: 13 }}>
              <span style={{ color: 'var(--muted)' }}>
                {picked.size} of {available.length} selected
              </span>
              <button type="button" className="btn btn-secondary btn-sm"
                onClick={() => setPicked(allPicked ? new Set() : new Set(available.map(d => d.code)))}>
                {allPicked ? 'Select none' : 'Select all'}
              </button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                          maxHeight: '55vh', overflowY: 'auto' }}>
              {defaults.map(d => (
                <label key={d.code} style={{
                  display: 'flex', gap: 10, padding: '9px 12px', alignItems: 'flex-start',
                  borderBottom: '1px solid var(--border)',
                  cursor: d.added ? 'default' : 'pointer',
                  opacity: d.added ? 0.55 : 1,
                }}>
                  <input type="checkbox" style={{ marginTop: 3 }}
                    checked={d.added || picked.has(d.code)} disabled={d.added}
                    onChange={() => toggle(d.code)} />
                  <span style={{ flex: 1 }}>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{d.name}</span>
                    <span style={{ color: 'var(--muted)', fontSize: 12, marginLeft: 8 }}>{d.code}</span>
                    {d.added && <span className="badge badge-gray" style={{ marginLeft: 8 }}>Added</span>}
                    <span style={{ display: 'block', color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                      {d.description}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          {available.length > 0 && (
            <button type="button" className="btn btn-primary"
              disabled={saving || picked.size === 0} onClick={submit}>
              {saving ? 'Adding…' : `Add ${picked.size} selected`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Add custom item ───────────────────────────────────────────────────────────

function AddCustomModal({ kind, cfg, onClose, onCreated }) {
  const { post } = useApi()
  const toast    = useToast()
  const [f, setF]       = useState({ name: '', description: '', code: '', sort_order: '' })
  const [saving, setS]  = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setS(true)
    try {
      await post(`/reference/${kind}`, {
        name: f.name,
        description: f.description || null,
        code: f.code || null,
        sort_order: f.sort_order === '' ? null : Number(f.sort_order),
      })
      onCreated()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setS(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <h2>Add custom {cfg.single}</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="fg"><label>Name</label>
            <input value={f.name} onChange={e => set('name', e.target.value)} required maxLength={120} />
          </div>
          <div className="fg"><label>Description</label>
            <textarea rows={3} value={f.description} maxLength={500}
              onChange={e => set('description', e.target.value)} placeholder="Optional" />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <div className="fg" style={{ flex: 1 }}><label>Code</label>
              <input value={f.code} onChange={e => set('code', e.target.value.toUpperCase())}
                placeholder="Optional — generated if blank" maxLength={16} />
            </div>
            <div className="fg" style={{ width: 130 }}><label>{cfg.orderLabel}</label>
              <input type="number" value={f.sort_order}
                onChange={e => set('sort_order', e.target.value)} placeholder="At end" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ReferenceData({ kind }) {
  const cfg = REFERENCE_SETS[kind]
  const { get, post, patch, del } = useApi()
  const { isAdmin } = useAuth()
  const toast = useToast()

  const [items,    setItems]    = useState([])
  const [defaults, setDefaults] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [modal,    setModal]    = useState(null)   // 'defaults' | 'custom' | null

  const [editingCode, setEditingCode] = useState(null)
  const [editF,       setEditF]       = useState({})
  const [saving,      setSaving]      = useState(false)

  const load = () => {
    setLoading(true)
    Promise.all([get(`/reference/${kind}`), get(`/reference/${kind}/defaults`)])
      .then(([mine, defs]) => { setItems(mine.items ?? []); setDefaults(defs.items ?? []) })
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { setEditingCode(null); setModal(null); load() }, [kind])

  const defaultsByCode = useMemo(
    () => Object.fromEntries(defaults.map(d => [d.code, d])), [defaults])
  const remaining = defaults.filter(d => !d.added).length

  // Default = copied and unchanged; Edited = copied then changed; Custom = added by the shop.
  const isEdited = (it) => {
    const d = it.source_code && defaultsByCode[it.source_code]
    return !!d && (d.name !== it.name || d.description !== (it.description ?? ''))
  }
  const sourceBadge = (it) => {
    if (!it.source_code) return <span className="badge badge-purple">Custom</span>
    if (isEdited(it))   return <span className="badge badge-yellow">Edited</span>
    return <span className="badge badge-blue">Default</span>
  }

  const startEdit = (it) => {
    setEditingCode(it.code)
    setEditF({ name: it.name, description: it.description ?? '',
               sort_order: it.sort_order, active: it.active })
  }

  const saveEdit = async (code) => {
    setSaving(true)
    try {
      await patch(`/reference/${kind}/${encodeURIComponent(code)}`, {
        name: editF.name,
        description: editF.description,
        sort_order: editF.sort_order === '' ? null : Number(editF.sort_order),
        active: editF.active,
      })
      toast('Saved')
      setEditingCode(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (it) => {
    try {
      await patch(`/reference/${kind}/${encodeURIComponent(it.code)}`, { active: !it.active })
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const resetToDefault = async (it) => {
    if (!confirm(`Reset "${it.name}" to the default name, description and order?`)) return
    try {
      await post(`/reference/${kind}/import`, { codes: [it.source_code], overwrite: true })
      toast('Reset to default')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  const remove = async (it) => {
    if (!confirm(`Delete "${it.name}" from your ${cfg.title.toLowerCase()}?`)) return
    try {
      await del(`/reference/${kind}/${encodeURIComponent(it.code)}`)
      toast('Deleted')
      load()
    } catch (e) { toast(e.message, 'error') }
  }

  return (
    <div>
      {modal === 'defaults' && (
        <PickDefaultsModal kind={kind} cfg={cfg} defaults={defaults}
          onClose={() => setModal(null)}
          onImported={(n) => { setModal(null); toast(`Added ${n} ${cfg.single}${n === 1 ? '' : 's'}`); load() }} />
      )}
      {modal === 'custom' && (
        <AddCustomModal kind={kind} cfg={cfg}
          onClose={() => setModal(null)}
          onCreated={() => { setModal(null); toast('Added'); load() }} />
      )}

      <div className="ph">
        <h1>{cfg.title}</h1>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-secondary" disabled={loading || remaining === 0}
              onClick={() => setModal('defaults')}>
              + Add from defaults{remaining > 0 && !loading ? ` (${remaining})` : ''}
            </button>
            <button className="btn btn-primary" onClick={() => setModal('custom')}>
              + Add custom
            </button>
          </div>
        )}
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        {cfg.intro}
      </p>

      <div className="card">
        {loading ? <div className="spinner" /> : items.length === 0 ? (
          <div className="empty">
            <strong>No {cfg.title.toLowerCase()} yet</strong>
            {isAdmin ? (
              <>
                Start from the defaults and keep the ones that fit your shop.
                <div style={{ marginTop: 14 }}>
                  <button className="btn btn-primary" onClick={() => setModal('defaults')}>
                    Choose defaults
                  </button>
                </div>
              </>
            ) : 'Your shop admin hasn’t set these up yet.'}
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: 70 }}>{cfg.orderLabel}</th>
                <th style={{ width: 80 }}>Code</th>
                <th>Name</th>
                <th>Description</th>
                <th style={{ width: 90 }}>Source</th>
                <th style={{ width: 90 }}>Status</th>
                {isAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {items.map(it => {
                const editing = editingCode === it.code
                return (
                  <tr key={it.code} style={{ opacity: it.active || editing ? 1 : 0.6 }}>
                    <td>
                      {editing ? (
                        <input type="number" value={editF.sort_order}
                          onChange={e => setEditF(x => ({ ...x, sort_order: e.target.value }))}
                          style={{ ...smallInput, width: 60 }} />
                      ) : it.sort_order}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{it.code}</td>
                    <td style={{ fontWeight: 500 }}>
                      {editing ? (
                        <input value={editF.name} maxLength={120}
                          onChange={e => setEditF(x => ({ ...x, name: e.target.value }))}
                          style={{ ...smallInput, width: '100%' }} />
                      ) : it.name}
                    </td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {editing ? (
                        <textarea rows={2} value={editF.description} maxLength={500}
                          onChange={e => setEditF(x => ({ ...x, description: e.target.value }))}
                          style={{ ...smallInput, width: '100%' }} />
                      ) : (it.description || '—')}
                    </td>
                    <td>{sourceBadge(it)}</td>
                    <td>
                      {editing ? (
                        <label style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input type="checkbox" checked={editF.active}
                            onChange={e => setEditF(x => ({ ...x, active: e.target.checked }))} />
                          Active
                        </label>
                      ) : it.active
                        ? <span className="badge badge-green">Active</span>
                        : <span className="badge badge-gray">Inactive</span>}
                    </td>
                    {isAdmin && (
                      <td>
                        {editing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" disabled={saving || !editF.name.trim()}
                              onClick={() => saveEdit(it.code)}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={() => setEditingCode(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(it)}>Edit</button>
                            <button className="btn btn-secondary btn-sm" onClick={() => toggleActive(it)}>
                              {it.active ? 'Deactivate' : 'Activate'}
                            </button>
                            {isEdited(it) && (
                              <button className="btn btn-secondary btn-sm" onClick={() => resetToDefault(it)}>
                                Reset
                              </button>
                            )}
                            <button className="btn btn-secondary btn-sm" onClick={() => remove(it)}>Delete</button>
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
