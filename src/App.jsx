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
import { loadTenantTheme } from './utils/brandingTheme'

// ── JWT decode helper ─────────────────────────────────────────────────────────

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

function resolveGroup(claims) {
  const groups = claims['cognito:groups'] ?? []
  if (groups.includes('SHOP_ADMIN'))  return 'SHOP_ADMIN'
  if (groups.includes('SUPERVISOR'))  return 'SUPERVISOR'
  if (groups.includes('MECHANIC'))    return 'MECHANIC'
  return ''
}

// ── Hash-token bootstrap ──────────────────────────────────────────────────────
// Runs synchronously before React mounts so AuthContext reads the session
// on its very first render (from sessionStorage initializer).

;(function bootstrapFromHash() {
  const hash = window.location.hash.slice(1)
  if (!hash) return
  const params  = new URLSearchParams(hash)
  const idToken = params.get('token')
  if (!idToken) return
  const tenantId = params.get('tenant_id') ?? ''
  const shopName = params.get('shop_name') ?? ''
  const claims   = decodeJwt(idToken)
  const userType = claims['custom:userType'] ?? ''
  const cogGroup = resolveGroup(claims)
  try {
    sessionStorage.setItem('tp_sess', JSON.stringify({
      id_token:  idToken,
      tenant_id: tenantId,
      shop_name: shopName,
      user_type: userType,
      cog_group: cogGroup,
    }))
  } catch { return }
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
})()

// ── Tenant theme boot-loader ──────────────────────────────────────────────────
// Fetches the tenant's published brand_css_file from /api/tenant and injects
// it so the correct theme is applied on every page load — not just immediately
// after publishing.
//
// Must run after bootstrapFromHash (session is in sessionStorage by now).
// Fire-and-forget — a brief flash of the default theme on first load is
// acceptable; the fetch completes in ~200 ms on a warm Lambda.

;(function applyTenantThemeOnBoot() {
  try {
    const raw = sessionStorage.getItem('tp_sess')
    if (!raw) return
    const sess = JSON.parse(raw)
    if (!sess?.id_token) return
    const API = `${import.meta.env.VITE_API_URL ?? 'http://localhost:3000'}/api`
    fetch(`${API}/tenant`, { headers: { Authorization: `Bearer ${sess.id_token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(tenant => {
        if (tenant?.brand_css_file) {
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
