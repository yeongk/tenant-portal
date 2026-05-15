import React, { createContext, useContext, useState, useCallback } from 'react'
import { clearThemeCache } from '../utils/brandingTheme'

const Ctx = createContext(null)

/**
 * Session shape stored in sessionStorage under 'tp_sess':
 * {
 *   id_token:  string   — Cognito ID token (JWT)
 *   tenant_id: string   — tenant slug, e.g. 'porsche-sf'
 *   shop_name: string   — human-readable shop name
 *   user_type: string   — 'STAFF' | 'CLIENT'
 *   cog_group: string   — 'SHOP_ADMIN' | 'SUPERVISOR' | 'MECHANIC' | ''
 * }
 *
 * Theme cache stored separately under 'tp_theme_css' (see brandingTheme.js).
 * Cleared on logout so a different user on the same machine doesn't see the
 * previous tenant's branding.
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
    clearThemeCache()   // clear tenant theme so next login starts fresh
    setSession(null)
  }, [])

  return (
    <Ctx.Provider value={{
      isAuthenticated: !!session?.id_token,
      tenantId:  session?.tenant_id  ?? '',
      shopName:  session?.shop_name  ?? '',
      idToken:   session?.id_token   ?? '',
      userType:  session?.user_type  ?? '',
      cogGroup:  session?.cog_group  ?? '',
      isAdmin:   session?.user_type === 'STAFF' && session?.cog_group === 'SHOP_ADMIN',
      login,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
