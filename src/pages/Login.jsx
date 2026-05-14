import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000'
const API  = `${BASE}/api`

// ── helpers ───────────────────────────────────────────────────────────────────

function decodeJwt(t) {
  try { return JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))) }
  catch { return {} }
}

function resolveGroup(claims) {
  const groups = claims['cognito:groups'] ?? []
  if (groups.includes('SHOP_ADMIN')) return 'SHOP_ADMIN'
  if (groups.includes('SUPERVISOR')) return 'SUPERVISOR'
  if (groups.includes('MECHANIC'))   return 'MECHANIC'
  return ''
}

function passwordStrength(pw) {
  if (!pw) return null
  const checks = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[a-z]/.test(pw),
    /[0-9]/.test(pw),
    /[^A-Za-z0-9]/.test(pw),
  ]
  const passed = checks.filter(Boolean).length
  if (passed <= 2) return { label: 'Weak',   color: '#dc2626' }
  if (passed <= 3) return { label: 'Fair',   color: '#d97706' }
  if (passed === 4) return { label: 'Good',  color: '#2563eb' }
  return             { label: 'Strong', color: '#16a34a' }
}

// ── component ─────────────────────────────────────────────────────────────────

export default function Login() {
  const { login } = useAuth()
  const nav = useNavigate()

  // auth state
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [totp,     setTotp]     = useState('')
  const [mfa,      setMfa]      = useState(null)   // {session, email}
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  // after a successful auth, holds {id_token, tenant_id, shop_name, user_type, cog_group}
  // while waiting for the user to complete the change-password step
  const [pendingSession, setPendingSession] = useState(null)

  // change-password step
  const [newPw,    setNewPw]    = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError,   setPwError]   = useState('')
  const [showNew,    setShowNew]   = useState(false)
  const [showConf,   setShowConf]  = useState(false)

  // ── After Cognito auth completes — check password_changed flag ──────────

  const afterAuth = (data) => {
    const claims   = decodeJwt(data.id_token)
    const userType = claims['custom:userType'] ?? ''
    const cogGroup = resolveGroup(claims)

    if (userType !== 'STAFF') { setError('Access restricted to shop staff accounts'); return }

    const session = {
      id_token:  data.id_token,
      tenant_id: data.tenant_id,
      shop_name: data.shop_name,
      user_type: userType,
      cog_group: cogGroup,
    }

    if (data.password_changed === false) {
      // First login — hold session, show change-password step
      setPendingSession({ ...session, email: email || mfa?.email || '' })
      return
    }

    // Normal login — go straight to dashboard
    login(session)
    nav('/dashboard')
  }

  // ── Sign-in ──────────────────────────────────────────────────────────────

  const handleSignIn = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res  = await fetch(`${API}/shop/login`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.detail ?? 'Sign in failed'); return }
      if (data.status === 'mfa_required') { setMfa({ session: data.session, email: data.email }); return }
      afterAuth(data)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  // ── MFA completion ───────────────────────────────────────────────────────

  const handleMfa = async (e) => {
    e.preventDefault(); setError(''); setLoading(true)
    try {
      const res  = await fetch(`${API}/shop/login/mfa`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: mfa.email, session: mfa.session, totp_code: totp }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'MFA failed')
        if (res.status === 401 && data.detail?.includes('Session')) setMfa(null)
        return
      }
      afterAuth(data)
    } catch { setError('Network error') } finally { setLoading(false) }
  }

  // ── Change password (first login) ────────────────────────────────────────

  const handleChangePassword = async (e) => {
    e.preventDefault(); setPwError('')
    if (newPw !== confirmPw) { setPwError('Passwords do not match'); return }
    if (newPw.length < 8)   { setPwError('Password must be at least 8 characters'); return }
    if (!/[A-Z]/.test(newPw)) { setPwError('Must contain at least one uppercase letter'); return }
    if (!/[a-z]/.test(newPw)) { setPwError('Must contain at least one lowercase letter'); return }
    if (!/[0-9]/.test(newPw)) { setPwError('Must contain at least one number'); return }
    if (!/[^A-Za-z0-9]/.test(newPw)) { setPwError('Must contain at least one symbol (!@#$…)'); return }

    setPwLoading(true)
    try {
      const res = await fetch(`${API}/staff/me/password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pendingSession.id_token}`,
        },
        body: JSON.stringify({
          email:        pendingSession.email,
          new_password: newPw,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setPwError(err.detail ?? 'Failed to set password')
        return
      }
      // Password changed — complete login
      const { email: _e, ...session } = pendingSession
      login(session)
      nav('/dashboard')
    } catch { setPwError('Network error') } finally { setPwLoading(false) }
  }

  // ── Styles ───────────────────────────────────────────────────────────────

  const box  = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '32px 28px', width: '100%', maxWidth: 380, boxShadow: 'var(--shadow)' }
  const errBox = (msg) => msg ? (
    <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, padding: '8px 12px', fontSize: 13, color: 'var(--danger)', marginBottom: 14 }}>{msg}</div>
  ) : null

  const pwIcon = (show, toggle) => (
    <button type="button" onClick={toggle}
      style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 12, padding: 0 }}>
      {show ? 'Hide' : 'Show'}
    </button>
  )

  // ── Render: change-password step ─────────────────────────────────────────

  if (pendingSession) {
    const strength = passwordStrength(newPw)
    return (
      <div style={box}>
        <div style={card}>
          <h1 style={{ fontSize: 21, fontWeight: 700, marginBottom: 5 }}>Set your password</h1>
          <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 18 }}>
            Your account was set up by an admin. Please choose your own password before continuing.
          </p>
          {errBox(pwError)}
          <form onSubmit={handleChangePassword}>
            <div className="fg">
              <label>New password</label>
              <div style={{ position: 'relative' }}>
                <input type={showNew ? 'text' : 'password'} value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  style={{ paddingRight: 52 }} autoFocus required />
                {pwIcon(showNew, () => setShowNew(s => !s))}
              </div>
              {strength && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      background: strength.color,
                      width: strength.label === 'Weak' ? '25%' : strength.label === 'Fair' ? '50%' : strength.label === 'Good' ? '75%' : '100%',
                      transition: 'width .3s',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: strength.color, fontWeight: 600, minWidth: 42 }}>{strength.label}</span>
                </div>
              )}
            </div>
            <div className="fg">
              <label>Confirm password</label>
              <div style={{ position: 'relative' }}>
                <input type={showConf ? 'text' : 'password'} value={confirmPw}
                  onChange={e => setConfirmPw(e.target.value)}
                  style={{ paddingRight: 52 }} required />
                {pwIcon(showConf, () => setShowConf(s => !s))}
              </div>
              {confirmPw && newPw !== confirmPw && (
                <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>Passwords do not match</span>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14, lineHeight: 1.5 }}>
              Min 8 characters · uppercase · lowercase · number · symbol (!@#$…)
            </p>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}
              disabled={pwLoading || !newPw || newPw !== confirmPw}>
              {pwLoading ? 'Saving…' : 'Set Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  // ── Render: MFA step ─────────────────────────────────────────────────────

  if (mfa) return (
    <div style={box}>
      <div style={card}>
        <h1 style={{ fontSize: 21, fontWeight: 700, marginBottom: 5 }}>Two-factor auth</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Enter the 6-digit code from your authenticator app</p>
        {errBox(error)}
        <form onSubmit={handleMfa}>
          <div className="fg"><label>Code</label>
            <input type="text" inputMode="numeric" maxLength={6} autoFocus
              value={totp} onChange={e => setTotp(e.target.value.replace(/\D/g, ''))} required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={loading}>
            {loading ? 'Verifying…' : 'Verify'}
          </button>
          <button type="button"
            style={{ marginTop: 10, background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', display: 'block' }}
            onClick={() => { setMfa(null); setTotp(''); setError('') }}>
            ← Back
          </button>
        </form>
      </div>
    </div>
  )

  // ── Render: sign-in ───────────────────────────────────────────────────────

  return (
    <div style={box}>
      <div style={card}>
        <h1 style={{ fontSize: 21, fontWeight: 700, marginBottom: 5 }}>Staff Sign In</h1>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>Tenant portal access</p>
        {errBox(error)}
        <form onSubmit={handleSignIn}>
          <div className="fg"><label>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="fg"><label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
