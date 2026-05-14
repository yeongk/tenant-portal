import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Topbar from '../components/Topbar'
import Sidebar from '../components/Sidebar'

export default function ProtectedLayout() {
  const { isAuthenticated, userType } = useAuth()

  // Only STAFF users may enter the portal.
  // CLIENT users (tenant customers) have their own separate app.
  if (!isAuthenticated || userType !== 'STAFF') {
    return <Navigate to="/login" replace />
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar />
        <main style={{ flex: 1, overflowY: 'auto', padding: '22px 26px' }}>
          <Outlet />
        </main>
      </div>
    </div>
  )
}
