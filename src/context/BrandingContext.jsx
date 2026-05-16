/**
 * BrandingContext
 *
 * Holds the PUBLISHED tenant branding as React state:
 *   primary   — brand hex colour, e.g. '#4338ca'
 *   logoUrl   — presigned S3 URL for the tenant logo, or '' if none
 *
 * Topbar reads from this context so it only re-renders when the context
 * value changes — which happens on:
 *   1. ThemeInitializer mount (seeds logo from live API on every page load)
 *   2. Successful Publish in BrandingPanel
 *
 * Unpublished picker changes in BrandingPanel never touch this context.
 *
 * Why CSS cache is NOT used for logoUrl
 * ──────────────────────────────────────
 * The cached CSS embeds whatever URL was current at publish time. S3
 * presigned URLs expire after 1 hour, so a cached URL is stale on the
 * next session. The colour (#brand-primary) is a plain hex — stable
 * forever — so it is safe to seed from the CSS cache. The logo URL must
 * always come from a live GET /api/tenant call which generates a fresh
 * presigned URL on demand.
 */

import React, { createContext, useContext, useState } from 'react'
import { getCachedThemeCss } from '../utils/brandingTheme'

const BrandingCtx = createContext({
  primary:     '',
  logoUrl:     '',
  setBranding: () => {},
})

/** Extract only --brand-primary from cached CSS (stable hex, safe to cache). */
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
  // Seed primary colour instantly from sessionStorage (zero network delay).
  // logoUrl starts empty — ThemeInitializer fills it from GET /api/tenant.
  const [branding, setBranding] = useState(() => ({
    primary: parsePrimaryFromCss(getCachedThemeCss()),
    logoUrl: '',
  }))

  return (
    <BrandingCtx.Provider value={{ ...branding, setBranding }}>
      {children}
    </BrandingCtx.Provider>
  )
}

export const useBranding = () => useContext(BrandingCtx)
