import React from 'react'
import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Topbar() {
  const { shopName, tenantId, logout } = useAuth()
  const nav = useNavigate()

  // shopName comes from the Cognito custom:shopName attribute via the login
  // response. Fall back to tenantId if the attribute is missing/empty so the
  // topbar always shows something recognisable.
  const displayName = shopName || tenantId

  return (
    <header style={{
      height: 'var(--topbar-h)',
      background: 'var(--brand-primary)',
      borderBottom: '1px solid var(--brand-primary-h)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 22px',
      flexShrink: 0,
    }}>
      {/* Left: logo + shop name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Brand logo — shown when the tenant has published a logo.
            The CSS var resolves to url('…') or 'none'; we render an <img>
            only when it's a real URL, otherwise fall back to the initial avatar. */}
        <LogoOrInitial displayName={displayName} />
        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--brand-on-primary)' }}>
          {displayName}
        </span>
      </div>

      {/* Right: user avatar + log out */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          background: 'rgba(255,255,255,0.25)',
          color: 'var(--brand-on-primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, fontWeight: 600,
        }}>
          {displayName?.[0]?.toUpperCase() ?? 'U'}
        </div>
        <button
          className="btn btn-secondary btn-sm"
          style={{ borderColor: 'rgba(255,255,255,0.4)', color: 'var(--brand-on-primary)', background: 'rgba(255,255,255,0.15)' }}
          onClick={() => { logout(); nav('/login') }}
        >
          Log out
        </button>
      </div>
    </header>
  )
}

// ── Logo helper ───────────────────────────────────────────────────────────────
//
// Reads --brand-logo-url from the computed style to decide whether a real
// logo image has been published. Falls back to a translucent initial-letter
// avatar (matching the live preview in BrandingPanel) when no logo is set.

function LogoOrInitial({ displayName }) {
  const ref = React.useRef(null)
  const [logoUrl, setLogoUrl] = React.useState(null)

  React.useLayoutEffect(() => {
    // Re-read whenever the theme <style> tag is (re-)injected.
    // The MutationObserver watches for style changes on <head>.
    const read = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--brand-logo-url').trim()
      // raw is either "none" or "url('https://…')"
      if (raw && raw !== 'none') {
        const match = raw.match(/url\(['"]?([^'")\s]+)['"]?\)/)
        setLogoUrl(match?.[1] ?? null)
      } else {
        setLogoUrl(null)
      }
    }

    read()

    const observer = new MutationObserver(read)
    observer.observe(document.head, { childList: true, subtree: true, characterData: true })
    return () => observer.disconnect()
  }, [])

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={displayName}
        style={{ height: 28, maxWidth: 80, objectFit: 'contain' }}
      />
    )
  }

  return (
    <div style={{
      width: 28, height: 28, borderRadius: '50%',
      background: 'rgba(255,255,255,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 13, fontWeight: 700,
      color: 'var(--brand-on-primary)',
    }}>
      {displayName?.[0]?.toUpperCase() ?? 'S'}
    </div>
  )
}
