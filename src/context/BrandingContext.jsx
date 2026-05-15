/**
 * BrandingContext
 *
 * Holds the PUBLISHED tenant branding as React state:
 *   primary   — brand hex colour, e.g. '#4338ca'
 *   logoUrl   — S3 logo URL, or '' if none
 *
 * Topbar reads from this context so it only re-renders when the context
 * value changes — which happens exclusively on a successful Publish.
 *
 * Unpublished picker changes in BrandingPanel never touch this context,
 * so the live portal chrome is unaffected until Publish is clicked.
 *
 * Initialisation (in BrandingProvider):
 *   Parse the last published CSS from sessionStorage ('tp_theme_css') to
 *   seed the initial state. This is the same CSS that App.jsx injects into
 *   the <style id="tenant-theme"> tag, so the two are always in sync.
 *   Falls back to empty strings when no theme has ever been published.
 */

import React, { createContext, useContext, useState } from 'react'
import { getCachedThemeCss } from '../utils/brandingTheme'

const BrandingCtx = createContext({ primary: '', logoUrl: '', setBranding: () => {} })

/** Parse --brand-primary and --brand-logo-url from raw CSS text. */
function parseCss(cssText) {
  let primary = ''
  let logoUrl = ''
  if (!cssText) return { primary, logoUrl }
  for (const line of cssText.split('\n')) {
    const s = line.trim()
    if (!primary && s.startsWith('--brand-primary:') && !s.includes('var(')) {
      primary = s.replace('--brand-primary:', '').replace(';', '').trim()
    }
    if (!logoUrl && s.startsWith('--brand-logo-url:') && s.includes('url(')) {
      const m = s.match(/url\(['"]?([^'"\)\s]+)['"]?\)/)
      if (m) logoUrl = m[1]
    }
  }
  return { primary, logoUrl }
}

export function BrandingProvider({ children }) {
  const [branding, setBranding] = useState(() => parseCss(getCachedThemeCss()))

  return (
    <BrandingCtx.Provider value={{ ...branding, setBranding }}>
      {children}
    </BrandingCtx.Provider>
  )
}

export const useBranding = () => useContext(BrandingCtx)
