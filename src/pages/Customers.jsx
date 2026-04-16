import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
const MAKES   = ['Porsche','BMW','Mercedes-Benz','Alfa Romeo','Ferrari','Lamborghini','Other']
const ENGINES = ['Flat-6','Flat-4','V8','V12','Inline-6','Inline-4','Electric','Other']
const emptyV  = () => ({ year:'', make:'', model:'', engine:'', plate:'', vin:'', nickname:'' })
function VRow({ v, i, onChange, onRemove }) {
  const s = (k,val) => onChange(i,{...v,[k]:val})
  return (
    <div style={{border:'1px solid var(--border)',borderRadius:6,padding:12,marginBottom:10}}>
      <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
        <strong style={{fontSize:13}}>Vehicle {i+1}</strong>
        {i>0 && <button type="button" style={{background:'none',border:'none',color:'var(--danger)',cursor:'pointer',fontSize:13}} onClick={()=>onRemove(i)}>Remove</button>}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
        <div className="fg"><label>Year</label><input value={v.year} onChange={e=>s('year',e.target.value)} placeholder="1973"/></div>
        <div className="fg"><label>Make</label><select value={v.make} onChange={e=>s('make',e.target.value)}><option value="">Select…</option>{MAKES.map(m=><option key={m}>{m}</option>)}</select></div>
        <div className="fg"><label>Model</label><input value={v.model} onChange={e=>s('model',e.target.value)} placeholder="911"/></div>
        <div className="fg"><label>Engine</label><select value={v.engine} onChange={e=>s('engine',e.target.value)}><option value="">Select…</option>{ENGINES.map(m=><option key={m}>{m}</option>)}</select></div>
        <div className="fg"><label>License Plate</label><input value={v.plate} onChange={e=>s('plate',e.target.value)}/></div>
        <div className="fg"><label>VIN</label><input value={v.vin} onChange={e=>s('vin',e.target.value)}/></div>
      </div>
      <div className="fg"><label>Nickname</label><input value={v.nickname} onChange={e=>s('nickname',e.target.value)} placeholder="The Grey Ghost"/></div>
    </div>
  )
}
function Modal({ onClose, onDone }) {
  const { post } = useApi(); const toast = useToast()
  const [f, setF] = useState({ full_name:'', email:'', phone:'' })
  const [vehicles, setV] = useState([emptyV()])
  const [cl, setCl] = useState(true); const [loading, setLoading] = useState(false)
  const sf = (k,v) => setF(x=>({...x,[k]:v}))
  const upV = (i,v) => setV(vs=>vs.map((x,j)=>j===i?v:x))
  const rmV = (i)   => setV(vs=>vs.filter((_,j)=>j!==i))
  const submit = async (e) => {
    e.preventDefault(); setLoading(true)
    try { await post('/customers',{...f,vehicles,create_login:cl}); toast('Customer added'); onDone() }
    catch(err){ toast(err.message,'error') } finally { setLoading(false) }
  }
  return (
    <div className="overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal">
        <div className="modal-hd"><h2>Add Customer</h2><button className="modal-close" onClick={onClose}>×</button></div>
        <form onSubmit={submit}>
          <div className="fg"><label>Full Name</label><input value={f.full_name} onChange={e=>sf('full_name',e.target.value)} required/></div>
          <div className="fg"><label>Email</label><input type="email" value={f.email} onChange={e=>sf('email',e.target.value)} required/></div>
          <div className="fg"><label>Phone</label><input value={f.phone} onChange={e=>sf('phone',e.target.value)}/></div>
          <div style={{fontWeight:500,fontSize:13,marginBottom:8}}>Vehicles</div>
          {vehicles.map((v,i)=><VRow key={i} v={v} i={i} onChange={upV} onRemove={rmV}/>)}
          <button type="button" className="btn btn-secondary btn-sm" style={{marginBottom:14}} onClick={()=>setV(vs=>[...vs,emptyV()])}>+ Add Vehicle</button>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
            <input type="checkbox" id="cl" checked={cl} onChange={e=>setCl(e.target.checked)} style={{width:'auto'}}/>
            <label htmlFor="cl" style={{fontWeight:400,cursor:'pointer'}}>Create portal login for this customer</label>
          </div>
          <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>{loading?'Saving…':'Add Customer'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}
export default function Customers() {
  const { get } = useApi(); const toast = useToast()
  const [customers, setC] = useState([]); const [loading, setL] = useState(true); const [modal, setModal] = useState(false)
  const load = () => { setL(true); get('/customers').then(d=>setC(d.items??[])).catch(e=>toast(e.message,'error')).finally(()=>setL(false)) }
  useEffect(load,[])
  return (
    <div>
      {modal && <Modal onClose={()=>setModal(false)} onDone={()=>{setModal(false);load()}}/>}
      <div className="ph"><h1>Customers</h1><button className="btn btn-primary" onClick={()=>setModal(true)}>+ Add Customer</button></div>
      <div className="card">
        {loading?<div className="spinner"/>:customers.length===0?(
          <div className="empty"><strong>No customers yet</strong>Add your first customer.</div>
        ):(
          <table><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Vehicles</th></tr></thead>
          <tbody>{customers.map(c=>(
            <tr key={c.customer_id}>
              <td style={{fontWeight:500}}>{c.full_name}</td>
              <td>{c.email}</td>
              <td>{c.phone||'—'}</td>
              <td style={{color:'var(--muted)',fontSize:13}}>{(c.vehicles??[]).map(v=>`${v.year||''} ${v.make||''} ${v.model||''}`.trim()).filter(Boolean).join(', ')||'—'}</td>
            </tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  )
}
