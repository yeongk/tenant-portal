import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
const ROLES = ['SHOP_ADMIN','SUPERVISOR','MECHANIC']
const ROLE_BADGE = { SHOP_ADMIN:'badge-purple', SUPERVISOR:'badge-blue', MECHANIC:'badge-gray' }
function Modal({ onClose, onDone }) {
  const { post } = useApi(); const toast = useToast()
  const [f, setF] = useState({ full_name:'', email:'', role:'MECHANIC', specialty:'', phone:'' })
  const [loading, setLoading] = useState(false)
  const set = (k,v) => setF(x=>({...x,[k]:v}))
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try { await post('/staff', f); toast('Staff member added'); onDone() }
    catch(err) { toast(err.message,'error') } finally { setLoading(false) }
  }
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hd"><h2>Add Staff Member</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={submit}>
          <div className="fg"><label>Full Name</label><input value={f.full_name} onChange={e=>set('full_name',e.target.value)} required /></div>
          <div className="fg"><label>Email</label><input type="email" value={f.email} onChange={e=>set('email',e.target.value)} required /></div>
          <div className="fg"><label>Role</label><select value={f.role} onChange={e=>set('role',e.target.value)}>{ROLES.map(r=><option key={r}>{r}</option>)}</select></div>
          <div className="fg"><label>Specialty</label><input value={f.specialty} onChange={e=>set('specialty',e.target.value)} placeholder="e.g. Engine rebuild, Paint" /></div>
          <div className="fg"><label>Phone (optional)</label><input value={f.phone} onChange={e=>set('phone',e.target.value)} /></div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:6}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Adding…':'Add Staff'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default function Staff() {
  const { get, del } = useApi(); const toast = useToast()
  const [staff, setStaff] = useState([]); const [loading, setLoading] = useState(true)
  const [role, setRole] = useState(''); const [modal, setModal] = useState(false)
  const load = () => { setLoading(true); get('/staff').then(d=>setStaff(d.items??[])).catch(e=>toast(e.message,'error')).finally(()=>setLoading(false)) }
  useEffect(load, [])
  const visible = role ? staff.filter(s=>s.role===role) : staff
  const remove = async (id) => {
    if (!confirm('Remove this staff member?')) return
    try { await del(`/staff/${id}`); toast('Removed'); load() } catch(e) { toast(e.message,'error') }
  }
  return (
    <div>
      {modal && <Modal onClose={()=>setModal(false)} onDone={()=>{setModal(false);load()}} />}
      <div className="ph"><h1>Staff</h1><button className="btn btn-primary" onClick={()=>setModal(true)}>+ Add Staff</button></div>
      <div className="fbar">
        <select value={role} onChange={e=>setRole(e.target.value)}><option value="">All roles</option>{ROLES.map(r=><option key={r}>{r}</option>)}</select>
      </div>
      <div className="card">
        {loading ? <div className="spinner"/> : visible.length===0 ? (
          <div className="empty"><strong>No staff found</strong>Add your first team member.</div>
        ) : (
          <table><thead><tr><th>Name</th><th>Role</th><th>Email</th><th>Specialty</th><th></th></tr></thead>
          <tbody>{visible.map(s=>(
            <tr key={s.staff_id}>
              <td style={{fontWeight:500}}>{s.full_name}</td>
              <td><span className={`badge ${ROLE_BADGE[s.role]??'badge-gray'}`}>{s.role}</span></td>
              <td>{s.email}</td>
              <td style={{color:'var(--muted)'}}>{s.specialty||'—'}</td>
              <td><button className="btn btn-secondary btn-sm" onClick={()=>remove(s.staff_id)}>Remove</button></td>
            </tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  )
}
