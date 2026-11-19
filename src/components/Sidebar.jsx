import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const NAV = [
  { to: '/dashboard',  label: 'Dashboard' },
  { to: '/workorders', label: 'Work Orders' },
  { to: '/customers',  label: 'Customers' },
  { to: '/staff',      label: 'Staff' },
  { to: '/settings',   label: 'Settings' },
]

const ADMIN_NAV = [
  { to: '/roles', label: 'Roles' },
  {
    label: 'Reference Data',
    base:  '/reference',
    children: [
      { to: '/reference/work-phases',         label: 'Work Phase' },
      { to: '/reference/labor-types',         label: 'Labor Type' },
      { to: '/reference/worker-designations', label: 'Worker Designation' },
    ],
  },
  { to: '/client-portal-settings', label: 'Client Portal' },
]

const linkStyle = (indent = false) => ({ isActive }) => ({
  display: 'block', padding: indent ? '7px 18px 7px 34px' : '9px 18px',
  fontSize: indent ? 13 : 14,
  fontWeight:  isActive ? 600 : 400,
  color:       isActive ? 'var(--accent)' : 'var(--text)',
  background:  isActive ? '#edf5e9' : 'transparent',
  borderLeft:  isActive ? '3px solid var(--accent)' : '3px solid transparent',
})

function NavGroup({ label, base, children }) {
  const { pathname } = useLocation()
  const inGroup = pathname.startsWith(base)
  const [open, setOpen] = useState(inGroup)

  // Expand when navigating into the group from elsewhere (e.g. a deep link).
  useEffect(() => { if (inGroup) setOpen(true) }, [inGroup])

  const Chevron = open ? ChevronDown : ChevronRight
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', padding: '9px 18px', fontSize: 14, textAlign: 'left',
          background: 'transparent', border: 'none', cursor: 'pointer',
          borderLeft: '3px solid transparent',
          fontWeight: inGroup ? 600 : 400,
          color: inGroup ? 'var(--accent)' : 'var(--text)',
        }}
      >
        {label}
        <Chevron size={15} style={{ color: 'var(--muted)' }} />
      </button>
      {open && children.map(({ to, label: childLabel }) => (
        <NavLink key={to} to={to} style={linkStyle(true)}>{childLabel}</NavLink>
      ))}
    </div>
  )
}

export default function Sidebar() {
  const { isAdmin } = useAuth()
  const links = isAdmin ? [...NAV, ...ADMIN_NAV] : NAV

  return (
    <nav style={{
      width: 'var(--nav-w)', background: 'var(--surface)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      padding: '18px 0', flexShrink: 0,
    }}>
      <div style={{
        padding: '0 18px 16px', fontWeight: 700, fontSize: 11,
        letterSpacing: '.06em', color: 'var(--muted)', textTransform: 'uppercase',
      }}>Portal</div>

      {links.map(item => item.children
        ? <NavGroup key={item.label} {...item} />
        : <NavLink key={item.to} to={item.to} style={linkStyle()}>{item.label}</NavLink>
      )}
    </nav>
  )
}
