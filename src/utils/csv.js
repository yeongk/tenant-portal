// Minimal RFC 4180 CSV parsing and writing — enough for parts lists exported
// from Excel, Google Sheets, QuickBooks and most shop systems (quoted fields,
// embedded commas / quotes / line breaks, CRLF, UTF-8 BOM). Also accepts
// semicolon- or tab-separated files, which some European Excel locales export.

export function parseCsv(text) {
  const src = text.replace(/^﻿/, '')
  const firstLine = src.slice(0, src.search(/\r?\n/) === -1 ? undefined : src.search(/\r?\n/))
  const delim = [',', ';', '\t']
    .map(d => [d, firstLine.split(d).length])
    .sort((a, b) => b[1] - a[1])[0][0]

  const rows = []
  let row = [], field = '', inQuotes = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++ }
        else inQuotes = false
      } else field += c
    } else if (c === '"' && field === '') {
      inQuotes = true
    } else if (c === delim) {
      row.push(field); field = ''
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }

  // drop fully empty lines (common at the end of exported files)
  return rows.filter(r => r.some(v => v.trim() !== ''))
}

const quote = (v) => {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows) {
  return rows.map(r => r.map(quote).join(',')).join('\r\n') + '\r\n'
}

export function downloadText(filename, text, type = 'text/csv') {
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
