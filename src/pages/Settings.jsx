import React, { useEffect, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
export default function Settings() {
  const { get } = useApi(); const toast = useToast(); const { tenantId } = useAuth()
  const [tenant, setTenant] = useState(null); const [loading, setL] = useState(true)
  useEffect(()=>{ get('/tenant').then(setTenant).catch(e=>toast(e.message,'error')).finally(()=>setL(false)) },[])
  const inviteLink = `${window.location.origin}/login`
  if (loading) return <div className="spinner"/>
  return (
    <div>
      <div className="ph"><h1>Settings</h1></div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
        <div className="card" style={{padding:20}}>
          <h2 style={{fontWeight:600,fontSize:15,marginBottom:16}}>Shop Info</h2>
          <div className="fg"><label>Shop Name</label><input value={tenant?.shop_name??''} readOnly style={{background:'var(--bg)'}}/></div>
          <div className="fg"><label>Subdomain</label><input value={tenant?.tenant_id??tenantId} readOnly style={{background:'var(--bg)'}}/></div>
          <div className="fg"><label>Domain</label><input value={tenant?.domain??''} readOnly style={{background:'var(--bg)'}}/></div>
          <div className="fg"><label>Plan</label><input value={tenant?.plan??''} readOnly style={{background:'var(--bg)'}}/></div>
          {tenant?.phone&&<div className="fg"><label>Phone</label><input value={tenant.phone} readOnly style={{background:'var(--bg)'}}/></div>}
          {tenant?.address&&<div className="fg"><label>Address</label><input value={tenant.address} readOnly style={{background:'var(--bg)'}}/></div>}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:16}}>
          <div className="card" style={{padding:20}}>
            <h2 style={{fontWeight:600,fontSize:15,marginBottom:12}}>Invite Link</h2>
            <p style={{fontSize:13,color:'var(--muted)',marginBottom:10}}>Share this link with staff members to access the portal.</p>
            <div style={{display:'flex',gap:8}}>
              <input value={inviteLink} readOnly style={{flex:1,padding:'7px 10px',border:'1px solid var(--border)',borderRadius:'var(--radius)',fontSize:13,background:'var(--bg)'}}/>
              <button className="btn btn-secondary btn-sm" onClick={()=>{navigator.clipboard.writeText(inviteLink);toast('Copied!')}}>Copy</button>
            </div>
          </div>
          <div className="card" style={{padding:20}}>
            <h2 style={{fontWeight:600,fontSize:15,marginBottom:12}}>Branding</h2>
            <p style={{fontSize:13,color:'var(--muted)'}}>Brand color and logo customization coming soon.</p>
            {tenant?.brand_color&&<div style={{marginTop:10,display:'flex',alignItems:'center',gap:8}}><div style={{width:24,height:24,borderRadius:4,background:tenant.brand_color,border:'1px solid var(--border)'}}/><span style={{fontSize:13}}>{tenant.brand_color}</span></div>}
          </div>
        </div>
      </div>
    </div>
  )
}
