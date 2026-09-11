'use client'

import { useState, useEffect } from 'react'
import { Plus, Trash2, Edit2, Check, Copy, FileSpreadsheet, ShieldAlert, RotateCcw } from 'lucide-react'
import type { XactScopeRow } from '@/lib/report-formatter'

interface ScopeEditorProps {
  initialRows: XactScopeRow[]
  onRowsChange?: (rows: XactScopeRow[]) => void
}

export function generateQuickEntryString(rows: XactScopeRow[]): string {
  const activeItems = rows.filter(r => !r.isZeroDollar && r.qty !== '0.00' && r.qty !== '0')
  return activeItems.map(r => {
    const code = (r.cat && r.sel) ? `${r.cat} ${r.sel}` : r.act || r.description.split(' ')[0]
    return `${code.trim()} + ${r.qty}`
  }).join('; ')
}

export default function ScopeEditor({ initialRows, onRowsChange }: ScopeEditorProps) {
  const [rows, setRows] = useState<XactScopeRow[]>(initialRows)
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [quickEntry, setQuickEntry] = useState('')

  useEffect(() => {
    setRows(initialRows)
  }, [initialRows])

  useEffect(() => {
    const qe = generateQuickEntryString(rows)
    setQuickEntry(qe)
    if (onRowsChange) onRowsChange(rows)
  }, [rows])

  const handleUpdateRow = (index: number, field: keyof XactScopeRow, value: any) => {
    setRows(prev => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      if (field === 'qty') {
        const isZero = value === '0.00' || value === '0' || value === 0
        updated[index].isZeroDollar = isZero
      }
      return updated
    })
  }

  const toggleZeroDollar = (index: number) => {
    setRows(prev => {
      const updated = [...prev]
      const current = updated[index].isZeroDollar
      updated[index].isZeroDollar = !current
      if (!current) {
        updated[index].qty = '0.00'
      }
      return updated
    })
  }

  const handleDeleteRow = (index: number) => {
    setRows(prev => prev.filter((_, i) => i !== index))
  }

  const handleAddRow = () => {
    const newRow: XactScopeRow = {
      cat: 'STR',
      sel: 'FRM',
      act: 'R&R',
      description: 'Custom Structural / Framing Line Item',
      qty: '1.00',
      unit: 'EA',
      f9Justification: 'Field adjuster scope addition',
      isZeroDollar: false
    }
    setRows(prev => [...prev, newRow])
    setEditingIdx(rows.length)
  }

  const handleCopyQuickEntry = async () => {
    await navigator.clipboard.writeText(quickEntry)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-sky-400" />
          <h3 className="text-base font-bold text-sky-400">Interactive Scope Line-Item Editor</h3>
          <span className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded border border-zinc-700 font-mono">
            {rows.length} items
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleAddRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-600/20 text-sky-300 hover:bg-sky-600/30 border border-sky-500/40 text-xs font-bold transition-all active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" /> Add Line Item
          </button>
          <button
            onClick={() => setRows(initialRows)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-xs font-medium transition-colors"
            title="Reset to AI original draft"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Reset
          </button>
        </div>
      </div>

      {/* Grid Table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/90 shadow-lg">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-900/90 text-zinc-400 text-[11px] font-bold uppercase tracking-wider border-b border-zinc-800">
              <th className="p-3">Act</th>
              <th className="p-3">Description</th>
              <th className="p-3 text-center">Qty / Unit</th>
              <th className="p-3">F9 Justification & Citation</th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60 text-xs">
            {rows.map((row, idx) => (
              <tr key={idx} className={row.isZeroDollar ? 'bg-amber-950/20 hover:bg-amber-950/30' : 'hover:bg-zinc-900/50'}>
                {/* Act */}
                <td className="p-3 font-mono">
                  {editingIdx === idx ? (
                    <input
                      type="text"
                      value={row.act}
                      onChange={e => handleUpdateRow(idx, 'act', e.target.value)}
                      className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white font-mono outline-none"
                    />
                  ) : (
                    <span className="font-bold text-zinc-400">{row.act || 'R&R'}</span>
                  )}
                </td>

                {/* Description */}
                <td className="p-3 font-semibold text-white">
                  {editingIdx === idx ? (
                    <input
                      type="text"
                      value={row.description}
                      onChange={e => handleUpdateRow(idx, 'description', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white outline-none"
                    />
                  ) : (
                    <div>
                      <span>{row.description}</span>
                      {row.isZeroDollar && (
                        <span className="ml-2 px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800/80 text-[10px] font-bold inline-flex items-center gap-1">
                          <ShieldAlert className="w-3 h-3 text-amber-400" /> $0.00 (Excluded)
                        </span>
                      )}
                    </div>
                  )}
                </td>

                {/* Qty / Unit */}
                <td className="p-3 text-center">
                  {editingIdx === idx ? (
                    <div className="flex items-center justify-center gap-1">
                      <input
                        type="text"
                        value={row.qty}
                        onChange={e => handleUpdateRow(idx, 'qty', e.target.value)}
                        className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-sky-400 font-bold text-center outline-none"
                      />
                      <input
                        type="text"
                        value={row.unit}
                        onChange={e => handleUpdateRow(idx, 'unit', e.target.value)}
                        className="w-12 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-400 text-center outline-none"
                      />
                    </div>
                  ) : (
                    <span className={`font-bold ${row.isZeroDollar ? 'text-amber-400' : 'text-sky-400'}`}>
                      {row.qty} {row.unit}
                    </span>
                  )}
                </td>

                {/* F9 Justification */}
                <td className="p-3 text-zinc-300 leading-relaxed">
                  {editingIdx === idx ? (
                    <input
                      type="text"
                      value={row.f9Justification}
                      onChange={e => handleUpdateRow(idx, 'f9Justification', e.target.value)}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 outline-none"
                    />
                  ) : (
                    <span>{row.f9Justification}</span>
                  )}
                </td>

                {/* Actions */}
                <td className="p-3 text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <button
                      onClick={() => setEditingIdx(editingIdx === idx ? null : idx)}
                      className={`p-1.5 rounded transition-colors ${editingIdx === idx ? 'bg-emerald-600/30 text-emerald-400' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'}`}
                      title={editingIdx === idx ? 'Done editing' : 'Edit row'}
                    >
                      {editingIdx === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Edit2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                      onClick={() => toggleZeroDollar(idx)}
                      className={`p-1.5 rounded text-[10px] font-bold transition-colors ${row.isZeroDollar ? 'bg-amber-900/40 text-amber-300 border border-amber-800' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'}`}
                      title="Toggle $0.00 Exclude Status"
                    >
                      $0
                    </button>
                    <button
                      onClick={() => handleDeleteRow(idx)}
                      className="p-1.5 rounded bg-zinc-800 hover:bg-red-950 text-zinc-400 hover:text-red-400 transition-colors"
                      title="Delete row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Quick Entry Batch Callout */}
      {quickEntry && (
        <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 flex items-center justify-between flex-wrap gap-3 shadow-md">
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-extrabold text-zinc-400 uppercase tracking-wider">
              Xactimate Quick Entry Batch String (Auto-Calculated)
            </div>
            <pre className="text-xs font-mono text-pink-400 mt-1 whitespace-pre-wrap break-all selection:bg-pink-900 font-bold">
              {quickEntry}
            </pre>
          </div>
          <button
            onClick={handleCopyQuickEntry}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-500 text-white text-xs font-bold transition-all active:scale-95 shadow-md shadow-pink-950"
          >
            {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
            {copied ? 'Copied Batch Code!' : 'Copy Quick Entry String'}
          </button>
        </div>
      )}
    </div>
  )
}
