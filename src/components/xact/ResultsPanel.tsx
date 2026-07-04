'use client'

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, Copy, Check, ChevronDown, ChevronUp, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { MatchResult, MatchedLineItem } from '@/lib/code-matcher'

interface AnalysisResult {
  observations: string
  materials: string[]
  damageTypes: string[]
  labels: string[]
  matchResult: MatchResult
  summary: string
}

interface ResultsPanelProps {
  result: AnalysisResult
}

const CONFIDENCE_STYLES = {
  high: 'bg-green-600/20 text-green-400 border-green-600/30',
  medium: 'bg-yellow-600/20 text-yellow-400 border-yellow-600/30',
  low: 'bg-orange-600/20 text-orange-400 border-orange-600/30',
}

function LineItemRow({ item }: { item: MatchedLineItem }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <div
        className="flex items-center justify-between p-3 bg-slate-800/60 hover:bg-slate-800 cursor-pointer transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-mono font-bold text-blue-400 text-sm bg-blue-600/10 border border-blue-600/20 px-2 py-0.5 rounded whitespace-nowrap">
            {item.code}
          </span>
          <span className="text-sm text-slate-300 truncate">{item.description}</span>
        </div>
        <div className="flex items-center gap-2 ml-2 shrink-0">
          <span className="text-xs text-slate-500 font-medium">{item.unit}</span>
          <span className={cn('text-xs px-2 py-0.5 rounded-full border font-medium', CONFIDENCE_STYLES[item.confidence])}>
            {item.confidence}
          </span>
          {expanded ? <ChevronUp size={13} className="text-slate-500" /> : <ChevronDown size={13} className="text-slate-500" />}
        </div>
      </div>
      {expanded && (
        <div className="border-t border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-500 space-y-1">
          <div><span className="font-semibold text-slate-400">Category:</span> {item.category}</div>
          <div><span className="font-semibold text-slate-400">Unit:</span> {item.unit}</div>
          {item.matchedOn.length > 0 && (
            <div><span className="font-semibold text-slate-400">Matched on:</span> {item.matchedOn.join(', ')}</div>
          )}
        </div>
      )}
    </div>
  )
}

export default function XactResultsPanel({ result }: ResultsPanelProps) {
  const [copied, setCopied] = useState(false)

  const exportText = () => {
    const lines = [
      'XACTIMATE LINE ITEMS',
      '='.repeat(40),
      '',
      ...(result.matchResult.matched.map((item) =>
        `${item.code.padEnd(14)} ${item.description.padEnd(50)} ${item.unit}`
      )),
      '',
      result.matchResult.unmatched.length > 0 ? 'UNMATCHED ITEMS (review manually):' : '',
      ...(result.matchResult.unmatched.map((u) => `  - ${u.label}: ${u.reason}`)),
      '',
      'SUMMARY',
      '='.repeat(40),
      result.summary,
      '',
      'OBSERVATIONS',
      '='.repeat(40),
      result.observations,
    ].filter((l) => l !== undefined)

    return lines.join('\n')
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(exportText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-white">Analysis Results</h2>
        <button
          onClick={copyToClipboard}
          className="flex items-center gap-2 text-sm px-3 py-1.5 border border-slate-700 rounded-lg hover:bg-slate-800 text-slate-300 transition-colors"
        >
          {copied ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
          {copied ? 'Copied!' : 'Copy All'}
        </button>
      </div>

      {result.matchResult.matched.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={15} className="text-green-500" />
            <h3 className="font-semibold text-slate-300 text-sm">
              Matched Line Items ({result.matchResult.matched.length})
            </h3>
          </div>
          <div className="space-y-2">
            {result.matchResult.matched.map((item) => (
              <LineItemRow key={item.code} item={item} />
            ))}
          </div>
        </div>
      )}

      {result.matchResult.unmatched.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={15} className="text-yellow-500" />
            <h3 className="font-semibold text-slate-300 text-sm">
              Unmatched — Review Manually ({result.matchResult.unmatched.length})
            </h3>
          </div>
          <div className="space-y-1">
            {result.matchResult.unmatched.map((u, i) => (
              <div key={i} className="flex items-start gap-2 bg-yellow-600/10 border border-yellow-600/20 rounded-lg px-3 py-2">
                <AlertTriangle size={12} className="text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <span className="text-sm font-medium text-yellow-400">{u.label}</span>
                  <span className="text-xs text-yellow-600 ml-2">— {u.reason}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {result.summary && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <FileText size={15} className="text-blue-400" />
            <h3 className="font-semibold text-slate-300 text-sm">Estimate Summary</h3>
          </div>
          <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-3">
            <p className="text-sm text-slate-300 leading-relaxed">{result.summary}</p>
          </div>
        </div>
      )}

      {result.observations && (
        <div>
          <h3 className="font-semibold text-slate-300 text-sm mb-2">Visual Observations</h3>
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
            <p className="text-sm text-slate-400 leading-relaxed">{result.observations}</p>
          </div>
        </div>
      )}

      {(result.materials?.length > 0 || result.damageTypes?.length > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {result.materials?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Materials</p>
              <div className="flex flex-wrap gap-1">
                {result.materials.map((m, i) => (
                  <span key={i} className="text-xs bg-slate-700 border border-slate-600 text-slate-300 px-2 py-0.5 rounded-full">{m}</span>
                ))}
              </div>
            </div>
          )}
          {result.damageTypes?.length > 0 && (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-3">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Damage Types</p>
              <div className="flex flex-wrap gap-1">
                {result.damageTypes.map((d, i) => (
                  <span key={i} className="text-xs bg-slate-700 border border-slate-600 text-slate-300 px-2 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
