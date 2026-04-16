import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
const SB = { Unassigned:'badge-gray', 'In Progress':'badge-yellow', 'Awaiting Approval':'badge-yellow', Complete:'badge-green' }
export default function Dashboard() {
  const { get } = useApi(); const toast = useToast(); const nav = useNavigate()
  const [wos, setWos] = useState([]); const [loading, setLoading] = useState(true)
  useEffect(() => { get('/workorders').then(d=>setWos(d.items??[])).catch(e=>toast(e.message,'error')).finally(()=>setLoading(false)) }, [])
  const cnt = (s) => wos.filter(w=>w.status===s).length
  return (
    <div>
      <div className="ph">
        <h1>Dashboard</h1>
        <div style={{ display:'flex', gap:8 }}>
          <button className="btn btn-secondary" onClick={()=>nav('/staff')}>Assign Mechanic</button>
          <button className="btn btn-primary" onClick={()=>nav('/workorders?new=1')}>+ New Workorder</button>
        </div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14, marginBottom:22 }}>
        {[['New Workorders','Unassigned'],['In Progress','In Progress'],['Awaiting Approval','Awaiting Approval']].map(([label,s])=>(
          <div key={label} className="card" style={{ padding:'18px 22px' }}>
            <div style={{ fontSize:12, color:'var(--muted)', marginBottom:4 }}>{label}</div>
            <div style={{ fontSize:30, fontWeight:700 }}>{loading?'–':cnt(s)}</div>
          </div>
        ))}
      </div>
      <div className="card">
        {loading ? <div className="spinner"/> : wos.length===0 ? (
          <div className="empty"><strong>No work orders yet</strong>Create your first work order to get started.</div>
        ) : (
          <table><thead><tr><th>Workorder</th><th>Staff</th><th>Customer</th><th>Vehicle</th><th>Status</th></tr></thead>
          <tbody>{wos.map(w=>(
            <tr key={w.wo_id} className="clickable" onClick={()=>nav(`/workorders/${w.wo_id}`)}>
              <td style={{fontWeight:500}}>{w.name}</td>
              <td>{(w.staff??[]).map(s=>s.name).join(', ')||'—'}</td>
              <td>{w.customer_name||'—'}</td>
              <td>{w.vehicle_label||'—'}</td>
              <td><span className={`badge ${SB[w.status]??'badge-gray'}`}>{w.status}</span></td>
            </tr>
          ))}</tbody></table>
        )}
      </div>
    </div>
  )
}
