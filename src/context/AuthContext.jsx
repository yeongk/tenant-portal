import React, { createContext, useContext, useState, useCallback } from 'react'

const Ctx = createContext(null)

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
      // userType mirrors custom:userType from the Cognito ID token —
      // 'STAFF' for all staff; role distinction comes from cognito:groups
      // which is mapped by auth.py to the session's user_type field.
      userType:  session?.user_type  ?? '',
      login,
      logout,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
