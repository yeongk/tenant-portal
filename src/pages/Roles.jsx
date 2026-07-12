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

function AddRoleModal({ onClose, onCreated }) {
  const { post } = useApi()
  const toast    = useToast()
  const [f, setF]       = useState({ name: '', description: '', billing_rate: '' })
  const [loading, setL] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setL(true)
    try {
      const created = await post('/roles', {
        name: f.name,
        description: f.description || null,
        billing_rate: f.billing_rate === '' ? null : Number(f.billing_rate),
      })
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
          <div className="fg"><label>Billing Rate ($/hr)</label>
            <input type="number" min="0" step="0.01" value={f.billing_rate}
              onChange={e => set('billing_rate', e.target.value)} placeholder="Optional" />
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

  // Row-level edit — name, description, billing_rate.
  const [editingId, setEditingId] = useState(null)
  const [editF,      setEditF]     = useState({ name: '', description: '', billing_rate: '' })
  const [saving,     setSaving]    = useState(false)

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
    setEditF({
      name: r.name || '',
      description: r.description || '',
      billing_rate: r.billing_rate ?? '',
    })
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditF({ name: '', description: '', billing_rate: '' })
  }
  const saveEdit = async (id) => {
    setSaving(true)
    try {
      await patch(`/roles/${id}`, {
        name: editF.name,
        description: editF.description || null,
        billing_rate: editF.billing_rate === '' ? null : Number(editF.billing_rate),
      })
      toast('Role updated')
      setEditingId(null)
      load()
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

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
        tracks their title, description, and billing rate.
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
                <th>Name</th><th>Description</th><th>Billing Rate</th><th></th>
              </tr>
            </thead>
            <tbody>
              {roles.map(r => {
                const editing = editingId === r.role_id
                return (
                  <tr key={r.role_id}>
                    <td style={{ fontWeight: 500 }}>
                      {editing ? (
                        <input
                          value={editF.name}
                          onChange={e => setEditF(x => ({ ...x, name: e.target.value }))}
                          style={{ padding: '4px 8px', fontSize: 13 }}
                        />
                      ) : r.name}
                    </td>
                    <td style={{ color: 'var(--muted)' }}>
                      {editing ? (
                        <input
                          value={editF.description}
                          onChange={e => setEditF(x => ({ ...x, description: e.target.value }))}
                          placeholder="Optional"
                          style={{ padding: '4px 8px', fontSize: 13, width: '100%' }}
                        />
                      ) : (r.description || '—')}
                    </td>
                    <td>
                      {editing ? (
                        <input
                          type="number" min="0" step="0.01"
                          value={editF.billing_rate}
                          onChange={e => setEditF(x => ({ ...x, billing_rate: e.target.value }))}
                          placeholder="Optional"
                          style={{ padding: '4px 8px', fontSize: 13, width: 100 }}
                        />
                      ) : (r.billing_rate ? `$${r.billing_rate}/hr` : '—')}
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
