'use client'

import { useState, useEffect } from 'react'
import { FileText, Loader2, Search, Calendar, Copy, Mail, X, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'

interface Report {
  id: string
  claim_ref: string | null
  address: string | null
  adjuster_name: string | null
  content: string
  type: string
  created_at: string
}

export default function PortalPage() {
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [selectedReport, setSelectedReport] = useState<Report | null>(null)
  
  const [copied, setCopied] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await fetch('/api/reports')
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setReports(data.reports)
      } catch (err: any) {
        setError(err.message || 'Failed to fetch reports')
      } finally {
        setLoading(false)
      }
    }
    fetchReports()
  }, [])

  const filteredReports = reports.filter(r => {
    const term = search.toLowerCase()
    return (
      (r.claim_ref?.toLowerCase() || '').includes(term) ||
      (r.address?.toLowerCase() || '').includes(term) ||
      r.type.toLowerCase().includes(term)
    )
  })

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleEmail = async (report: Report) => {
    setEmailSending(true)
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `${report.type.toUpperCase()}${report.claim_ref ? ` — Claim ${report.claim_ref}` : ''}${report.address ? ` — ${report.address}` : ''}`,
          body: report.content,
          claimRef: report.claim_ref || '',
        }),
      })
      if (!res.ok) throw new Error('Send failed')
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch {
      alert('Email failed to send.')
    } finally {
      setEmailSending(false)
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'field-note': return 'Field Note'
      case 'field-scope': return 'Field Scope'
      case 'reconciliation': return 'Reconciliation'
      default: return type
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'field-note': return 'bg-purple-500/20 text-purple-400 border-purple-500/30'
      case 'field-scope': return 'bg-blue-500/20 text-blue-400 border-blue-500/30'
      case 'reconciliation': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30'
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-blue-400" />
            Reports Portal
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Access and manage all your saved AI-generated claim reports.
          </p>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardContent className="p-5 space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search by claim ref, address, or type..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-red-400 text-center py-6">{error}</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-slate-500 text-center py-12">
              No reports found.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredReports.map(report => (
                <div 
                  key={report.id} 
                  onClick={() => setSelectedReport(report)}
                  className="bg-slate-800 border border-slate-700 rounded-xl p-4 hover:border-slate-500 cursor-pointer transition-colors group"
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-xs px-2 py-1 rounded-md border ${getTypeColor(report.type)}`}>
                      {getTypeLabel(report.type)}
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-slate-500">
                      <Calendar className="w-3 h-3" />
                      {new Date(report.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="space-y-1">
                    <h3 className="text-sm font-semibold text-white truncate">
                      {report.claim_ref ? `Claim ${report.claim_ref}` : 'Unknown Claim'}
                    </h3>
                    {report.address && (
                      <p className="text-xs text-slate-400 truncate">{report.address}</p>
                    )}
                  </div>

                  <p className="text-xs text-slate-500 mt-3 line-clamp-3 leading-relaxed">
                    {report.content.substring(0, 150)}...
                  </p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] bg-slate-900 border-slate-700 flex flex-col shadow-2xl">
            <CardHeader className="flex flex-row items-center justify-between p-4 border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className={`text-xs px-2 py-1 rounded-md border ${getTypeColor(selectedReport.type)}`}>
                  {getTypeLabel(selectedReport.type)}
                </span>
                <CardTitle className="text-white text-base">
                  {selectedReport.claim_ref ? `Claim ${selectedReport.claim_ref}` : 'Report Details'}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => handleCopy(selectedReport.content)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors">
                  {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied!' : 'Copy All'}
                </button>
                <button onClick={() => handleEmail(selectedReport)} disabled={emailSending}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors">
                  {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                  {emailSent ? 'Sent!' : 'Email'}
                </button>
                <button onClick={() => setSelectedReport(null)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-slate-800 transition-colors ml-2">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto">
              <div className="text-slate-200 prose prose-invert prose-sm max-w-none prose-table:text-xs prose-headings:text-emerald-400 prose-p:text-slate-300 prose-li:text-slate-300">
                <ReactMarkdown>{selectedReport.content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
