import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
const STATUSES = ['Unassigned','In Progress','Awaiting Approval','Complete']
const SB = { Unassigned:'badge-gray','In Progress':'badge-yellow','Awaiting Approval':'badge-yellow',Complete:'badge-green' }

const fmtCost = (val) => (val !== '' && val != null && !Number.isNaN(Number(val)))
  ? `$${Number(val).toFixed(2)}` : '—'

function CreateModal({ onClose, onCreated }) {
  const { get, post } = useApi(); const toast = useToast()
  const [customers, setC] = useState([]); const [staff, setSt] = useState([])
  const [f, setF] = useState({ name:'', description:'', customer_id:'', vehicle_id:'', entry_date:'', target_date:'', estimated_cost:'', staff_ids:[], client_visible:true })
  const [loading, setLoading] = useState(false)
  useEffect(()=>{ Promise.all([get('/customers'),get('/staff')]).then(([c,s])=>{setC(c.items??[]);setSt(s.items??[])}).catch(()=>{}) },[])
  const sf = (k,v) => setF(x=>({...x,[k]:v}))
  const selC = customers.find(c=>c.customer_id===f.customer_id)
  const togSt = (id) => sf('staff_ids', f.staff_ids.includes(id)?f.staff_ids.filter(x=>x!==id):[...f.staff_ids,id])
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try { const wo = await post('/workorders',f); toast('Work order created'); onCreated(wo) }
    catch(err){ toast(err.message,'error') } finally { setLoading(false) }
  }
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hd"><h2>New Work Order</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={submit}>
          <div className="fg"><label>Customer</label>
            <select value={f.customer_id} onChange={e=>sf('customer_id',e.target.value)} required>
              <option value="">Select customer…</option>
              {customers.map(c=><option key={c.customer_id} value={c.customer_id}>{c.full_name}</option>)}
            </select></div>
          {selC?.vehicles?.length>0&&(
            <div className="fg"><label>Vehicle</label>
              <select value={f.vehicle_id} onChange={e=>sf('vehicle_id',e.target.value)}>
                <option value="">Select vehicle…</option>
                {selC.vehicles.map(v=><option key={v.vehicle_id} value={v.vehicle_id}>{v.year} {v.make} {v.model}</option>)}
              </select></div>
          )}
          <div className="fg"><label>Name</label><input value={f.name} onChange={e=>sf('name',e.target.value)} required/></div>
          <div className="fg"><label>Description</label><textarea rows={2} value={f.description} onChange={e=>sf('description',e.target.value)}/></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
            <div className="fg"><label>Entry Date</label><input type="date" value={f.entry_date} onChange={e=>sf('entry_date',e.target.value)}/></div>
            <div className="fg"><label>Target Date</label><input type="date" value={f.target_date} onChange={e=>sf('target_date',e.target.value)}/></div>
            <div className="fg"><label>Est. Cost ($)</label><input type="number" step="0.01" value={f.estimated_cost} onChange={e=>sf('estimated_cost',e.target.value)}/></div>
          </div>
          <div className="fg"><label>Assign Staff</label>
            <div style={{border:'1px solid var(--border)',borderRadius:6,maxHeight:130,overflowY:'auto',padding:8}}>
              {staff.map(s=>(
                <label key={s.staff_id} style={{display:'flex',alignItems:'center',gap:8,padding:'3px 0',cursor:'pointer'}}>
                  <input type="checkbox" checked={f.staff_ids.includes(s.staff_id)} onChange={()=>togSt(s.staff_id)} style={{width:'auto'}}/>
                  {s.full_name} <span style={{color:'var(--muted)',fontSize:12}}>({s.role})</span>
                </label>
              ))}
              {staff.length===0&&<span style={{fontSize:13,color:'var(--muted)'}}>No staff yet</span>}
            </div></div>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <input type="checkbox" id="cv" checked={f.client_visible} onChange={e=>sf('client_visible',e.target.checked)} style={{width:'auto'}}/>
            <label htmlFor="cv" style={{fontWeight:400,cursor:'pointer'}}>Client can view timeline by default</label>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Creating…':'Create'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default function WorkOrders() {
  const { get, patch } = useApi(); const toast = useToast(); const nav = useNavigate()
  const { cogGroup } = useAuth()
  const canManage = cogGroup === 'SHOP_ADMIN' || cogGroup === 'SUPERVISOR'
  const [sp] = useSearchParams()
  const [wos, setWos] = useState([]); const [loading, setL] = useState(true)
  const [modal, setModal] = useState(sp.get('new')==='1')
  const [fSt, setFSt] = useState(''); const [fCu, setFCu] = useState(''); const [fSf, setFSf] = useState('')

  // Vehicle options for the row editor come from the fixed customer on the
  // work order — only SHOP_ADMIN/SUPERVISOR need this, so skip the fetch
  // (and the extra request) for mechanics who can't edit anyway.
  const [customers, setCustomers] = useState([])
  useEffect(() => {
    if (!canManage) return
    get('/customers').then(d => setCustomers(d.items ?? [])).catch(() => {})
  }, [canManage])
  const vehiclesFor = (customerId) => customers.find(c => c.customer_id === customerId)?.vehicles ?? []

  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm]   = useState(null)
  const [saving, setSaving]       = useState(false)

  const load = () => { setL(true); get('/workorders').then(d=>setWos(d.items??[])).catch(e=>toast(e.message,'error')).finally(()=>setL(false)) }
  useEffect(load,[])
  const visible = wos
    .filter(w=>!fSt||w.status===fSt)
    .filter(w=>!fCu||w.customer_name?.toLowerCase().includes(fCu.toLowerCase()))
    .filter(w=>!fSf||(w.staff??[]).some(s=>s.name?.toLowerCase().includes(fSf.toLowerCase())))

  const startEdit = (w, e) => {
    e.stopPropagation()
    setEditingId(w.wo_id)
    setEditForm({
      customer_id: w.customer_id,
      name: w.name,
      vehicle_id: w.vehicle_id || '',
      status: w.status,
      entry_date: w.entry_date || '',
      target_date: w.target_date || '',
      estimated_cost: w.estimated_cost || '',
    })
  }
  const cancelEdit = (e) => { e?.stopPropagation(); setEditingId(null); setEditForm(null) }
  const saveEdit = async (id, e) => {
    e.stopPropagation()
    setSaving(true)
    try {
      await patch(`/workorders/${id}`, {
        name: editForm.name,
        vehicle_id: editForm.vehicle_id || null,
        status: editForm.status,
        entry_date: editForm.entry_date || null,
        target_date: editForm.target_date || null,
        estimated_cost: editForm.estimated_cost === '' ? null : Number(editForm.estimated_cost),
      })
      toast('Work order updated')
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
      {modal&&<CreateModal onClose={()=>setModal(false)} onCreated={(wo)=>{setModal(false);nav(`/workorders/${wo.wo_id}`)}}/>}
      <div className="ph">
        <h1>Work Orders</h1>
        {canManage && <button className="btn btn-primary" onClick={()=>setModal(true)}>+ New Workorder</button>}
      </div>
      <div className="fbar">
        <select value={fSt} onChange={e=>setFSt(e.target.value)}><option value="">All statuses</option>{STATUSES.map(s=><option key={s}>{s}</option>)}</select>
        <input placeholder="Filter by customer…" value={fCu} onChange={e=>setFCu(e.target.value)}/>
        <input placeholder="Filter by staff…"    value={fSf} onChange={e=>setFSf(e.target.value)}/>
      </div>
      <div className="card">
        {loading?<div className="spinner"/>:visible.length===0?(
          <div className="empty"><strong>No work orders</strong>Create your first work order.</div>
        ):(
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Customer</th><th>Staff</th><th>Vehicle</th><th>Status</th>
                <th>Entry</th><th>Target</th><th>Est. Cost</th>{canManage && <th></th>}
              </tr>
            </thead>
            <tbody>{visible.map(w=>{
              const editing = editingId === w.wo_id
              return (
                <tr key={w.wo_id} className={editing ? '' : 'clickable'}
                    onClick={()=>!editing && nav(`/workorders/${w.wo_id}`)}>
                  <td style={{fontWeight:500}}>
                    {editing
                      ? <input value={editForm.name} onClick={e=>e.stopPropagation()}
                          onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
                          style={{padding:'4px 8px',fontSize:13,width:140}}/>
                      : w.name}
                  </td>
                  <td>{w.customer_name||'—'}</td>
                  <td>{(w.staff??[]).map(s=>s.name).join(', ')||'—'}</td>
                  <td>
                    {editing
                      ? <select value={editForm.vehicle_id} onClick={e=>e.stopPropagation()}
                          onChange={e=>setEditForm(f=>({...f,vehicle_id:e.target.value}))}
                          style={{padding:'4px 8px',fontSize:13}}>
                          <option value="">—</option>
                          {vehiclesFor(editForm.customer_id).map(v=>(
                            <option key={v.vehicle_id} value={v.vehicle_id}>{v.year} {v.make} {v.model}</option>
                          ))}
                        </select>
                      : (w.vehicle_label||'—')}
                  </td>
                  <td>
                    {editing
                      ? <select value={editForm.status} onClick={e=>e.stopPropagation()}
                          onChange={e=>setEditForm(f=>({...f,status:e.target.value}))}
                          style={{padding:'4px 8px',fontSize:13}}>
                          {STATUSES.map(s=><option key={s}>{s}</option>)}
                        </select>
                      : <span className={`badge ${SB[w.status]??'badge-gray'}`}>{w.status}</span>}
                  </td>
                  <td>
                    {editing
                      ? <input type="date" value={editForm.entry_date} onClick={e=>e.stopPropagation()}
                          onChange={e=>setEditForm(f=>({...f,entry_date:e.target.value}))}
                          style={{padding:'4px 8px',fontSize:13}}/>
                      : (w.entry_date||'—')}
                  </td>
                  <td>
                    {editing
                      ? <input type="date" value={editForm.target_date} onClick={e=>e.stopPropagation()}
                          onChange={e=>setEditForm(f=>({...f,target_date:e.target.value}))}
                          style={{padding:'4px 8px',fontSize:13}}/>
                      : (w.target_date||'—')}
                  </td>
                  <td>
                    {editing
                      ? <input type="number" step="0.01" value={editForm.estimated_cost} onClick={e=>e.stopPropagation()}
                          onChange={e=>setEditForm(f=>({...f,estimated_cost:e.target.value}))}
                          style={{padding:'4px 8px',fontSize:13,width:90}}/>
                      : fmtCost(w.estimated_cost)}
                  </td>
                  {canManage && (
                    <td onClick={e=>e.stopPropagation()}>
                      {editing ? (
                        <div style={{display:'flex',gap:6}}>
                          <button className="btn btn-primary btn-sm" disabled={saving}
                            onClick={e=>saveEdit(w.wo_id,e)}>{saving?'Saving…':'Save'}</button>
                          <button className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
                        </div>
                      ) : (
                        <button className="btn btn-secondary btn-sm" onClick={e=>startEdit(w,e)}>Edit</button>
                      )}
                    </td>
                  )}
                </tr>
              )
            })}</tbody>
          </table>
        )}
      </div>
    </div>
  )
}
