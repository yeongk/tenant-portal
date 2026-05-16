/**
 * BrandingContext
 *
 * Single source of truth for the PUBLISHED tenant branding:
 *   primary  — brand hex colour, e.g. '#4338ca'
 *   logoUrl  — fresh presigned S3 URL for the logo, or '' if none
 *
 * Hydration trigger
 * ─────────────────
 * The context watches idToken from AuthContext. Whenever idToken becomes
 * non-empty (initial page load with an existing session, OR after a fresh
 * login in the same SPA session), it fires GET /api/tenant and populates
 * primary + logoUrl. This correctly handles the fresh-login case where the
 * useEffect would have run on mount with idToken='' (unauthenticated) and
 * returned early, then re-runs when idToken is set after login().
 *
 * Race-condition safety
 * ─────────────────────
 * setBranding() (called by BrandingPanel on Publish) increments publishSeq.
 * The background fetch checks publishSeq before writing — if a Publish
 * happened while the fetch was in flight, the fetch result is discarded.
 *
 * Why logoUrl cannot come from the CSS cache
 * ──────────────────────────────────────────
 * S3 presigned URLs expire after 1 hour. The CSS cache embeds whatever
 * URL existed at publish time — always stale on the next session.
 * Primary colour is a stable hex and IS safe to seed from the cache.
 */

import React, {
  createContext, useCallback, useContext, useEffect, useRef, useState,
} from 'react'
import { useAuth } from './AuthContext'
import { getCachedThemeCss } from '../utils/brandingTheme'

const API = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`

const BrandingCtx = createContext({
  primary:     '',
  logoUrl:     '',
  setBranding: () => {},
})

function parsePrimaryFromCss(cssText) {
  if (!cssText) return ''
  for (const line of cssText.split('\n')) {
    const s = line.trim()
    if (s.startsWith('--brand-primary:') && !s.includes('var(')) {
      return s.replace('--brand-primary:', '').replace(';', '').trim()
    }
  }
  return ''
}

export function BrandingProvider({ children }) {
  const { idToken } = useAuth()

  const [branding, _setBranding] = useState({
    primary: parsePrimaryFromCss(getCachedThemeCss()),
    logoUrl: '',
  })

  // Monotonic counter incremented on every explicit Publish call.
  // Prevents a slow background fetch from overwriting a fresher Publish result.
  const publishSeqRef = useRef(0)

  // Public setter — called by BrandingPanel on successful Publish.
  const setBranding = useCallback((next) => {
    publishSeqRef.current += 1
    _setBranding(prev => ({ ...prev, ...next }))
  }, [])

  // Hydrate from the API whenever we have a valid token.
  // Runs on mount (if already authenticated) AND after fresh login
  // (when idToken transitions from '' to a real value).
  useEffect(() => {
    if (!idToken) return   // not authenticated yet

    let cancelled = false
    const seqAtStart = publishSeqRef.current

    async function hydrate() {
      try {
        const res = await fetch(`${API}/tenant`, {
          headers: { Authorization: `Bearer ${idToken}` },
        })
        if (!res.ok || cancelled) return

        const tenant = await res.json()
        if (cancelled) return

        // Discard if Publish fired while we were fetching.
        if (publishSeqRef.current !== seqAtStart) return

        const freshLogo    = tenant?.brand_logo_url ?? ''
        const freshPrimary = tenant?.brand_color    ?? ''

        _setBranding(prev => ({
          primary: freshPrimary || prev.primary,
          logoUrl: freshLogo,
        }))
      } catch { /* non-fatal — Topbar falls back to initial-letter avatar */ }
    }

    hydrate()
    return () => { cancelled = true }
  }, [idToken])  // re-runs when idToken changes (login / logout)

  return (
    <BrandingCtx.Provider value={{ ...branding, setBranding }}>
      {children}
    </BrandingCtx.Provider>
  )
}

export const useBranding = () => useContext(BrandingCtx)
