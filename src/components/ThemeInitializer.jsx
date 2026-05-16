/**
 * ThemeInitializer
 *
 * Mounts once inside BrandingProvider on every page load and fires
 * GET /api/tenant to fetch a fresh presigned logo URL, then pushes it
 * into BrandingContext so Topbar renders the logo immediately.
 *
 * Why this is necessary
 * ──────────────────────
 * S3 presigned URLs expire after 1 hour. BrandingContext cannot seed
 * logoUrl from the sessionStorage CSS cache because the URL baked into
 * the CSS at publish time may already be stale. The only way to get a
 * valid logo URL is a live API call that generates a fresh presigned URL.
 *
 * This component is intentionally lightweight:
 *   - One fetch on mount, no polling.
 *   - Only updates BrandingContext when the API returns a logo URL that
 *     differs from what is already in state (avoids spurious re-renders).
 *   - Skips the fetch if no session token is present (unauthenticated).
 *   - All errors are non-fatal — the Topbar falls back to the initial-
 *     letter avatar if the fetch fails.
 *
 * Renders nothing (returns null).
 */

import { useEffect } from 'react'
import { useBranding } from '../context/BrandingContext'

const API = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`

export default function ThemeInitializer() {
  const { primary, logoUrl, setBranding } = useBranding()

  useEffect(() => {
    let cancelled = false

    async function init() {
      try {
        const raw = sessionStorage.getItem('tp_sess')
        if (!raw) return
        const sess = JSON.parse(raw)
        if (!sess?.id_token) return

        const res = await fetch(`${API}/tenant`, {
          headers: { Authorization: `Bearer ${sess.id_token}` },
        })
        if (!res.ok || cancelled) return

        const tenant = await res.json()
        if (cancelled) return

        const freshLogoUrl = tenant?.brand_logo_url ?? ''
        const freshPrimary = tenant?.brand_color    ?? primary

        // Only call setBranding if something actually changed to avoid
        // triggering an unnecessary Topbar re-render.
        if (freshLogoUrl !== logoUrl || freshPrimary !== primary) {
          setBranding({
            primary: freshPrimary || primary,
            logoUrl: freshLogoUrl,
          })
        }
      } catch {
        // Non-fatal: Topbar shows initial-letter avatar as fallback.
      }
    }

    init()
    return () => { cancelled = true }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  // Empty deps: run once on mount. setBranding/primary/logoUrl are stable
  // references and do not need to be deps here — we deliberately want this
  // to fire exactly once per page load, not re-run if context updates.

  return null
}
