import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import { BrandingProvider } from './context/BrandingContext'
import ThemeInitializer from './components/ThemeInitializer'
import ProtectedLayout from './layouts/ProtectedLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Staff from './pages/Staff'
import Customers from './pages/Customers'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Settings from './pages/Settings'
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

// ── Tenant theme CSS — synchronous inject + background refresh ─────────────────
//
// Responsible ONLY for the CSS <style> tag (— CSS vars consumed by Sidebar,
// buttons, etc.). The Topbar logo and colour come from BrandingContext which
// is hydrated by ThemeInitializer via GET /api/tenant on every mount.
//
// TWO-TIER strategy:
//
// Tier 1 — Synchronous cache hit (zero delay):
//   Inject cached CSS from sessionStorage. Covers every SPA navigation and
//   every page load after a publish.
//
// Tier 2 — Background fetch, cache miss only:
//   Fresh login with empty cache: fetch CSS file from API, inject, cache.
//   ThemeInitializer handles the logo URL in both tiers via GET /api/tenant.

;(function applyTenantThemeCss() {
  try {
    const cached = getCachedThemeCss()
    if (cached) {
      injectTheme(cached)
      return
    }
    const raw = sessionStorage.getItem('tp_sess')
    if (!raw) return
    const sess = JSON.parse(raw)
    if (!sess?.id_token) return
    const API = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`
    fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${sess.id_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(tenant => { if (tenant?.brand_css_file) loadTenantTheme(tenant.brand_css_file, sess.id_token) })
      .catch(() => {})
  } catch {}
})()

// ── App ───────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrandingProvider>
          {/*
            ThemeInitializer sits inside BrandingProvider so it can call
            setBranding(). It fires GET /api/tenant once on mount and pushes
            the fresh presigned logo URL (and brand colour) into context.
            Renders nothing — purely a side-effect component.
          */}
          <ThemeInitializer />
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
        </BrandingProvider>
      </ToastProvider>
    </AuthProvider>
  )
}
