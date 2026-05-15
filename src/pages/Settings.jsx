import React, { useEffect, useRef, useState } from 'react'
import { useApi } from '../hooks/useApi'
import { useToast } from '../context/ToastContext'
import { useAuth } from '../context/AuthContext'
import {
  THEME_COLORS,
  deriveHover,
  generateThemeCss,
  injectTheme,
  removeTheme,
  cacheThemeCss,
  uploadTheme,
} from '../utils/brandingTheme'

function isValidHex(h) {
  return /^#[0-9a-fA-F]{6}$/.test(h)
}

// ── BrandingPanel ─────────────────────────────────────────────────────────────

function BrandingPanel({ tenant, idToken, onPublished }) {
  const toast = useToast()

  const initColor = THEME_COLORS.find(c => c.primary === tenant?.brand_color) ?? THEME_COLORS[0]

  const [selectedColorId, setSelectedColorId] = useState(initColor.id)
  const [customHex,       setCustomHex]        = useState(tenant?.brand_color ?? '#3d7a28')
  const [logoFile,        setLogoFile]          = useState(null)
  const [logoPreviewUrl,  setLogoPreviewUrl]    = useState(tenant?.brand_logo_url ?? '')
  const [publishing,      setPublishing]        = useState(false)
  const [dirty,           setDirty]             = useState(false)
  const fileRef      = useRef(null)
  const publishedRef = useRef(false)

  const resolveColors = () => {
    if (selectedColorId === 'custom') {
      const hex = isValidHex(customHex) ? customHex : '#3d7a28'
      return { primary: hex, primaryHover: deriveHover(hex) }
    }
    const preset = THEME_COLORS.find(c => c.id === selectedColorId)
    return { primary: preset.primary, primaryHover: preset.primaryHover }
  }

  // Live preview — re-inject on every colour or logo change
  useEffect(() => {
    const { primary, primaryHover } = resolveColors()
    injectTheme(generateThemeCss({
      primary, primaryHover,
      logoUrl:   logoPreviewUrl,
      tenantId:  tenant?.tenant_id ?? '',
      timestamp: Date.now(),
    }))
  }, [selectedColorId, customHex, logoPreviewUrl])

  // On unmount: keep the injected theme if the admin published; remove it
  // if they navigated away without publishing (App.jsx will re-inject from
  // the sessionStorage cache on the next load).
  useEffect(() => {
    return () => {
      if (!publishedRef.current) removeTheme()
    }
  }, [])

  const handleColorChange = (id) => { setSelectedColorId(id); setDirty(true) }
  const handleCustomHex   = (v)  => { setCustomHex(v);        setDirty(true) }

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast('Please select an image file', 'error'); return }
    if (file.size > 2 * 1024 * 1024)    { toast('Logo must be under 2 MB',       'error'); return }
    setLogoFile(file)
    setLogoPreviewUrl(URL.createObjectURL(file))
    setDirty(true)
  }

  const handlePublish = async () => {
    const { primary, primaryHover } = resolveColors()
    if (!isValidHex(primary)) { toast('Invalid hex colour', 'error'); return }

    const timestamp = Date.now()
    const filename  = `theme.tenant.${timestamp}.css`
    // Use blob: URL for preview in the upload call (backend ignores it);
    // we'll regenerate with the real S3 URL after the response.
    const cssText = generateThemeCss({
      primary, primaryHover,
      logoUrl:  logoPreviewUrl.startsWith('blob:') ? '' : logoPreviewUrl,
      tenantId: tenant?.tenant_id ?? '',
      timestamp,
    })

    setPublishing(true)
    try {
      const result = await uploadTheme(cssText, filename, logoFile, idToken)

      // Build the final CSS with the confirmed S3 logo URL
      const finalCss = generateThemeCss({
        primary, primaryHover,
        logoUrl:  result.logo_url ?? '',
        tenantId: tenant?.tenant_id ?? '',
        timestamp,
      })

      // 1. Inject into the live DOM immediately — portal reflects new theme now
      injectTheme(finalCss)

      // 2. Write to sessionStorage cache — every subsequent page load or
      //    navigation in this session will inject from cache synchronously
      //    (zero network delay, no CloudFront involvement)
      cacheThemeCss(finalCss)

      // 3. Mark as published so unmount cleanup preserves the injected theme
      publishedRef.current = true

      toast(`Theme published: ${filename}`)
      setDirty(false)
      setLogoFile(null)
      if (result.logo_url) setLogoPreviewUrl(result.logo_url)
      onPublished({
        brand_color:    primary,
        brand_css_file: result.css_file,
        brand_logo_url: result.logo_url,
      })
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setPublishing(false)
    }
  }

  const { primary } = resolveColors()

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

      {/* ── Editor column ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Theme Colour</h3>
          <div className="fg">
            <label>Select colour</label>
            <select value={selectedColorId} onChange={e => handleColorChange(e.target.value)}>
              {THEME_COLORS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>

          {selectedColorId === 'custom' && (
            <div className="fg">
              <label>Custom hex colour</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="color"
                  value={isValidHex(customHex) ? customHex : '#3d7a28'}
                  onChange={e => handleCustomHex(e.target.value)}
                  style={{ width: 44, height: 36, padding: 2, border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}
                />
                <input
                  type="text"
                  value={customHex}
                  onChange={e => handleCustomHex(e.target.value)}
                  placeholder="#3d7a28"
                  maxLength={7}
                  style={{ flex: 1 }}
                />
              </div>
              {customHex && !isValidHex(customHex) && (
                <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>
                  Enter a valid 6-digit hex colour, e.g. #3d7a28
                </span>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {THEME_COLORS.filter(c => c.id !== 'custom').map(c => (
              <button
                key={c.id}
                title={c.label}
                onClick={() => handleColorChange(c.id)}
                style={{
                  width: 28, height: 28, borderRadius: '50%', background: c.primary,
                  border: selectedColorId === c.id ? '3px solid var(--text)' : '2px solid transparent',
                  cursor: 'pointer', outline: 'none', transition: 'border .15s',
                }}
              />
            ))}
          </div>
        </div>

        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Shop Logo</h3>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogoChange} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 10 }}>
            {logoPreviewUrl ? (
              <img src={logoPreviewUrl} alt="Logo preview"
                style={{ height: 48, maxWidth: 120, objectFit: 'contain', border: '1px solid var(--border)', borderRadius: 4, padding: 4 }} />
            ) : (
              <div style={{ width: 120, height: 48, border: '1px dashed var(--border)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: 'var(--muted)' }}>
                No logo
              </div>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              {logoPreviewUrl ? 'Change logo' : 'Upload logo'}
            </button>
            {logoPreviewUrl && (
              <button className="btn btn-secondary btn-sm"
                onClick={() => { setLogoFile(null); setLogoPreviewUrl(''); setDirty(true) }}>
                Remove
              </button>
            )}
          </div>
          <p style={{ fontSize: 11, color: 'var(--muted)' }}>
            PNG or SVG recommended · max 2 MB · displayed in the portal topbar
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={handlePublish}
          disabled={publishing || !dirty}
          style={{ alignSelf: 'flex-start' }}
        >
          {publishing ? 'Publishing…' : 'Publish'}
        </button>
        {tenant?.brand_css_file && (
          <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: -10 }}>
            Active theme: {tenant.brand_css_file}
          </p>
        )}
      </div>

      {/* ── Live preview column ── */}
      <div>
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Live Preview</h3>

          <div style={{ background: primary, borderRadius: 6, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {logoPreviewUrl ? (
                <img src={logoPreviewUrl} alt="logo" style={{ height: 28, maxWidth: 80, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {(tenant?.shop_name ?? 'S')[0].toUpperCase()}
                </div>
              )}
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{tenant?.shop_name ?? 'Your Shop'}</span>
            </div>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.75)' }}>Topbar</span>
          </div>

          <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ width: 100, background: '#fff', borderRight: '1px solid var(--border)', padding: '8px 0' }}>
              {['Dashboard', 'Work Orders', 'Staff'].map((item, i) => (
                <div key={item} style={{
                  padding: '6px 12px', fontSize: 11,
                  fontWeight: i === 0 ? 700 : 400,
                  color:      i === 0 ? primary : 'var(--text)',
                  background: i === 0 ? `${primary}18` : 'transparent',
                  borderLeft: i === 0 ? `3px solid ${primary}` : '3px solid transparent',
                }}>
                  {item}
                </div>
              ))}
            </div>
            <div style={{ flex: 1, padding: 12, background: 'var(--bg)' }}>
              <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 8 }}>Dashboard</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {['New', 'In Progress', 'Done'].map(s => (
                  <div key={s} style={{ flex: 1, background: '#fff', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', fontSize: 10 }}>
                    <div style={{ color: 'var(--muted)', marginBottom: 3 }}>{s}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>0</div>
                  </div>
                ))}
              </div>
              <button style={{ marginTop: 10, background: primary, color: '#fff', border: 'none', borderRadius: 4, padding: '5px 10px', fontSize: 10, cursor: 'default' }}>
                + New Workorder
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ width: 22, height: 22, borderRadius: 4, background: primary, border: '1px solid var(--border)' }} />
            <span style={{ fontSize: 11, color: 'var(--muted)', fontFamily: 'monospace' }}>{primary}</span>
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>— brand primary</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Settings page ─────────────────────────────────────────────────────────────

export default function Settings() {
  const { get }   = useApi()
  const toast     = useToast()
  const { tenantId, idToken, isAdmin } = useAuth()
  const [tenant,  setTenant]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('shop')

  useEffect(() => {
    get('/tenant')
      .then(setTenant)
      .catch(e => toast(e.message, 'error'))
      .finally(() => setLoading(false))
  }, [])

  const inviteLink = `${window.location.origin}/login`

  if (loading) return <div className="spinner" />

  return (
    <div>
      <div className="ph"><h1>Settings</h1></div>

      <div className="tabs">
        <button className={`tab${tab === 'shop' ? ' active' : ''}`} onClick={() => setTab('shop')}>
          Shop Info
        </button>
        {isAdmin && (
          <button className={`tab${tab === 'branding' ? ' active' : ''}`} onClick={() => setTab('branding')}>
            Branding
          </button>
        )}
      </div>

      {tab === 'shop' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontWeight: 600, fontSize: 15, marginBottom: 16 }}>Shop Info</h2>
            <div className="fg"><label>Shop Name</label>
              <input value={tenant?.shop_name ?? ''} readOnly style={{ background: 'var(--bg)' }} />
            </div>
            <div className="fg"><label>Subdomain</label>
              <input value={tenant?.tenant_id ?? tenantId} readOnly style={{ background: 'var(--bg)' }} />
            </div>
            <div className="fg"><label>Domain</label>
              <input value={tenant?.domain ?? ''} readOnly style={{ background: 'var(--bg)' }} />
            </div>
            <div className="fg"><label>Plan</label>
              <input value={tenant?.plan ?? ''} readOnly style={{ background: 'var(--bg)' }} />
            </div>
            {tenant?.phone && <div className="fg"><label>Phone</label>
              <input value={tenant.phone} readOnly style={{ background: 'var(--bg)' }} />
            </div>}
            {tenant?.address && <div className="fg"><label>Address</label>
              <input value={tenant.address} readOnly style={{ background: 'var(--bg)' }} />
            </div>}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card" style={{ padding: 20 }}>
              <h2 style={{ fontWeight: 600, fontSize: 15, marginBottom: 12 }}>Invite Link</h2>
              <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 10 }}>
                Share this link with staff members to access the portal.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={inviteLink} readOnly
                  style={{ flex: 1, padding: '7px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 13, background: 'var(--bg)' }} />
                <button className="btn btn-secondary btn-sm"
                  onClick={() => { navigator.clipboard.writeText(inviteLink); toast('Copied!') }}>
                  Copy
                </button>
              </div>
            </div>

            {tenant?.brand_color && (
              <div className="card" style={{ padding: 16 }}>
                <h2 style={{ fontWeight: 600, fontSize: 15, marginBottom: 10 }}>Active Branding</h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ width: 24, height: 24, borderRadius: 4, background: tenant.brand_color, border: '1px solid var(--border)' }} />
                  <span style={{ fontSize: 13, fontFamily: 'monospace' }}>{tenant.brand_color}</span>
                </div>
                {tenant.brand_css_file && (
                  <p style={{ fontSize: 11, color: 'var(--muted)' }}>{tenant.brand_css_file}</p>
                )}
                {!isAdmin && (
                  <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 6 }}>
                    Contact your shop admin to change branding.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'branding' && isAdmin && (
        <BrandingPanel
          tenant={tenant}
          idToken={idToken}
          onPublished={(updated) => setTenant(t => ({ ...t, ...updated }))}
        />
      )}
    </div>
  )
}
