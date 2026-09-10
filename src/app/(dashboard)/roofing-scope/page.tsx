'use client'

import { useState, useEffect } from 'react'
import {
  Home,
  Sparkles,
  Copy,
  Download,
  Check,
  RotateCcw,
  FileSpreadsheet,
  Layers,
  FileText,
  Mail,
  Camera,
  Upload,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CameraCapture from '@/components/CameraCapture'

interface LineItem {
  cat: string
  sel: string
  act: string
  desc: string
  qty: string
  unit: string
  f9: string
}

export default function RoofingScopePage() {
  // Claim Metadata
  const [claimNum, setClaimNum] = useState('')
  const [insuredName, setInsuredName] = useState('')
  const [inspectedWith, setInspectedWith] = useState('Solo (No One Present)')
  const [eagleViewRequested, setEagleViewRequested] = useState('Yes')

  // Geometry Inputs
  const [totalSq, setTotalSq] = useState<number | ''>(28.33)
  const [eavesLf, setEavesLf] = useState<number | ''>(140)
  const [rakesLf, setRakesLf] = useState<number | ''>(96)
  const [ridgesLf, setRidgesLf] = useState<number | ''>(48)
  const [valleysLf, setValleysLf] = useState<number | ''>(32)
  const [steepSq, setSteepSq] = useState<number | ''>(0)
  const [highSq, setHighSq] = useState<number | ''>(0)

  // Specification Details
  const [material, setMaterial] = useState('Architectural')
  const [layers, setLayers] = useState(1)
  const [pitch, setPitch] = useState('6/12')
  const [wastePct, setWastePct] = useState(0.12)
  const [dripEdge, setDripEdge] = useState(true)
  const [starterCourse, setStarterCourse] = useState(true)
  const [ridgeCap, setRidgeCap] = useState(true)
  const [valleyType, setValleyType] = useState('Closed Cut / IWS')
  const [pipeJacks, setPipeJacks] = useState<number | ''>(3)
  const [boxVents, setBoxVents] = useState<number | ''>(4)

  // Calculated Results
  const [calculated, setCalculated] = useState(false)
  const [items, setItems] = useState<LineItem[]>([])
  const [xactBatch, setXactBatch] = useState('')
  const [scopeMarkdown, setScopeMarkdown] = useState('')
  const [copiedXact, setCopiedXact] = useState(false)
  const [copiedScope, setCopiedScope] = useState(false)
  const [savedToCloud, setSavedToCloud] = useState(false)
  const [saving, setSaving] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleEmail = async () => {
    if (emailSending || !scopeMarkdown) return
    setEmailSending(true)
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `State Farm Roofing Scope Sheet${claimNum ? ` — Claim ${claimNum}` : ''}${insuredName ? ` — ${insuredName}` : ''}`,
          body: scopeMarkdown,
          claimRef: claimNum,
        }),
      })
      if (!res.ok) throw new Error('Send failed')
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch {
      alert('Email failed to send. Please check your email configuration.')
    } finally {
      setEmailSending(false)
    }
  }

  // Run calculation whenever geometry or specs change
  const runEstimate = () => {
    const sq = Number(totalSq) || 0
    const eaves = Number(eavesLf) || 0
    const rakes = Number(rakesLf) || 0
    const ridges = Number(ridgesLf) || 0
    const valleys = Number(valleysLf) || 0
    const steep = Number(steepSq) || 0
    const high = Number(highSq) || 0
    const pipes = Number(pipeJacks) || 0
    const vents = Number(boxVents) || 0

    if (sq <= 0) return

    // Gross Install Area with waste rounded up to bundle (0.33 SQ)
    const grossInstallSq = Math.ceil(sq * (1 + wastePct) * 3) / 3

    // Shingle Code selector
    let shingleSel = '300'
    let shingleDesc = '30 yr - Laminated / Architectural Shingle'
    if (material === '3-Tab') {
      shingleSel = '240'
      shingleDesc = '25 yr - 3-Tab Composition Shingle'
    } else if (material === 'Impact Resistant') {
      shingleSel = '300IR'
      shingleDesc = 'Class 4 Impact Resistant Laminated Shingle'
    }

    // Ice & Water Shield (3ft wide along eaves + valleys)
    const iwsSq = Math.round(((eaves * 3.0 + valleys * 3.0) / 100.0) * 100) / 100
    // Net Felt/Synthetic = Gross minus IWS
    const netFeltSq = Math.max(0, Math.round((grossInstallSq - iwsSq) * 100) / 100)

    const list: LineItem[] = []

    // 1. Tear-Off Layer 1
    list.push({
      cat: 'RFG',
      sel: 'ARMV',
      act: '-',
      desc: 'Tear off comp shingles - 1 layer (down to deck)',
      qty: sq.toFixed(2),
      unit: 'SQ',
      f9: 'Standard 1-layer tear off down to wood decking.',
    })

    // Additional layer if > 1
    if (layers > 1) {
      list.push({
        cat: 'RFG',
        sel: 'ARMV>',
        act: '-',
        desc: `Tear off additional layer (${layers - 1} extra layer)`,
        qty: sq.toFixed(2),
        unit: 'SQ',
        f9: `Additional layer removal (${layers} layers existing).`,
      })
    }

    // 2. Shingle Install
    list.push({
      cat: 'RFG',
      sel: shingleSel,
      act: '+',
      desc: shingleDesc,
      qty: grossInstallSq.toFixed(2),
      unit: 'SQ',
      f9: `Includes ${(wastePct * 100).toFixed(0)}% waste factor rounded to bundle (0.33 SQ).`,
    })

    // 3. Synthetic Underlayment / Felt
    if (netFeltSq > 0) {
      list.push({
        cat: 'RFG',
        sel: 'FELT15',
        act: '+',
        desc: 'Synthetic roof underlayment',
        qty: netFeltSq.toFixed(2),
        unit: 'SQ',
        f9: 'Net deck area excluding ice & water shield.',
      })
    }

    // 4. Ice & Water Shield
    if (iwsSq > 0) {
      list.push({
        cat: 'RFG',
        sel: 'IWS',
        act: '+',
        desc: 'Ice & water shield barrier (eaves & valleys)',
        qty: (iwsSq * 100).toFixed(2),
        unit: 'SF',
        f9: 'Installed along eaves (3ft) and valley waterlines per building code.',
      })
    }

    // 5. Drip Edge
    if (dripEdge && eaves + rakes > 0) {
      list.push({
        cat: 'RFG',
        sel: 'DRIP',
        act: '+',
        desc: 'Drip edge metal flashing',
        qty: (eaves + rakes).toFixed(2),
        unit: 'LF',
        f9: 'Eaves + rakes perimeter flashing.',
      })
    }

    // 6. Starter Course
    if (starterCourse && eaves > 0) {
      list.push({
        cat: 'RFG',
        sel: 'STARTER',
        act: '+',
        desc: 'Universal starter strip course',
        qty: eaves.toFixed(2),
        unit: 'LF',
        f9: 'Starter strip along eaves.',
      })
    }

    // 7. Ridge Cap
    if (ridgeCap && ridges > 0) {
      list.push({
        cat: 'RFG',
        sel: 'RIDGC',
        act: '+',
        desc: 'Ridge cap shingles - composition',
        qty: ridges.toFixed(2),
        unit: 'LF',
        f9: 'Ridge and hip cap shingles.',
      })
    }

    // 8. Valley Metal
    if (valleyType === 'Metal Valley' && valleys > 0) {
      list.push({
        cat: 'RFG',
        sel: 'VAL',
        act: '+',
        desc: 'Valley metal flashing (W-valley)',
        qty: valleys.toFixed(2),
        unit: 'LF',
        f9: 'Pre-formed metal valley liner.',
      })
    }

    // 9. Pipe Jacks
    if (pipes > 0) {
      list.push({
        cat: 'RFG',
        sel: 'FLPIPE',
        act: '+',
        desc: 'Neoprene / lead pipe jack flashing boot',
        qty: pipes.toString(),
        unit: 'EA',
        f9: 'Replace plumbing vent boot flashings.',
      })
    }

    // 10. Box Vents
    if (vents > 0) {
      list.push({
        cat: 'RFG',
        sel: 'VENTT',
        act: '+',
        desc: 'Roof exhaust box vent (turtle vent)',
        qty: vents.toString(),
        unit: 'EA',
        f9: 'Replace static roof turtle vents.',
      })
    }

    // 11. Steep / High Charges
    if (steep > 0) {
      list.push({
        cat: 'RFG',
        sel: 'STEEP',
        act: '+',
        desc: 'Steep roof charge (7/12 to 9/12 pitch)',
        qty: steep.toFixed(2),
        unit: 'SQ',
        f9: 'Labor allowance for steep slope pitch.',
      })
    }
    if (high > 0) {
      list.push({
        cat: 'RFG',
        sel: 'HIGH',
        act: '+',
        desc: 'High roof charge (2 stories or greater)',
        qty: high.toFixed(2),
        unit: 'SQ',
        f9: 'Access & safety allowance for 2nd story roof.',
      })
    }

    setItems(list)

    // Build Quick Entry Bar Batch
    const batch = list.map((i) => `${i.cat} ${i.sel} ${i.act} ${i.qty}`).join('; ')
    setXactBatch(batch)

    // Build Formatted Scope Markdown
    const md = `### State Farm Roofing Scope Form (OG 75-160)
**Claim #**: ${claimNum || 'Pending'}
**Insured**: ${insuredName || 'Homeowner'}
**Inspected With**: ${inspectedWith}
**EagleView Requested**: ${eagleViewRequested}
**Pitch**: ${pitch} | **Waste**: ${(wastePct * 100).toFixed(0)}%

| Cat | Sel | Act | Description | Qty | Unit | Notes |
|:---|:---|:---:|:---|:---:|:---:|:---|
${list.map((i) => `| ${i.cat} | ${i.sel} | ${i.act} | ${i.desc} | ${i.qty} | ${i.unit} | ${i.f9} |`).join('\n')}

**Quick Entry Bar Batch**:
\`\`\`
${batch}
\`\`\`
`
    setScopeMarkdown(md)
    setCalculated(true)
  }

  // Initial calculation on mount
  useEffect(() => {
    runEstimate()
  }, [])

  const copyToClipboard = (text: string, isScope: boolean) => {
    navigator.clipboard.writeText(text)
    if (isScope) {
      setCopiedScope(true)
      setTimeout(() => setCopiedScope(false), 2000)
    } else {
      setCopiedXact(true)
      setTimeout(() => setCopiedXact(false), 2000)
    }
  }

  const exportCsv = () => {
    if (items.length === 0) return
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Category,Selector,Action,Description,Quantity,Unit,Notes']
        .concat(items.map((i) => `"${i.cat}","${i.sel}","${i.act}","${i.desc}","${i.qty}","${i.unit}","${i.f9}"`))
        .join('\n')
    const encodedUri = encodeURI(csvContent)
    const link = document.createElement('a')
    link.setAttribute('href', encodedUri)
    link.setAttribute('download', `Scope_${claimNum || 'Roof'}_${Date.now()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const saveToVault = async () => {
    if (saving || items.length === 0) return
    setSaving(true)
    try {
      await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_id: claimNum || `Claim-${Date.now().toString().slice(-4)}`,
          report_type: 'scope',
          summary: `State Farm Roofing Scope: ${totalSq} SQ (${pitch}, ${(wastePct * 100).toFixed(0)}% waste) - ${insuredName || 'Insured'}`,
          content: scopeMarkdown,
        }),
      })
      setSavedToCloud(true)
      setTimeout(() => setSavedToCloud(false), 3000)
    } catch (err) {
      console.error('Failed to save to cloud', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Header Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-red-950/70 via-slate-900 to-slate-950 border border-red-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-600/40 ring-1 ring-red-400/40">
              <Home className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  State Farm Roofing Scope Sheet
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40">
                  OG 75-160
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Official Verbatim Scope Form & EagleView 1-Tap Estimatics Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={runEstimate}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-red-700/30 transition-all flex items-center gap-2 active:scale-95"
            >
              <Sparkles className="w-4 h-4" />
              1-Tap Auto-Estimate
            </button>
            <button
              onClick={exportCsv}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Claim Metadata Form */}
      <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl">
        <CardHeader className="py-4 border-b border-slate-800/80">
          <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
            <FileText className="w-4 h-4 text-red-400" />
            Claim & Inspection Details
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Claim #</label>
              <input
                type="text"
                value={claimNum}
                onChange={(e) => setClaimNum(e.target.value)}
                placeholder="e.g. 52-2026-9482X"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Insured Name</label>
              <input
                type="text"
                value={insuredName}
                onChange={(e) => setInsuredName(e.target.value)}
                placeholder="e.g. John Smith"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Inspected With</label>
              <select
                value={inspectedWith}
                onChange={(e) => setInspectedWith(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="Solo (No One Present)">Solo (No One Present)</option>
                <option value="Contractor">Contractor</option>
                <option value="Insured">Insured</option>
                <option value="Public Adjuster">Public Adjuster</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">EagleView Requested?</label>
              <select
                value={eagleViewRequested}
                onChange={(e) => setEagleViewRequested(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="Yes">Yes (Y)</option>
                <option value="No">No (N)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Geometry & EagleView Inputs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dimensions */}
        <Card className="lg:col-span-2 bg-slate-900/80 border-slate-800 backdrop-blur-xl">
          <CardHeader className="py-4 border-b border-slate-800/80 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-400" />
              Roof Geometry (EagleView / Measurements)
            </CardTitle>
            <span className="text-[11px] text-slate-400">Total: {totalSq || 0} SQ</span>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Total Squares (SQ)</label>
                <input
                  type="number"
                  step="0.01"
                  value={totalSq}
                  onChange={(e) => setTotalSq(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Pitch Slope</label>
                <select
                  value={pitch}
                  onChange={(e) => setPitch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value="4/12">4/12 (Flat-Gable)</option>
                  <option value="5/12">5/12</option>
                  <option value="6/12">6/12 (Standard)</option>
                  <option value="7/12">7/12 (Steep)</option>
                  <option value="8/12">8/12 (Steep)</option>
                  <option value="9/12">9/12 (Steep)</option>
                  <option value="10/12">10/12 (High Steep)</option>
                  <option value="12/12">12/12 (Mansard/Severe)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Waste Factor (%)</label>
                <select
                  value={wastePct}
                  onChange={(e) => setWastePct(parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                >
                  <option value={0.10}>10% (Simple Gable)</option>
                  <option value={0.12}>12% (Standard Hip)</option>
                  <option value={0.15}>15% (Cut-Up Hip)</option>
                  <option value={0.17}>17% (Complex Multi-Slope)</option>
                  <option value={0.20}>20% (Severe Cut-Up/Turrets)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Eaves (LF)</label>
                <input
                  type="number"
                  value={eavesLf}
                  onChange={(e) => setEavesLf(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Rakes (LF)</label>
                <input
                  type="number"
                  value={rakesLf}
                  onChange={(e) => setRakesLf(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Ridges & Hips (LF)</label>
                <input
                  type="number"
                  value={ridgesLf}
                  onChange={(e) => setRidgesLf(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Valleys (LF)</label>
                <input
                  type="number"
                  value={valleysLf}
                  onChange={(e) => setValleysLf(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Steep Slope (SQ)</label>
                <input
                  type="number"
                  value={steepSq}
                  onChange={(e) => setSteepSq(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0 (7/12+)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">High Roof (SQ)</label>
                <input
                  type="number"
                  value={highSq}
                  onChange={(e) => setHighSq(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="0 (2-Story)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Shingle & Flashings Config */}
        <Card className="bg-slate-900/80 border-slate-800 backdrop-blur-xl">
          <CardHeader className="py-4 border-b border-slate-800/80">
            <CardTitle className="text-sm font-bold text-slate-200 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-red-400" />
              Material & Components
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Shingle Material</label>
              <select
                value={material}
                onChange={(e) => setMaterial(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value="Architectural">Architectural / Laminated (RFG 300)</option>
                <option value="3-Tab">3-Tab Composition (RFG 240)</option>
                <option value="Impact Resistant">Class 4 Impact Resistant (RFG 300IR)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-400 block mb-1">Existing Layers</label>
              <select
                value={layers}
                onChange={(e) => setLayers(parseInt(e.target.value))}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-red-500"
              >
                <option value={1}>1 Layer Tear-Off</option>
                <option value={2}>2 Layers Tear-Off</option>
                <option value={3}>3 Layers Tear-Off</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Pipe Jacks (EA)</label>
                <input
                  type="number"
                  value={pipeJacks}
                  onChange={(e) => setPipeJacks(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 block mb-1">Turtle Vents (EA)</label>
                <input
                  type="number"
                  value={boxVents}
                  onChange={(e) => setBoxVents(e.target.value === '' ? '' : parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-red-500"
                />
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={dripEdge}
                  onChange={(e) => setDripEdge(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>Include Drip Edge on Eaves & Rakes</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={starterCourse}
                  onChange={(e) => setStarterCourse(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>Include Starter Course along Eaves</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={ridgeCap}
                  onChange={(e) => setRidgeCap(e.target.checked)}
                  className="rounded border-slate-700 text-red-600 focus:ring-red-500"
                />
                <span>Include Ridge & Hip Cap Shingles</span>
              </label>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 1-Tap Output Results */}
      {calculated && items.length > 0 && (
        <Card className="bg-slate-900/90 border-red-500/40 shadow-2xl backdrop-blur-xl">
          <CardHeader className="py-4 border-b border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-red-400" />
                Generated Xactimate Scope ({items.length} Line Items)
              </CardTitle>
              <p className="text-xs text-slate-400 mt-0.5">
                Install: {(Number(totalSq) * (1 + wastePct)).toFixed(2)} SQ w/ waste → Rounded up to{' '}
                {(Math.ceil(Number(totalSq) * (1 + wastePct) * 3) / 3).toFixed(2)} SQ
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={handleEmail}
                disabled={emailSending}
                className="px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-semibold transition-all flex items-center gap-1.5 active:scale-95 disabled:opacity-50"
                title="Send full roofing scope to work email"
              >
                {emailSending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : emailSent ? (
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                ) : (
                  <Mail className="w-3.5 h-3.5 text-indigo-400" />
                )}
                {emailSent ? 'Sent to Work!' : emailSending ? 'Sending…' : 'Email to Work'}
              </button>
              <button
                onClick={() => copyToClipboard(xactBatch, false)}
                className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                {copiedXact ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedXact ? 'Copied Codes!' : 'Copy Quick Entry Bar'}
              </button>
              <button
                onClick={() => copyToClipboard(scopeMarkdown, true)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                {copiedScope ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copiedScope ? 'Copied Form!' : 'Copy Scope Form'}
              </button>
              <button
                onClick={saveToVault}
                disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-red-600/30 hover:bg-red-600/40 text-red-200 border border-red-500/40 text-xs font-semibold transition-all flex items-center gap-1.5"
              >
                {savedToCloud ? <Check className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                {savedToCloud ? 'Saved to Vault!' : saving ? 'Saving...' : 'Save to Cloud Vault'}
              </button>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950/70 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-2.5 px-3">Cat</th>
                  <th className="py-2.5 px-3">Sel</th>
                  <th className="py-2.5 px-2 text-center">Act</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Qty</th>
                  <th className="py-2.5 px-3">Unit</th>
                  <th className="py-2.5 px-4">Calculation / Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-red-400">{item.cat}</td>
                    <td className="py-2.5 px-3 text-emerald-400 font-bold">{item.sel}</td>
                    <td className="py-2.5 px-2 text-center text-slate-400">{item.act}</td>
                    <td className="py-2.5 px-3 font-sans text-slate-200 font-medium">{item.desc}</td>
                    <td className="py-2.5 px-3 text-right text-white font-bold">{item.qty}</td>
                    <td className="py-2.5 px-3 text-slate-400">{item.unit}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-400 text-[11px]">{item.f9}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
