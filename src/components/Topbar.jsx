import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'
export default function Topbar() {
  const { shopName, logout } = useAuth()
  const nav = useNavigate()
  return (
    <header style={{ height:'var(--topbar-h)', background:'var(--surface)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 22px', flexShrink:0 }}>
      <span style={{ fontWeight:600, fontSize:15 }}>{shopName}</span>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--accent)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:600 }}>
          {shopName?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => { logout(); nav('/login') }}>Log out</button>
      </div>
    </header>
  )
}
