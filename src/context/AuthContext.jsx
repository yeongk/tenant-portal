import React, { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

/**
 * Session shape stored in sessionStorage under 'tp_sess':
 * {
 *   id_token:  string   — Cognito ID token (JWT)
 *   tenant_id: string   — tenant slug, e.g. 'porsche-sf'
 *   shop_name: string   — human-readable shop name
 *   user_type: string   — 'STAFF' | 'CLIENT'  (custom:userType claim)
 *   cog_group: string   — highest Cognito group for STAFF users:
 *                         'SHOP_ADMIN' | 'SUPERVISOR' | 'MECHANIC'
 *                         Empty string for CLIENT users or when group
 *                         cannot be determined.
 * }
 *
 * Access control rules:
 *   Portal entry   : user_type === 'STAFF'
 *   Branding edit  : user_type === 'STAFF' && cog_group === 'SHOP_ADMIN'
 *   All other pages: any authenticated STAFF member
 */

export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => {
    try {
      const r = sessionStorage.getItem('tp_sess')
      return r ? JSON.parse(r) : null
    } catch { return null }
  })

  const login = useCallback((d) => {
    sessionStorage.setItem('tp_sess', JSON.stringify(d))
    setSession(d)
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem('tp_sess')
    setSession(null)
  }, [])

  return (
    <Ctx.Provider value={{
      isAuthenticated: !!session?.id_token,
      tenantId:  session?.tenant_id  ?? '',
      shopName:  session?.shop_name  ?? '',
      idToken:   session?.id_token   ?? '',
      userType:  session?.user_type  ?? '',   // 'STAFF' | 'CLIENT'
      cogGroup:  session?.cog_group  ?? '',   // 'SHOP_ADMIN' | 'SUPERVISOR' | 'MECHANIC'
      isAdmin:   session?.user_type === 'STAFF' && session?.cog_group === 'SHOP_ADMIN',
      login,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
