import React from 'react'
import { NavLink } from 'react-router-dom'
const NAV = [
  { to:'/dashboard',  label:'Dashboard' },
  { to:'/workorders', label:'Work Orders' },
  { to:'/customers',  label:'Customers' },
  { to:'/staff',      label:'Staff' },
  { to:'/settings',   label:'Settings' },
]
export default function Sidebar() {
  return (
    <nav style={{ width:'var(--nav-w)', background:'var(--surface)', borderRight:'1px solid var(--border)', display:'flex', flexDirection:'column', padding:'18px 0', flexShrink:0 }}>
      <div style={{ padding:'0 18px 16px', fontWeight:700, fontSize:11, letterSpacing:'.06em', color:'var(--muted)', textTransform:'uppercase' }}>Portal</div>
      {NAV.map(({ to, label }) => (
        <NavLink key={to} to={to} style={({ isActive }) => ({
          display:'block', padding:'9px 18px', fontSize:14,
          fontWeight: isActive ? 600 : 400,
          color: isActive ? 'var(--accent)' : 'var(--text)',
          background: isActive ? '#edf5e9' : 'transparent',
          borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
        })}>{label}</NavLink>
      ))}
    </nav>
  )
}
