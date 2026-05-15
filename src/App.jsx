import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedLayout from './layouts/ProtectedLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Staff from './pages/Staff'
import Customers from './pages/Customers'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Settings from './pages/Settings'
import { injectTheme, getCachedThemeCss, loadTenantTheme } from './utils/brandingTheme'

// ── JWT decode helper ─────────────────────────────────────────────────────────

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

// ── Hash-token bootstrap ──────────────────────────────────────────────────────
// Runs synchronously before React mounts so AuthContext reads the correct
// session from sessionStorage on its very first render.

;(function bootstrapFromHash() {
  const hash = window.location.hash.slice(1)
  if (!hash) return
  const params  = new URLSearchParams(hash)
  const idToken = params.get('token')
  if (!idToken) return
  const claims   = decodeJwt(idToken)
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

// ── Tenant theme — synchronous inject + background refresh ────────────────────
//
// TWO-TIER strategy (no CloudFront involvement, no invalidation delay):
//
// Tier 1 — Synchronous, before React mounts (zero delay):
//   Read the theme CSS from sessionStorage ('tp_theme_css') and inject it
//   immediately. This covers every navigation after the first load in the
//   session and every load after a publish (publish writes to the cache).
//
// Tier 2 — Background fetch, first load only (cache miss):
//   When the cache is empty (fresh login), fire an async fetch of
//   GET /api/tenant → GET /api/tenant/branding/css, then inject and cache.
//   A brief FOUC on the very first page load is acceptable and unavoidable
//   without SSR. All subsequent loads in the session are instant (Tier 1).
//
// On publish: Settings.jsx calls cacheThemeCss(finalCss) immediately after
//   the upload succeeds, so the next load (or React route change) reflects
//   the new theme without any fetch.

;(function applyTenantTheme() {
  try {
    // Tier 1 — synchronous cache hit
    const cached = getCachedThemeCss()
    if (cached) {
      injectTheme(cached)
      return   // nothing more to do — theme is already live
    }

    // Tier 2 — cache miss: background fetch
    const raw = sessionStorage.getItem('tp_sess')
    if (!raw) return
    const sess = JSON.parse(raw)
    if (!sess?.id_token) return

    const API = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`
    fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${sess.id_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(tenant => {
        if (tenant?.brand_css_file) {
          // loadTenantTheme fetches the CSS, injects it, and caches it
          loadTenantTheme(tenant.brand_css_file, sess.id_token)
        }
      })
      .catch(() => { /* non-fatal */ })
  } catch { /* non-fatal */ }
})()

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/"                element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"       element={<Dashboard />} />
              <Route path="/staff"           element={<Staff />} />
              <Route path="/customers"       element={<Customers />} />
              <Route path="/workorders"      element={<WorkOrders />} />
              <Route path="/workorders/:id"  element={<WorkOrderDetail />} />
              <Route path="/settings"        element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
