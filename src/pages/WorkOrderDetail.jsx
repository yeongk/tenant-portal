import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
const STATUSES = ['Unassigned','In Progress','Awaiting Approval','Complete']
const STAGES   = ['Intake','Disassembly','Mechanical','Valve Adjustment','Body','Paint','Assembly','QC','Complete']
const SB = { Unassigned:'badge-gray','In Progress':'badge-yellow','Awaiting Approval':'badge-yellow',Complete:'badge-green' }
const VIS_B = { INTERNAL:'badge-gray', CLIENT_VISIBLE:'badge-green' }
function TimelineComposer({ woId, onPosted }) {
  const { post } = useApi(); const toast = useToast()
  const [body, setBody] = useState(''); const [vis, setVis] = useState('INTERNAL'); const [loading, setL] = useState(false)
  const submit = async (e) => {
    e.preventDefault(); if (!body.trim()) return; setL(true)
    try { await post(`/workorders/${woId}/timeline`,{body,visibility:vis}); toast('Update posted'); setBody(''); onPosted() }
    catch(err){ toast(err.message,'error') } finally { setL(false) }
  }
  return (
    <form onSubmit={submit} style={{marginBottom:24,background:'var(--bg)',border:'1px solid var(--border)',borderRadius:6,padding:14}}>
      <div className="fg"><textarea rows={3} placeholder="Write an update…" value={body} onChange={e=>setBody(e.target.value)} style={{resize:'vertical'}}/></div>
      <div style={{display:'flex',alignItems:'center',gap:10}}>
        <select value={vis} onChange={e=>setVis(e.target.value)} style={{padding:'5px 8px',border:'1px solid var(--border)',borderRadius:4,fontSize:13}}>
          <option value="INTERNAL">Internal only</option>
          <option value="CLIENT_VISIBLE">Client visible</option>
        </select>
        <button className="btn btn-primary btn-sm" disabled={loading||!body.trim()}>{loading?'Posting…':'Post Update'}</button>
      </div>
    </form>
  )
}
function TimelineFeed({ entries }) {
  if (!entries.length) return <div className="empty"><strong>No updates yet</strong>Post the first timeline entry.</div>
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      {entries.map(e=>(
        <div key={e.tl_id} style={{border:'1px solid var(--border)',borderRadius:6,padding:14,background:'var(--surface)'}}>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:6}}>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              {e.title&&<strong style={{fontSize:13}}>{e.title}</strong>}
              <span className={`badge ${VIS_B[e.visibility]??'badge-gray'}`} style={{fontSize:10}}>{e.visibility==='CLIENT_VISIBLE'?'Client visible':'Internal'}</span>
            </div>
            <span style={{fontSize:11,color:'var(--muted)'}}>{e.author_email} &bull; {e.created_at?.slice(0,16).replace('T',' ')}</span>
          </div>
          <p style={{fontSize:13,whiteSpace:'pre-wrap'}}>{e.body}</p>
        </div>
      ))}
    </div>
  )
}
export default function WorkOrderDetail() {
  const { id } = useParams(); const nav = useNavigate()
  const { get, patch } = useApi(); const toast = useToast()
  const [wo, setWo] = useState(null); const [tl, setTl] = useState([])
  const [tab, setTab] = useState('timeline'); const [loading, setL] = useState(true)
  const loadWo = () => get(`/workorders/${id}`).then(setWo).catch(e=>toast(e.message,'error'))
  const loadTl = () => get(`/workorders/${id}/timeline`).then(d=>setTl(d.items??[])).catch(()=>{})
  useEffect(()=>{ setL(true); Promise.all([loadWo(),loadTl()]).finally(()=>setL(false)) },[id])
  const handlePatch = async (k,v) => {
    try { const updated = await patch(`/workorders/${id}`,{[k]:v}); setWo(updated); toast('Updated') }
    catch(e){ toast(e.message,'error') }
  }
  if (loading) return <div className="spinner" style={{marginTop:60}}/>
  if (!wo) return <div className="empty"><strong>Work order not found</strong><button className="btn btn-secondary btn-sm" style={{marginTop:10}} onClick={()=>nav('/workorders')}>← Back</button></div>
  return (
    <div>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <button style={{background:'none',border:'none',color:'var(--muted)',cursor:'pointer',fontSize:13,marginBottom:8}} onClick={()=>nav('/workorders')}>← Work Orders</button>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h1 style={{fontSize:20,fontWeight:700}}>{wo.name}</h1>
            <div style={{display:'flex',gap:10,marginTop:6,flexWrap:'wrap',fontSize:13,color:'var(--muted)'}}>
              <span>Customer: <strong style={{color:'var(--text)'}}>{wo.customer_name||'—'}</strong></span>
              <span>Vehicle: <strong style={{color:'var(--text)'}}>{wo.vehicle_label||'—'}</strong></span>
              <span>Staff: <strong style={{color:'var(--text)'}}>{(wo.staff??[]).map(s=>s.name).join(', ')||'—'}</strong></span>
            </div>
          </div>
          <span className={`badge ${SB[wo.status]??'badge-gray'}`} style={{fontSize:12}}>{wo.status}</span>
        </div>
      </div>
      {/* Tabs */}
      <div className="tabs">
        {['timeline','details','assignments'].map(t=>(
          <button key={t} className={`tab${tab===t?' active':''}`} onClick={()=>setTab(t)}>
            {t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      {/* Timeline */}
      {tab==='timeline'&&(
        <div>
          <TimelineComposer woId={id} onPosted={()=>{loadTl();loadWo()}}/>
          <TimelineFeed entries={tl}/>
        </div>
      )}
      {/* Details */}
      {tab==='details'&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
          <div className="card" style={{padding:18}}>
            <h3 style={{fontWeight:600,marginBottom:14,fontSize:14}}>Work Order</h3>
            <div className="fg"><label>Status</label>
              <select value={wo.status} onChange={e=>handlePatch('status',e.target.value)}>
                {STATUSES.map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div className="fg"><label>Stage</label>
              <select value={wo.stage||'Intake'} onChange={e=>handlePatch('stage',e.target.value)}>
                {STAGES.map(s=><option key={s}>{s}</option>)}
              </select></div>
            <div className="fg"><label>Target Date</label><input type="date" value={wo.target_date||''} onChange={e=>handlePatch('target_date',e.target.value)}/></div>
            <div className="fg"><label>Estimated Cost ($)</label><input type="number" value={wo.estimated_cost||''} onBlur={e=>handlePatch('estimated_cost',e.target.value)} onChange={()=>{}}/></div>
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:14}}>
            {wo.customer&&(
              <div className="card" style={{padding:16}}>
                <h3 style={{fontWeight:600,marginBottom:10,fontSize:14}}>Customer</h3>
                <p style={{fontWeight:500}}>{wo.customer.full_name}</p>
                <p style={{color:'var(--muted)',fontSize:13}}>{wo.customer.email}</p>
                {wo.customer.phone&&<p style={{color:'var(--muted)',fontSize:13}}>{wo.customer.phone}</p>}
              </div>
            )}
            {wo.vehicle_label&&(
              <div className="card" style={{padding:16}}>
                <h3 style={{fontWeight:600,marginBottom:6,fontSize:14}}>Vehicle</h3>
                <p style={{fontWeight:500}}>{wo.vehicle_label}</p>
              </div>
            )}
          </div>
        </div>
      )}
      {/* Assignments */}
      {tab==='assignments'&&(
        <div className="card">
          {(wo.staff??[]).length===0?(
            <div className="empty"><strong>No staff assigned</strong>Assign staff from the work order creation form.</div>
          ):(
            <table><thead><tr><th>Name</th><th>Vehicle</th><th>Status</th><th>Entry</th><th>Target</th></tr></thead>
            <tbody>{(wo.staff??[]).map(s=>(
              <tr key={s.staff_id}>
                <td style={{fontWeight:500}}>{s.name}</td>
                <td>{wo.vehicle_label||'—'}</td>
                <td><span className={`badge ${SB[wo.status]??'badge-gray'}`}>{wo.status}</span></td>
                <td>{wo.entry_date||'—'}</td>
                <td>{wo.target_date||'—'}</td>
              </tr>
            ))}</tbody></table>
          )}
        </div>
      )}
    </div>
  )
}
