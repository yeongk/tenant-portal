import React, { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ToastProvider } from './context/ToastContext'
import ProtectedLayout from './layouts/ProtectedLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Staff from './pages/Staff'
import Customers from './pages/Customers'
import WorkOrders from './pages/WorkOrders'
import WorkOrderDetail from './pages/WorkOrderDetail'
import Settings from './pages/Settings'

// ── Hash-token bootstrap ────────────────────────────────────────────────────
//
// When dms-porsche redirects here after a successful /saas/login it appends:
//   /#token=<id_token>&tenant_id=<id>&shop_name=<name>
//
// This component reads the fragment on first render, hydrates AuthContext,
// strips the hash from the URL (so refresh doesn't re-consume it), and
// navigates to /dashboard.  If no token fragment is present it does nothing.
//
// Placed inside <BrowserRouter> so useNavigate() is available, but outside
// <AuthProvider> children so it can call login() before any route renders.

function decodeJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
  } catch {
    return {}
  }
}

function HashTokenBootstrap() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    // Only run once on mount; skip if already authenticated
    if (isAuthenticated) return

    const hash = window.location.hash.slice(1)  // strip leading '#'
    if (!hash) return

    const params    = new URLSearchParams(hash)
    const idToken   = params.get('token')
    const tenantId  = params.get('tenant_id') ?? ''
    const shopName  = params.get('shop_name') ?? ''

    if (!idToken) return

    // Decode to get userType (ProtectedLayout requires 'STAFF')
    const claims   = decodeJwt(idToken)
    const userType = claims['custom:userType'] ?? 'STAFF'

    // Hydrate AuthContext (writes to sessionStorage 'tp_sess')
    login({ id_token: idToken, tenant_id: tenantId, shop_name: shopName, user_type: userType })

    // Clear the fragment so the token doesn't linger in the URL bar
    // replace() avoids adding a history entry
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    // Navigate into the portal
    navigate('/dashboard', { replace: true })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])   // intentionally empty — run once on mount only

  return null
}

// ── App ────────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter>
          {/* Bootstrap session from hash token before any route renders */}
          <HashTokenBootstrap />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard"         element={<Dashboard />} />
              <Route path="/staff"             element={<Staff />} />
              <Route path="/customers"         element={<Customers />} />
              <Route path="/workorders"        element={<WorkOrders />} />
              <Route path="/workorders/:id"    element={<WorkOrderDetail />} />
              <Route path="/settings"          element={<Settings />} />
            </Route>
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  )
}
