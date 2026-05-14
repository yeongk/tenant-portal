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

// ── JWT decode helper ─────────────────────────────────────────────────────────

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

/**
 * Resolve the highest-privilege Cognito group for a STAFF user.
 *
 * Priority: SHOP_ADMIN > SUPERVISOR > MECHANIC
 * Returns '' for CLIENT users or tokens with no recognised group.
 *
 * The cognito:groups claim is an array of all groups the user belongs to.
 * We pick the most-privileged one so a user who is in both SHOP_ADMIN and
 * MECHANIC (unusual but possible) is treated as SHOP_ADMIN.
 */
function resolveGroup(claims) {
  const groups = claims['cognito:groups'] ?? []
  if (groups.includes('SHOP_ADMIN'))  return 'SHOP_ADMIN'
  if (groups.includes('SUPERVISOR'))  return 'SUPERVISOR'
  if (groups.includes('MECHANIC'))    return 'MECHANIC'
  return ''
}

// ── Hash-token bootstrap ──────────────────────────────────────────────────────
//
// When dms-porsche redirects here after a successful login it appends a hash:
//   /#token=<id_token>&tenant_id=<id>&shop_name=<name>
//
// The session must be written to sessionStorage BEFORE the router renders so
// that ProtectedLayout reads isAuthenticated:true on its very first render.
// Writing through React state (login()) is async — the state update batches
// and the layout renders with the old null session first, causing a redirect
// to /login before the update lands.
//
// Solution: parse the hash and write sessionStorage synchronously here,
// at module evaluation time (outside any component), before React mounts.
// AuthContext reads sessionStorage in its useState initializer, so it will
// have the session from the very first render.

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
  } catch {
    return
  }

  // Strip the hash so the token doesn't linger in the URL bar and so that
  // a page refresh doesn't try to re-consume an already-expired token
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
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
