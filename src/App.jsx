import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { BrandingProvider } from './context/BrandingContext'
import ProtectedLayout from './layouts/ProtectedLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Staff from './pages/Staff'
import Customers from './pages/Customers'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Settings from './pages/Settings'
import ClientPortalSettings from './pages/ClientPortalSettings'
import { injectTheme, getCachedThemeCss, loadTenantTheme } from './utils/brandingTheme'

// ── JWT decode helper ────────────────────────────────────────────────────────────

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return {} }
}

function resolveGroup(claims) {
  const groups = claims['cognito:groups'] ?? []
  if (groups.includes('SHOP_ADMIN'))  return 'SHOP_ADMIN'
  if (groups.includes('SUPERVISOR'))  return 'SUPERVISOR'
  if (groups.includes('MECHANIC'))    return 'MECHANIC'
  return ''
}

// ── Hash-token bootstrap ───────────────────────────────────────────────────────
// Handles the case where the user arrives via a redirect URL containing
// the session token in the hash (e.g. from the SaaS registration flow).
// Runs synchronously before React mounts.

;(function bootstrapFromHash() {
  const hash = window.location.hash.slice(1)
  if (!hash) return
  const params  = new URLSearchParams(hash)
  const idToken = params.get('token')
  if (!idToken) return
  const claims = decodeJwt(idToken)
  try {
    sessionStorage.setItem('tp_sess', JSON.stringify({
      id_token:  idToken,
      tenant_id: params.get('tenant_id') ?? '',
      shop_name: params.get('shop_name') ?? '',
      user_type: claims['custom:userType'] ?? '',
      cog_group: resolveGroup(claims),
    }))
  } catch { return }
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})()

// ── Tenant theme CSS — synchronous inject (CSS vars only) ───────────────────
//
// Injects the <style id="tenant-theme"> tag from the sessionStorage cache
// so Sidebar accent colour and var(--brand-*) consumers render without delay.
//
// On cache miss (fresh login via the Login page form — not hash redirect):
// does nothing here. BrandingContext's useEffect fires after login() sets
// idToken, fetches GET /api/tenant, and from there loadTenantTheme() fetches
// and caches the CSS. Subsequent page loads hit Tier 1 (cache hit) instantly.
//
// On cache hit (returning session / post-publish):
// injects immediately before React mounts — zero flash.

;(function applyTenantThemeCss() {
  try {
    const cached = getCachedThemeCss()
    if (cached) { injectTheme(cached); return }

    // Cache miss — only possible for hash-redirect logins (bootstrapFromHash
    // ran just above). Fire a background fetch to populate the CSS cache so
    // the next page load is instant. BrandingContext handles the React-state
    // side (primary colour, logoUrl) via its own idToken-triggered useEffect.
    const raw = sessionStorage.getItem('tp_sess')
    if (!raw) return
    const { id_token } = JSON.parse(raw)
    if (!id_token) return
    const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`
    fetch(`${BASE}/tenant`, { headers: { Authorization: `Bearer ${id_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(t => { if (t?.brand_css_file) loadTenantTheme(t.brand_css_file, id_token) })
      .catch(() => {})
  } catch {}
})()

// ── App ───────────────────────────────────────────────────────────────────
//
// Provider nesting order matters:
//   AuthProvider       — owns idToken / session
//     BrandingProvider — watches idToken to trigger branding hydration
//       ToastProvider
//         BrowserRouter
//
// BrandingProvider must be INSIDE AuthProvider so it can call useAuth().

export default function App() {
  return (
    <AuthProvider>
      <BrandingProvider>
        <ToastProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route element={<ProtectedLayout />}>
                <Route path="/"                         element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard"                element={<Dashboard />} />
                <Route path="/staff"                    element={<Staff />} />
                <Route path="/customers"                element={<Customers />} />
                <Route path="/workorders"               element={<WorkOrders />} />
                <Route path="/workorders/:id"           element={<WorkOrderDetail />} />
                <Route path="/settings"                 element={<Settings />} />
                <Route path="/client-portal-settings"   element={<ClientPortalSettings />} />
              </Route>
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </BrowserRouter>
        </ToastProvider>
      </BrandingProvider>
    </AuthProvider>
  )
}
