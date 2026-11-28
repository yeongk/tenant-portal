import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'

// ── Roles page ────────────────────────────────────────────────────────────────
//
// Role is a separate construct from Cognito group. Cognito groups are limited
// to SHOP_ADMIN (shop owner), MECHANIC (shop staff resource — all internal
// workforce), and CLIENT (end customer). This page manages the business roles
// (supervisor, mechanic, master engine builder, advisor, etc.) that get
// assigned to MECHANIC-group staff on the Staff page's Role field.
//
// Each role carries a worker designation (short code + name, e.g. "MT" /
// "Master Technician") and an experience level. Every field is editable.

export const EXPERIENCE_LEVELS = ['Apprentice', 'Junior', 'Intermediate', 'Senior', 'Master']

const EMPTY_ROLE = {
  name: '', description: '', designation_code: '', designation_name: '', experience_level: '',
}

// Request body for POST/PATCH. Optional fields are sent as (trimmed) strings —
// an empty string clears the field on PATCH.
const toBody = (f) => ({
  name:             f.name.trim(),
  description:      f.description.trim(),
  designation_code: f.designation_code.trim(),
  designation_name: f.designation_name.trim(),
  experience_level: f.experience_level,
})

const fromRole = (r) => ({
  name:             r.name || '',
  description:      r.description || '',
  designation_code: r.designation_code || '',
  designation_name: r.designation_name || '',
  experience_level: r.experience_level || '',
})

// Keeps a stored level that isn't in the standard list selectable.
function ExperienceSelect({ value, onChange, style }) {
  const options = value && !EXPERIENCE_LEVELS.includes(value)
    ? [...EXPERIENCE_LEVELS, value] : EXPERIENCE_LEVELS
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={style}>
      <option value="">Not set</option>
      {options.map(l => <option key={l} value={l}>{l}</option>)}
    </select>
  )
}

function designationLabel(r) {
  if (r.designation_code && r.designation_name) return `${r.designation_code} — ${r.designation_name}`
  return r.designation_code || r.designation_name || ''
}

function AddRoleModal({ onClose, onCreated }) {
  const { post } = useApi()
  const toast    = useToast()
  const [f, setF]       = useState(EMPTY_ROLE)
  const [loading, setL] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) { toast('Role name is required', 'error'); return }
    setL(true)
    try {
      const created = await post('/roles', toBody(f))
      onCreated(created)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setL(false)
    }
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-hd">
          <h2>Add Role</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="fg"><label>Name</label>
            <input value={f.name} onChange={e => set('name', e.target.value)}
              placeholder="e.g. Supervisor, Master Engine Builder" required />
          </div>
          <div className="fg"><label>Description</label>
            <input value={f.description} onChange={e => set('description', e.target.value)}
              placeholder="Optional — what this role covers" />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div className="fg" style={{ width: 120 }}><label>Designation Code</label>
              <input value={f.designation_code} maxLength={20}
                onChange={e => set('designation_code', e.target.value)} placeholder="e.g. MT" />
            </div>
            <div className="fg" style={{ flex: 1 }}><label>Designation Name</label>
              <input value={f.designation_name} maxLength={100}
                onChange={e => set('designation_name', e.target.value)}
                placeholder="e.g. Master Technician" />
            </div>
          </div>
          <div className="fg"><label>Experience Level</label>
            <ExperienceSelect value={f.experience_level} onChange={v => set('experience_level', v)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add Role'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Roles() {
  const { get, del, patch } = useApi()
  const toast     = useToast()
  const [roles,   setRoles]   = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)

  // Row-level edit — every field (name, description, designation code/name,
  // experience level).
  const [editingId, setEditingId] = useState(null)
  const [editF,      setEditF]     = useState(EMPTY_ROLE)
  const [saving,     setSaving]    = useState(false)
  const setE = (k, v) => setEditF(x => ({ ...x, [k]: v }))

  const load = () => {
    setLoading(true)
    get('/roles')
      .then(d => setRoles(d.items ?? []))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const handleCreated = () => {
    setShowAdd(false)
    toast('Role added')
    load()
  }

  const handleRemove = async (id) => {
    if (!confirm('Delete this role? Staff currently assigned to it will keep the ' +
                  'assignment but show no role name until reassigned.')) return
    try { await del(`/roles/${id}`); toast('Role deleted'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const startEdit = (r) => {
    setEditingId(r.role_id)
    setEditF(fromRole(r))
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditF(EMPTY_ROLE)
  }
  const saveEdit = async (id) => {
    if (!editF.name.trim()) { toast('Role name is required', 'error'); return }
    setSaving(true)
    try {
      await patch(`/roles/${id}`, toBody(editF))
      toast('Role updated')
      setEditingId(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const cellInput = { padding: '4px 8px', fontSize: 13 }

  return (
    <div>
      {showAdd && (
        <AddRoleModal onClose={() => setShowAdd(false)} onCreated={handleCreated} />
      )}

      <div className="ph">
        <h1>Roles</h1>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Role</button>
      </div>

      <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: -8, marginBottom: 18 }}>
        Business roles assigned to staff on the Staff page — distinct from Cognito
        access groups. Every staff account is added to the MECHANIC group; the
        role below (supervisor, mechanic, master engine builder, advisor, etc.)
        tracks their title, description, worker designation, and experience level.
      </p>

      <div className="card">
        {loading ? <div className="spinner" /> : roles.length === 0 ? (
          <div className="empty">
            <strong>No roles yet</strong>Add your first role (e.g. Mechanic, Supervisor).
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Description</th><th>Worker Designation</th>
                <th>Experience Level</th><th></th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => {
                const editing = editingId === r.role_id
                return (
                  <tr key={r.role_id}>
                    <td style={{ fontWeight: 500 }}>
                      {editing ? (
                        <input value={editF.name} onChange={e => setE('name', e.target.value)}
                          style={cellInput} />
                      ) : r.name}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {editing ? (
                        <input value={editF.description}
                          onChange={e => setE('description', e.target.value)}
                          placeholder="Optional" style={{ ...cellInput, width: '100%' }} />
                      ) : (r.description || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <input value={editF.designation_code} maxLength={20}
                            onChange={e => setE('designation_code', e.target.value)}
                            placeholder="Code" style={{ ...cellInput, width: 70 }} />
                          <input value={editF.designation_name} maxLength={100}
                            onChange={e => setE('designation_name', e.target.value)}
                            placeholder="Name" style={{ ...cellInput, minWidth: 140 }} />
                        </div>
                      ) : (designationLabel(r) || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <ExperienceSelect value={editF.experience_level}
                          onChange={v => setE('experience_level', v)} style={cellInput} />
                      ) : (r.experience_level
                        ? <span className="badge badge-gray">{r.experience_level}</span>
                        : '—')}
                    </td>
                    <td>
                      {editing ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-primary btn-sm" disabled={saving}
                            onClick={() => saveEdit(r.role_id)}>
                            {saving ? 'Saving…' : 'Save'}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>
                            Edit
                          </button>
                          <button className="btn btn-secondary btn-sm"
                            onClick={() => handleRemove(r.role_id)}>
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
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
