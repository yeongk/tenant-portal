import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
function decodeJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))) }
  catch { return {} }
}
export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [totp,     setTotp]     = useState('')
  const [mfa,      setMfa]      = useState(null)
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const finish = (data) => {
    const c = decodeJwt(data.id_token)
    const ut = c['custom:userType'] ?? ''
    if (ut !== 'STAFF') { setError('Access restricted to shop staff accounts'); return }
    login({ id_token: data.id_token, tenant_id: data.tenant_id, shop_name: data.shop_name, user_type: ut })
    nav('/dashboard')
  }

  const handleSignIn = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res  = await fetch(`${API}/shop/login`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Sign in failed'); return }
      if (data.status === 'mfa_required') { setMfa({ session: data.session, email: data.email }); return }
      finish(data)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const handleMfa = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res  = await fetch(`${API}/shop/login/mfa`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email: mfa.email, session: mfa.session, totp_code: totp }) })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'MFA failed'); if (res.status===401 && data.detail?.includes('Session')) setMfa(null); return }
      finish(data)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  const box = { minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'var(--bg)' }
  const card = { background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, padding:'32px 28px', width:'100%', maxWidth:360, boxShadow:'var(--shadow)' }
  const err = { background:'#fef2f2', border:'1px solid #fecaca', borderRadius:4, padding:'8px 12px', fontSize:13, color:'var(--danger)', marginBottom:14 }
  return (
    <div style={box}>
      <div style={card}>
        <h1 style={{ fontSize:21, fontWeight:700, marginBottom:5 }}>{mfa ? 'Two-factor auth' : 'Staff Sign In'}</h1>
        <p style={{ fontSize:13, color:'var(--muted)', marginBottom:22 }}>{mfa ? 'Enter the 6-digit code from your authenticator app' : 'Tenant portal access'}</p>
        {error && <div style={err}>{error}</div>}
        {!mfa ? (
          <form onSubmit={handleSignIn}>
            <div className="fg"><label>Email</label><input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></div>
            <div className="fg"><label>Password</label><input type="password" value={password} onChange={e=>setPassword(e.target.value)} required /></div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:6 }} disabled={loading}>{loading ? 'Signing in…' : 'Sign In'}</button>
          </form>
        ) : (
          <form onSubmit={handleMfa}>
            <div className="fg"><label>Code</label><input type="text" inputMode="numeric" maxLength={6} autoFocus value={totp} onChange={e=>setTotp(e.target.value.replace(/\D/g,''))} required /></div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:6 }} disabled={loading}>{loading ? 'Verifying…' : 'Verify'}</button>
            <button type="button" style={{ marginTop:10, background:'none', border:'none', color:'var(--muted)', fontSize:13, cursor:'pointer', display:'block' }} onClick={()=>{setMfa(null);setTotp('');setError('')}}>← Back</button>
          </form>
        )}
      </div>
    </div>
  )
}
