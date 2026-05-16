/**
 * BrandingContext
 *
 * Single source of truth for the PUBLISHED tenant branding:
 *   primary  — brand hex colour, e.g. '#4338ca'
 *   logoUrl  — fresh presigned S3 URL for the logo, or '' if none
 *
 * Topbar reads from this context and re-renders only when setBranding()
 * is called — which happens in two places:
 *   1. Here, on mount: GET /api/tenant → fresh presigned logo URL
 *   2. BrandingPanel.handlePublish — immediately after a successful publish
 *
 * Unpublished picker changes never touch this context.
 *
 * Race-condition safety
 * ─────────────────────
 * setBranding() stamps a monotonic counter (publishSeq) on every call.
 * The background fetch checks whether a newer setBranding() has been
 * called since the fetch started. If so, it discards its result — the
 * published value always wins over the background fetch.
 *
 * Why logoUrl cannot come from the CSS cache
 * ──────────────────────────────────────────
 * S3 presigned URLs expire after 1 hour. The CSS cache embeds whatever
 * URL existed at publish time — always stale on the next session.
 * Primary colour is a stable hex and IS safe to seed from the cache.
 */

import React, {
  createContext, useContext, useEffect, useRef, useState,
} from 'react'
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
  const [branding, _setBranding] = useState({
    primary: parsePrimaryFromCss(getCachedThemeCss()),
    logoUrl: '',
  })

  // Monotonic counter: incremented on every explicit publish call.
  // The background fetch checks this before writing to avoid overwriting
  // a fresher value that arrived while the fetch was in flight.
  const publishSeqRef = useRef(0)

  // Public setter — called by BrandingPanel on Publish.
  // Bumps publishSeq so any in-flight background fetch knows to discard.
  const setBranding = React.useCallback((next) => {
    publishSeqRef.current += 1
    _setBranding(prev => ({ ...prev, ...next }))
  }, [])

  // Background fetch — runs once on mount to hydrate logoUrl with a
  // fresh presigned URL from GET /api/tenant.
  useEffect(() => {
    let cancelled = false
    const seqAtStart = publishSeqRef.current  // snapshot before async work

    async function hydrate() {
      try {
        const raw = sessionStorage.getItem('tp_sess')
        if (!raw) return
        const { id_token } = JSON.parse(raw)
        if (!id_token) return

        const res = await fetch(`${API}/tenant`, {
          headers: { Authorization: `Bearer ${id_token}` },
        })
        if (!res.ok || cancelled) return

        const tenant = await res.json()
        if (cancelled) return

        // Discard if a Publish happened while we were fetching — the
        // published value is newer and more authoritative.
        if (publishSeqRef.current !== seqAtStart) return

        const freshLogo    = tenant?.brand_logo_url ?? ''
        const freshPrimary = tenant?.brand_color    ?? ''

        _setBranding(prev => ({
          primary: freshPrimary || prev.primary,
          logoUrl: freshLogo,
        }))
      } catch { /* non-fatal */ }
    }

    hydrate()
    return () => { cancelled = true }
  }, []) // intentionally empty — run exactly once on mount

  return (
    <BrandingCtx.Provider value={{ ...branding, setBranding }}>
      {children}
    </BrandingCtx.Provider>
  )
}

export const useBranding = () => useContext(BrandingCtx)
