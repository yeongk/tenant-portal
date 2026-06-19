import React, { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'

export default function ClientPortalSettings() {
  const { tenantId } = useAuth()
  const { get, patch } = useApi()
  const toast = useToast()

  const [enabled, setEnabled]   = useState(true)
  const [welcome, setWelcome]   = useState('')
  const [footer,  setFooter]    = useState('')
  const [loading, setLoading]   = useState(true)
  const [saving,  setSaving]    = useState(false)

  const portalUrl = `https://portal.${tenantId}.dmsystemsinc.net`

  // Pull current config from the public branding endpoint.
  // This is the same endpoint the client-portal SPA uses pre-login, so it
  // always reflects exactly what customers see.
  useEffect(() => {
    get(`/client/branding?tenant=${encodeURIComponent(tenantId)}`)
      .then(d => {
        setEnabled(d.client_portal_enabled ?? true)
        setWelcome(d.welcome_message  ?? '')
        setFooter(d.footer_text       ?? '')
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tenantId]) // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setSaving(true)
    try {
      await patch('/client/portal-config', {
        enabled,
        welcome_message: welcome,
        footer_text:     footer,
      })
      toast('Client portal settings saved')
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="spinner" style={{ marginTop: 60 }} />

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Client Portal Settings</h1>
      <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 24 }}>
        Configure the customer-facing portal for your shop.
      </p>

      {/* ── Portal URL ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Portal URL</div>
        <a
          href={portalUrl}
          target="_blank"
          rel="noreferrer"
          style={{ fontSize: 14, color: 'var(--accent)', textDecoration: 'none', wordBreak: 'break-all' }}
        >
          {portalUrl}
        </a>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
          Share this link with your customers so they can track their vehicles.
        </div>
      </div>

      {/* ── Enable / disable toggle ───────────────────────────────────── */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
          {/* Custom toggle */}
          <div
            role="switch"
            aria-checked={enabled}
            style={{ position: 'relative', width: 44, height: 24, flexShrink: 0, cursor: 'pointer' }}
            onClick={() => setEnabled(v => !v)}
          >
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 12,
              background: enabled ? 'var(--accent)' : 'var(--border)',
              transition: 'background .2s',
            }} />
            <div style={{
              position: 'absolute', top: 3,
              left: enabled ? 23 : 3,
              width: 18, height: 18, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
              transition: 'left .2s',
            }} />
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Enable client portal</div>
            <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>
              {enabled
                ? 'Customers can log in and view their work orders.'
                : 'Portal is disabled — customers will see a closed notice.'}
            </div>
          </div>
        </label>
      </div>

      {/* ── Welcome message ───────────────────────────────────────────── */}
      <div className="card" style={{ padding: 18, marginBottom: 20 }}>
        <div className="fg">
          <label style={{ fontWeight: 600, marginBottom: 4 }}>Welcome Message</label>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Displayed on the client portal login page beneath your shop name.
          </div>
          <textarea
            rows={3}
            placeholder="e.g. Track the progress of your vehicle restoration in real time."
            value={welcome}
            onChange={e => setWelcome(e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <div style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'right', marginTop: 4 }}>
            {welcome.length} / 300
          </div>
        </div>
      </div>

      {/* ── Footer text ───────────────────────────────────────────────── */}
      <div className="card" style={{ padding: 18, marginBottom: 28 }}>
        <div className="fg">
          <label style={{ fontWeight: 600, marginBottom: 4 }}>Footer Text</label>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8 }}>
            Shown at the bottom of every page in the client portal.
          </div>
          <textarea
            rows={2}
            placeholder={`e.g. \u00a9 ${new Date().getFullYear()} Your Shop Name. All rights reserved.`}
            value={footer}
            onChange={e => setFooter(e.target.value)}
            style={{ resize: 'vertical' }}
          />
        </div>
      </div>

      <button
        className="btn btn-primary"
        onClick={save}
        disabled={saving}
        style={{ minWidth: 130 }}
      >
        {saving ? 'Saving\u2026' : 'Save Changes'}
      </button>
    </div>
  )
}
