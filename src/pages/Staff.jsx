import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'

const ROLES     = ['SHOP_ADMIN', 'SUPERVISOR', 'MECHANIC']
const ROLE_BADGE = { SHOP_ADMIN: 'badge-purple', SUPERVISOR: 'badge-blue', MECHANIC: 'badge-gray' }

// ── Credentials dialog ────────────────────────────────────────────────────────
// Shown immediately after a staff member is created.
// Displays the temporary password so the admin can share it securely.
// The password is only returned once by the API and is never stored.

function CredentialsDialog({ staff, onClose }) {
  const [copied, setCopied] = useState(false)

  const copyAll = () => {
    const text = `Portal: ${window.location.origin}/login\nEmail:    ${staff.email}\nPassword: ${staff.temp_password}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="modal-hd">
          <h2>Staff Account Created</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {/* Green confirmation banner */}
        <div style={{
          background: '#edf7ed', border: '1px solid #a8d5a2',
          borderRadius: 'var(--radius)', padding: '12px 14px', marginBottom: 18,
        }}>
          <strong style={{ fontSize: 13 }}>
            ✓ {staff.full_name} has been added as {staff.role}
          </strong>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Share the credentials below with the new staff member. This password
            is shown <strong>once only</strong> and cannot be retrieved later.
          </p>
        </div>

        {/* Credentials block */}
        <div style={{
          background: 'var(--bg)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', padding: '14px 16px', marginBottom: 16,
          fontFamily: 'monospace', fontSize: 13, lineHeight: 2,
        }}>
          <div>
            <span style={{ color: 'var(--muted)', display: 'inline-block', width: 80 }}>Portal</span>
            <span>{window.location.origin}/login</span>
          </div>
          <div>
            <span style={{ color: 'var(--muted)', display: 'inline-block', width: 80 }}>Email</span>
            <span style={{ userSelect: 'all' }}>{staff.email}</span>
          </div>
          <div>
            <span style={{ color: 'var(--muted)', display: 'inline-block', width: 80 }}>Password</span>
            <span style={{ userSelect: 'all', fontWeight: 700, letterSpacing: '0.04em' }}>
              {staff.temp_password}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={copyAll}>
            {copied ? '✓ Copied' : 'Copy credentials'}
          </button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}

// ── Add Staff modal ───────────────────────────────────────────────────────────

function AddStaffModal({ onClose, onCreated }) {
  const { post } = useApi()
  const toast    = useToast()
  const [f, setF]       = useState({ full_name: '', email: '', role: 'MECHANIC', specialty: '', phone: '' })
  const [loading, setL] = useState(false)
  const set = (k, v) => setF(x => ({ ...x, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setL(true)
    try {
      const created = await post('/staff', f)
      // Pass the full response (including temp_password) up to the parent
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
          <h2>Add Staff Member</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <div className="fg"><label>Full Name</label>
            <input value={f.full_name} onChange={e => set('full_name', e.target.value)} required />
          </div>
          <div className="fg"><label>Email</label>
            <input type="email" value={f.email} onChange={e => set('email', e.target.value)} required />
          </div>
          <div className="fg"><label>Role</label>
            <select value={f.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="fg"><label>Specialty</label>
            <input value={f.specialty} onChange={e => set('specialty', e.target.value)}
              placeholder="e.g. Engine rebuild, Paint" />
          </div>
          <div className="fg"><label>Phone (optional)</label>
            <input value={f.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 6 }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Adding…' : 'Add Staff'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Staff page ────────────────────────────────────────────────────────────────

export default function Staff() {
  const { get, del, patch } = useApi()
  const toast        = useToast()
  const { cogGroup }  = useAuth()
  const isShopAdmin   = cogGroup === 'SHOP_ADMIN'
  const [staff,      setStaff]   = useState([])
  const [loading,    setLoading] = useState(true)
  const [roleFilter, setRole]    = useState('')
  const [showAdd,    setShowAdd] = useState(false)
  // newStaff holds the freshly-created staff item (with temp_password) to show
  // the credentials dialog. Cleared when the admin dismisses the dialog.
  const [newStaff,   setNewStaff] = useState(null)

  // Row-level edit — specialty only. SHOP_ADMIN only (enforced server-side too).
  const [editingId,     setEditingId]     = useState(null)
  const [editSpecialty, setEditSpecialty] = useState('')
  const [saving,        setSaving]        = useState(false)

  const load = () => {
    setLoading(true)
    get('/staff')
      .then(d => setStaff(d.items ?? []))
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [])

  const visible = roleFilter ? staff.filter(s => s.role === roleFilter) : staff

  const handleCreated = (created) => {
    setShowAdd(false)
    setNewStaff(created)   // trigger credentials dialog
    load()                  // refresh table
  }

  const handleRemove = async (id) => {
    if (!confirm('Remove this staff member?')) return
    try { await del(`/staff/${id}`); toast('Removed'); load() }
    catch (e) { toast(e.message, 'error') }
  }

  const startEdit = (s) => {
    setEditingId(s.staff_id)
    setEditSpecialty(s.specialty || '')
  }
  const cancelEdit = () => {
    setEditingId(null)
    setEditSpecialty('')
  }
  const saveEdit = async (id) => {
    setSaving(true)
    try {
      await patch(`/staff/${id}`, { specialty: editSpecialty })
      toast('Staff updated')
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
      {/* Add staff modal */}
      {showAdd && (
        <AddStaffModal
          onClose={() => setShowAdd(false)}
          onCreated={handleCreated}
        />
      )}

      {/* Credentials dialog — shown after successful creation */}
      {newStaff && (
        <CredentialsDialog
          staff={newStaff}
          onClose={() => setNewStaff(null)}
        />
      )}

      <div className="ph">
        <h1>Staff</h1>
        {isShopAdmin && (
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Staff</button>
        )}
      </div>

      <div className="fbar">
        <select value={roleFilter} onChange={e => setRole(e.target.value)}>
          <option value="">All roles</option>
          {ROLES.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>

      <div className="card">
        {loading ? <div className="spinner" /> : visible.length === 0 ? (
          <div className="empty"><strong>No staff found</strong>Add your first team member.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Role</th><th>Email</th><th>Specialty</th>
                {isShopAdmin && <th></th>}
              </tr>
            </thead>
            <tbody>
              {visible.map(s => {
                const editing = editingId === s.staff_id
                return (
                  <tr key={s.staff_id}>
                    <td style={{ fontWeight: 500 }}>{s.full_name}</td>
                    <td><span className={`badge ${ROLE_BADGE[s.role] ?? 'badge-gray'}`}>{s.role}</span></td>
                    <td>{s.email}</td>
                    <td style={{ color: 'var(--muted)' }}>
                      {editing ? (
                        <input
                          value={editSpecialty}
                          onChange={e => setEditSpecialty(e.target.value)}
                          placeholder="e.g. Engine rebuild, Paint"
                          style={{ padding: '4px 8px', fontSize: 13 }}
                        />
                      ) : (s.specialty || '—')}
                    </td>
                    {isShopAdmin && (
                      <td>
                        {editing ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-primary btn-sm" disabled={saving}
                              onClick={() => saveEdit(s.staff_id)}>
                              {saving ? 'Saving…' : 'Save'}
                            </button>
                            <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => startEdit(s)}>
                              Edit
                            </button>
                            <button className="btn btn-secondary btn-sm"
                              onClick={() => handleRemove(s.staff_id)}>
                              Remove
                            </button>
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
