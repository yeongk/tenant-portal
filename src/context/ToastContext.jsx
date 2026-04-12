import React, { createContext, useContext, useState, useCallback } from 'react'
const Ctx = createContext(null)
let _id = 0
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const toast = useCallback((msg, type = 'success') => {
    const id = ++_id
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return (
    <Ctx.Provider value={toast}>
      {children}
      <div className="toast-wrap">
        {toasts.map(t => <div key={t.id} className={`toast toast-${t.type}`}>{t.msg}</div>)}
      </div>
    </Ctx.Provider>
  )
}
export const useToast = () => useContext(Ctx)
