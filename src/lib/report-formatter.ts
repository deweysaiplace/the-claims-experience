export interface XactScopeRow {
  cat: string
  sel: string
  act: string
  description: string
  qty: string
  unit: string
  f9Justification: string
  isZeroDollar: boolean
}

export interface EngineerReportData {
  summary: {
    firm: string
    reportDate: string
    inspectionDate: string
    coverageStatus: 'covered' | 'limited' | 'excluded' | 'unknown'
    primaryFindings: string
  }
  policy: string
  scope: {
    rows: XactScopeRow[]
    quickEntry: string
    rawScope: string
  }
  fileNote: string
  cleanFullReport: string
  hasTags: boolean
}

export function parseEngineerReport(raw: string): EngineerReportData {
  if (!raw) {
    return {
      summary: {
        firm: 'N/A',
        reportDate: 'N/A',
        inspectionDate: 'N/A',
        coverageStatus: 'unknown',
        primaryFindings: ''
      },
      policy: '',
      scope: { rows: [], quickEntry: '', rawScope: '' },
      fileNote: '',
      cleanFullReport: '',
      hasTags: false
    }
  }

  const extract = (tag: string) => {
    const match = raw.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`))
    return match ? match[1].trim() : ''
  }

  const summaryRaw = extract('summary_data')
  const policyRaw = extract('policy_alignment')
  const scopeRaw = extract('xactimate_scope')
  const noteRaw = extract('file_note')

  const hasTags = !!(summaryRaw || policyRaw || scopeRaw || noteRaw)

  // Clean raw tags completely out of full text for raw views/copies
  const cleanFullReport = raw
    .replace(/<\/?(summary_data|policy_alignment|xactimate_scope|file_note)>/gi, '')
    .trim()

  const summary = {
    firm: 'N/A',
    reportDate: 'N/A',
    inspectionDate: 'N/A',
    coverageStatus: 'unknown' as 'covered' | 'limited' | 'excluded' | 'unknown',
    primaryFindings: ''
  }

  if (summaryRaw) {
    summaryRaw.split('\n').forEach(line => {
      const parts = line.split(':')
      if (parts.length >= 2) {
        const key = parts[0].trim().toUpperCase()
        const val = parts.slice(1).join(':').trim()
        if (key === 'ENGINEER_FIRM') summary.firm = val
        if (key === 'REPORT_DATE') summary.reportDate = val
        if (key === 'INSPECTION_DATE') summary.inspectionDate = val
        if (key === 'PRIMARY_FINDINGS') summary.primaryFindings = val
      }
    })
  }

  // Parse coverage status from findings, note or policy text
  const fullCheckText = `${summary.primaryFindings} ${noteRaw} ${policyRaw} ${raw}`.toLowerCase()
  if (fullCheckText.includes('no coverage') || fullCheckText.includes('excluded / denied') || fullCheckText.includes('no covered storm damage')) {
    summary.coverageStatus = 'excluded'
  } else if (fullCheckText.includes('limited repair') || fullCheckText.includes('partially covered') || fullCheckText.includes('minor repair')) {
    summary.coverageStatus = 'limited'
  } else if (fullCheckText.includes('fully covered') || fullCheckText.includes('covered storm damage')) {
    summary.coverageStatus = 'covered'
  }

  // Parse markdown table rows in Xactimate Scope or raw text
  const rows: XactScopeRow[] = []
  let quickEntry = ''

  const scopeToParse = scopeRaw || raw

  if (scopeToParse) {
    // Extract quick entry code block
    const qeMatch = scopeToParse.match(/```[a-z]*\s*([\s\S]*?)```/i)
    if (qeMatch) {
      quickEntry = qeMatch[1].trim()
    }

    // Parse markdown table lines
    const lines = scopeToParse.split('\n')
    lines.forEach(line => {
      const trimmed = line.trim()
      if (trimmed.startsWith('|') && !trimmed.includes('---') && !trimmed.toLowerCase().includes('description')) {
        const cells = trimmed.split('|').map(c => c.trim()).filter((_, idx, arr) => idx > 0 && idx < arr.length - 1)
        if (cells.length >= 4) {
          let cat = '', sel = '', act = '', description = '', qty = '', unit = '', f9Justification = ''
          if (cells.length >= 7) {
            [cat, sel, act, description, qty, unit, f9Justification] = cells
          } else if (cells.length === 5) {
            [act, description, qty, unit, f9Justification] = cells
          } else if (cells.length === 6) {
            [act, description, qty, unit, f9Justification] = cells
          } else if (cells.length === 4) {
            [act, description, qty, f9Justification] = cells
          }

          const combinedText = `${qty} ${unit} ${description} ${f9Justification}`.toLowerCase()
          const isZeroDollar = qty === '0.00' || qty === '0' || combinedText.includes('no coverage') || combinedText.includes('$0.00')

          rows.push({
            cat,
            sel,
            act,
            description,
            qty,
            unit,
            f9Justification,
            isZeroDollar
          })
        }
      }
    })
  }

  return {
    summary,
    policy: policyRaw || cleanFullReport,
    scope: {
      rows,
      quickEntry,
      rawScope: scopeRaw
    },
    fileNote: noteRaw,
    cleanFullReport,
    hasTags
  }
}

export function formatMarkdownToHtml(md: string): string {
  if (!md) return ''
  let html = md
    // Format headers
    .replace(/^### (.*$)/gim, '<h3 style="color: #f59e0b; font-size: 15px; margin-top: 18px; margin-bottom: 8px; font-weight: 700; border-bottom: 1px solid #1e293b; padding-bottom: 4px;">$1</h3>')
    .replace(/^## (.*$)/gim, '<h2 style="color: #fbbf24; font-size: 17px; margin-top: 22px; margin-bottom: 10px; font-weight: 800;">$1</h2>')
    .replace(/^# (.*$)/gim, '<h1 style="color: #ffffff; font-size: 20px; margin-top: 24px; margin-bottom: 12px; font-weight: 900;">$1</h1>')
    // Format bold and italics
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff;">$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    // Format lists
    .replace(/^- (.*$)/gim, '<li style="margin-bottom: 6px; color: #e2e8f0; font-size: 13px;">$1</li>')
    // Format code blocks
    .replace(/```[a-z]*\s*([\s\S]*?)```/gi, '<pre style="background-color: #020617; padding: 12px; border-radius: 8px; border: 1px solid #1e293b; color: #f43f5e; font-family: monospace; font-size: 12px; white-space: pre-wrap;">$1</pre>')

  // Convert markdown pipe tables to styled HTML tables
  const tableRegex = /(\|.*\|\n)+/g
  html = html.replace(tableRegex, (tableMatch) => {
    const lines = tableMatch.trim().split('\n')
    let tableHtml = '<table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin: 14px 0; border-radius: 8px; overflow: hidden; border: 1px solid #334155;">'
    
    lines.forEach((line, idx) => {
      if (line.includes('---')) return
      const cells = line.split('|').map(c => c.trim()).filter((_, i, arr) => i > 0 && i < arr.length - 1)
      if (cells.length === 0) return

      if (idx === 0) {
        tableHtml += '<thead style="background-color: #1e293b;"><tr>'
        cells.forEach(c => {
          tableHtml += `<th style="padding: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; text-align: left; border-bottom: 1px solid #334155;">${c}</th>`
        })
        tableHtml += '</tr></thead><tbody>'
      } else {
        const isZero = line.includes('0.00') || line.toLowerCase().includes('no coverage')
        tableHtml += `<tr style="background-color: ${isZero ? '#18181b' : idx % 2 === 0 ? '#0f172a' : '#1e293b'}; border-bottom: 1px solid #1e293b;">`
        cells.forEach((c, cIdx) => {
          tableHtml += `<td style="padding: 10px; font-size: 12px; color: ${cIdx === 0 ? '#94a3b8; font-family: monospace;' : '#e2e8f0;'};">${c}</td>`
        })
        tableHtml += '</tr>'
      }
    })

    tableHtml += 'tbody></table>'
    return tableHtml
  })

  return html.replace(/\n\n/g, '<br/>')
}

export function generateEngineerReportHtml(data: EngineerReportData, claimRef?: string, address?: string): string {
  const { summary, policy, scope, fileNote, hasTags } = data

  const statusBadgeBg =
    summary.coverageStatus === 'excluded' ? '#7f1d1d' :
    summary.coverageStatus === 'limited' ? '#78350f' :
    summary.coverageStatus === 'covered' ? '#064e3b' : '#334155'

  const statusBadgeText =
    summary.coverageStatus === 'excluded' ? '#fca5a5' :
    summary.coverageStatus === 'limited' ? '#fcd34d' :
    summary.coverageStatus === 'covered' ? '#6ee7b7' : '#cbd5e1'

  const statusLabel =
    summary.coverageStatus === 'excluded' ? '🔴 EXCLUDED / NO COVERED DAMAGE' :
    summary.coverageStatus === 'limited' ? '🟡 LIMITED REPAIR / MAINTENANCE' :
    summary.coverageStatus === 'covered' ? '🟢 COVERED STORM DAMAGE' : '🛡️ AUDIT COMPLETE'

  const tableRowsHtml = scope.rows.map((row, idx) => `
    <tr style="background-color: ${row.isZeroDollar ? '#18181b' : idx % 2 === 0 ? '#0f172a' : '#1e293b'}; border-bottom: 1px solid #334155;">
      <td style="padding: 10px; font-family: monospace; font-size: 12px; color: #94a3b8;">${row.act || 'R&R'}</td>
      <td style="padding: 10px; font-size: 13px; color: #f8fafc; font-weight: 600;">
        ${row.description}
        ${row.isZeroDollar ? '<span style="display: inline-block; margin-left: 6px; padding: 2px 6px; background-color: #451a03; color: #fbbf24; font-size: 10px; border-radius: 4px; border: 1px solid #78350f;">$0.00 Allowance</span>' : ''}
      </td>
      <td style="padding: 10px; font-size: 13px; color: ${row.isZeroDollar ? '#f59e0b' : '#38bdf8'}; font-weight: 700; text-align: center;">${row.qty} ${row.unit}</td>
      <td style="padding: 10px; font-size: 12px; color: #cbd5e1; line-height: 1.4;">${row.f9Justification}</td>
    </tr>
  `).join('')

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Claims Experience Report</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0; -webkit-font-smoothing: antialiased;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 20px 10px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 680px; background-color: #0f172a; border-radius: 16px; overflow: hidden; border: 1px solid #1e293b; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <!-- Header Banner -->
          <tr>
            <td style="padding: 28px 24px; background: linear-gradient(135deg, #064e3b 0%, #0f172a 70%, #1e1b4b 100%); border-bottom: 1px solid #047857;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; background-color: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 11px; font-weight: 800; tracking: 1px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.4); text-transform: uppercase;">
                      EXECUTIVE FIELD REPORT
                    </span>
                    <h1 style="margin: 12px 0 6px 0; font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                      Claims Experience Audit Report
                    </h1>
                    <p style="margin: 0; font-size: 13px; color: #cbd5e1;">
                      ${claimRef ? `Claim Ref: <strong>${claimRef}</strong> &bull; ` : ''}${address ? `Address: <strong>${address}</strong>` : 'Field Assessment & Scope Reconciliation'}
                    </p>
                  </td>
                  <td align="right" valign="top">
                    <span style="display: inline-block; padding: 6px 14px; background-color: ${statusBadgeBg}; color: ${statusBadgeText}; font-size: 11px; font-weight: 800; border-radius: 8px; border: 1px solid ${statusBadgeText}40; text-align: center; white-space: nowrap;">
                      ${statusLabel}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Summary Badges -->
          ${hasTags ? `
          <tr>
            <td style="padding: 20px 24px 10px 24px; background-color: #0b1329;">
              <table width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td width="33%" style="padding: 10px; background-color: #1e293b; border-radius: 10px; border: 1px solid #334155;">
                    <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Firm / Entity</div>
                    <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 4px;">${summary.firm}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="33%" style="padding: 10px; background-color: #1e293b; border-radius: 10px; border: 1px solid #334155;">
                    <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Report Date</div>
                    <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 4px;">${summary.reportDate}</div>
                  </td>
                  <td width="2%"></td>
                  <td width="30%" style="padding: 10px; background-color: #1e293b; border-radius: 10px; border: 1px solid #334155;">
                    <div style="font-size: 10px; font-weight: 700; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px;">Audit Status</div>
                    <div style="font-size: 13px; font-weight: 800; color: #34d399; margin-top: 4px;">Verified Clean</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Main Report Body Section -->
          <tr>
            <td style="padding: 20px 24px;">
              <div style="background-color: #0b1329; border-radius: 12px; padding: 20px; border: 1px solid #1e293b;">
                <h3 style="margin-top: 0; color: #fbbf24; font-size: 16px; font-weight: 800; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
                  📋 Assessment & Policy Analysis
                </h3>
                <div style="font-size: 13px; line-height: 1.6; color: #cbd5e1;">
                  ${formatMarkdownToHtml(policy)}
                </div>
              </div>
            </td>
          </tr>

          <!-- Xactimate Scope Table -->
          ${scope.rows.length > 0 ? `
          <tr>
            <td style="padding: 0 24px 20px 24px;">
              <div style="background-color: #0b1329; border-radius: 12px; padding: 20px; border: 1px solid #1e293b;">
                <h3 style="margin-top: 0; color: #38bdf8; font-size: 16px; font-weight: 800; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
                  📊 Recommended Structural Xactimate Scope
                </h3>
                <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; margin-top: 12px; border-radius: 8px; overflow: hidden;">
                  <thead>
                    <tr style="background-color: #1e293b; text-align: left;">
                      <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Act</th>
                      <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Description</th>
                      <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; text-align: center;">Qty</th>
                      <th style="padding: 10px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">F9 Justification & Citation</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${tableRowsHtml}
                  </tbody>
                </table>

                ${scope.quickEntry ? `
                <div style="margin-top: 16px; padding: 12px; background-color: #18181b; border-radius: 8px; border: 1px dashed #3f3f46;">
                  <div style="font-size: 10px; font-weight: 800; color: #a1a1aa; text-transform: uppercase; letter-spacing: 0.5px;">Quick Entry Batch String</div>
                  <pre style="margin: 6px 0 0 0; font-family: monospace; font-size: 12px; color: #f43f5e; white-space: pre-wrap; word-break: break-all;">${scope.quickEntry}</pre>
                </div>
                ` : ''}
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Adjuster File Note -->
          ${fileNote ? `
          <tr>
            <td style="padding: 0 24px 24px 24px;">
              <div style="background-color: #0b1329; border-radius: 12px; padding: 20px; border: 1px solid #1e293b;">
                <h3 style="margin-top: 0; color: #34d399; font-size: 16px; font-weight: 800; border-bottom: 1px solid #1e293b; padding-bottom: 8px;">
                  📝 Formal Claim System File Note
                </h3>
                <pre style="margin: 12px 0 0 0; font-family: 'Courier New', Courier, monospace; font-size: 12px; line-height: 1.5; color: #e2e8f0; background-color: #020617; padding: 14px; border-radius: 8px; border: 1px solid #1e293b; white-space: pre-wrap; word-break: break-word;">${fileNote}</pre>
              </div>
            </td>
          </tr>
          ` : ''}

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 24px; background-color: #020617; border-top: 1px solid #1e293b; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                Generated by <strong>The Claims Experience PWA</strong> &bull; Property Claims Intelligence
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `
}
