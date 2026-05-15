import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useBranding } from '../context/BrandingContext'
import { useNavigate } from 'react-router-dom'

export default function Topbar() {
  const { shopName, tenantId, logout } = useAuth()
  const { primary, logoUrl } = useBranding()
  const nav = useNavigate()

  const displayName = shopName || tenantId

  // primary from BrandingContext is the last PUBLISHED colour.
  // Falls back to a neutral dark if no theme has been published yet
  // so the topbar is always visible.
  const bg = primary || '#1f2937'

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: bg,
      borderBottom: `1px solid ${bg}`,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      flexShrink: 0,
      transition: 'background 0.3s ease',
    }}>
      {/* Left: logo + shop name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={displayName}
            style={{ height: 28, maxWidth: 80, objectFit: 'contain' }}
          />
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: '50%',
            background: 'rgba(255,255,255,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, color: '#ffffff',
          }}>
            {displayName?.[0]?.toUpperCase() ?? 'S'}
          </div>
        )}
        <span style={{ fontWeight: 600, fontSize: 15, color: '#ffffff' }}>
          {displayName}
        </span>
      </div>

      {/* Right: user avatar + log out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          color: '#ffffff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600,
        }}>
          {displayName?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#ffffff', background: 'rgba(255,255,255,0.15)' }}
          onClick={() => { logout(); nav('/login') }}
        >
          Log out
        </button>
      </div>
    </header>
  )
}
