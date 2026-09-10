'use client'

import { useState, useEffect } from 'react'
import {
  CheckSquare,
  Phone,
  Camera,
  Plus,
  Trash2,
  Clock,
  AlertCircle,
  CheckCircle2,
  Filter,
  RefreshCw,
  Sparkles,
  Mail,
  Loader2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import CameraCapture from '@/components/CameraCapture'
import { cn } from '@/lib/utils'

interface AdjusterTask {
  id: string
  title: string
  contact: string
  phone: string
  claimRef: string
  category: 'call' | 'task' | 'voicemail'
  priority: 'urgent' | 'high' | 'normal'
  done: boolean
  createdAt: string
}

const INITIAL_TASKS: AdjusterTask[] = [
  {
    id: 'task_sample_1',
    title: 'Call insured re: schedule ladder assist inspection',
    contact: 'John Smith (Insured)',
    phone: '214-555-0199',
    claimRef: 'Claim #...-0190',
    category: 'call',
    priority: 'urgent',
    done: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task_sample_2',
    title: 'Contractor callback re: agreed test square hail count on south slope',
    contact: 'Apex Roofing (Mike)',
    phone: '469-555-0142',
    claimRef: 'Claim #...-0286',
    category: 'call',
    priority: 'high',
    done: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 'task_sample_3',
    title: 'PA voicemail re: overhead & profit dispute on interior water leak',
    contact: 'David Vance (PA)',
    phone: '817-555-0188',
    claimRef: 'Claim #...-0315',
    category: 'voicemail',
    priority: 'urgent',
    done: false,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: 'task_sample_4',
    title: 'Order EagleView premium report for 2-story complex roof',
    contact: 'EagleView Portal',
    phone: '',
    claimRef: 'Claim #...-0442',
    category: 'task',
    priority: 'normal',
    done: false,
    createdAt: new Date(Date.now() - 14400000).toISOString(),
  },
]

export default function TasksPage() {
  const [tasks, setTasks] = useState<AdjusterTask[]>([])
  const [filter, setFilter] = useState<'pending' | 'calls' | 'urgent' | 'all' | 'done'>('pending')
  const [quickInput, setQuickInput] = useState('')
  const [contactInput, setContactInput] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [claimRefInput, setClaimRefInput] = useState('')
  const [priorityInput, setPriorityInput] = useState<'urgent' | 'high' | 'normal'>('high')
  const [showAddForm, setShowAddForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)

  const handleEmail = async () => {
    if (emailSending || tasks.length === 0) return
    setEmailSending(true)
    const taskBody = `### Adjuster Follow-Up Action Log\nTotal Tasks: ${tasks.length} | Pending: ${pendingCount}\n\n` +
      tasks.map((t, idx) => `${idx + 1}. [${t.done ? 'DONE' : 'PENDING'}] ${t.title} | Priority: ${t.priority.toUpperCase()}${t.contact ? ` | Contact: ${t.contact}` : ''}${t.phone ? ` | Phone: ${t.phone}` : ''}${t.claimRef ? ` | Ref: ${t.claimRef}` : ''}`).join('\n\n')

    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Adjuster Tasks & Voicemails (${pendingCount} Pending)`,
          body: taskBody,
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

  // Load from localStorage or initialize with default sample entries
  useEffect(() => {
    try {
      const saved = localStorage.getItem('doc_tasks_v1')
      if (saved) {
        setTasks(JSON.parse(saved))
      } else {
        setTasks(INITIAL_TASKS)
        localStorage.setItem('doc_tasks_v1', JSON.stringify(INITIAL_TASKS))
      }
    } catch {
      setTasks(INITIAL_TASKS)
    }
  }, [])

  const saveTasks = (newTasks: AdjusterTask[]) => {
    setTasks(newTasks)
    try {
      localStorage.setItem('doc_tasks_v1', JSON.stringify(newTasks))
    } catch (e) {
      console.warn('Failed to save to localStorage', e)
    }
  }

  const handleQuickAdd = () => {
    if (!quickInput.trim()) return

    // Auto extract phone number if present
    const phoneMatch = quickInput.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/)
    const detectedPhone = phoneMatch ? phoneMatch[0] : phoneInput
    const isCall = Boolean(detectedPhone) || quickInput.toLowerCase().includes('call')

    const newTask: AdjusterTask = {
      id: `task_${Date.now()}`,
      title: quickInput.trim(),
      contact: contactInput.trim() || (isCall ? 'Contact' : 'Field Note'),
      phone: detectedPhone,
      claimRef: claimRefInput.trim() || 'Claim Note',
      category: isCall ? 'call' : 'task',
      priority: priorityInput,
      done: false,
      createdAt: new Date().toISOString(),
    }

    saveTasks([newTask, ...tasks])
    setQuickInput('')
    setContactInput('')
    setPhoneInput('')
    setClaimRefInput('')
    setShowAddForm(false)
  }

  const toggleDone = (id: string) => {
    const updated = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
    saveTasks(updated)
  }

  const deleteTask = (id: string) => {
    const updated = tasks.filter((t) => t.id !== id)
    saveTasks(updated)
  }

  const clearCompleted = () => {
    const updated = tasks.filter((t) => !t.done)
    saveTasks(updated)
  }

  // Filter tasks
  const filteredTasks = tasks.filter((t) => {
    if (filter === 'pending') return !t.done
    if (filter === 'calls') return t.category === 'call' || t.category === 'voicemail' || Boolean(t.phone)
    if (filter === 'urgent') return (t.priority === 'urgent' || t.priority === 'high') && !t.done
    if (filter === 'done') return t.done
    return true
  })

  const pendingCount = tasks.filter((t) => !t.done).length
  const urgentCount = tasks.filter((t) => (t.priority === 'urgent' || t.priority === 'high') && !t.done).length
  const callsCount = tasks.filter((t) => (t.category === 'call' || t.category === 'voicemail') && !t.done).length

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16">
      {/* Header Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-indigo-950/70 via-slate-900 to-slate-950 border border-indigo-500/30 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-indigo-600/40 ring-1 ring-indigo-400/40">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Tasks & Voicemail Action Log
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                  {pendingCount} PENDING
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                Fast capture for adjuster follow-ups, contractor callbacks, and voicemail tracking
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleEmail}
              disabled={emailSending || tasks.length === 0}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold transition-all border border-slate-700 active:scale-95 flex items-center gap-1.5 disabled:opacity-50"
              title="Email task list to Dewey's work account"
            >
              {emailSending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                  <span>Sending...</span>
                </>
              ) : emailSent ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Sent!</span>
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 text-indigo-400" />
                  <span>Email to Work</span>
                </>
              )}
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-lg shadow-indigo-700/30 transition-all flex items-center gap-2 active:scale-95"
            >
              <Plus className="w-4 h-4" />
              {showAddForm ? 'Close Form' : 'Add New Task'}
            </button>
            <button
              onClick={clearCompleted}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 text-xs font-semibold transition-all border border-slate-800 active:scale-95"
            >
              Clear Done
            </button>
          </div>
        </div>
      </div>

      {/* Quick Add Bar */}
      <div className="p-3 bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-xl space-y-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleQuickAdd()
            }}
            placeholder="Quick add: e.g. Call John (555-0199) re: ladder assist date..."
            className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button
            onClick={handleQuickAdd}
            className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95"
          >
            + Add
          </button>
        </div>

        {/* Detailed Form (Collapsible) */}
        {showAddForm && (
          <div className="pt-3 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Contact Name</label>
              <input
                type="text"
                value={contactInput}
                onChange={(e) => setContactInput(e.target.value)}
                placeholder="e.g. Mike (Roofer)"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Phone Number</label>
              <input
                type="text"
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="e.g. 555-0199"
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-slate-400 block mb-1">Priority</label>
              <select
                value={priorityInput}
                onChange={(e) => setPriorityInput(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="urgent">Urgent (Red)</option>
                <option value="high">High (Amber)</option>
                <option value="normal">Normal (Slate)</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setFilter('pending')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
            filter === 'pending'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          )}
        >
          <Clock className="w-3.5 h-3.5" />
          Pending ({pendingCount})
        </button>
        <button
          onClick={() => setFilter('urgent')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
            filter === 'urgent'
              ? 'bg-red-600 text-white shadow-md shadow-red-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          )}
        >
          <AlertCircle className="w-3.5 h-3.5" />
          Urgent & High ({urgentCount})
        </button>
        <button
          onClick={() => setFilter('calls')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
            filter === 'calls'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          )}
        >
          <Phone className="w-3.5 h-3.5" />
          Calls & Voicemails ({callsCount})
        </button>
        <button
          onClick={() => setFilter('all')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
            filter === 'all'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          )}
        >
          All Tasks ({tasks.length})
        </button>
        <button
          onClick={() => setFilter('done')}
          className={cn(
            'px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap',
            filter === 'done'
              ? 'bg-teal-600 text-white'
              : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
          )}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          Completed
        </button>
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
          <div className="p-12 text-center bg-slate-900/60 rounded-2xl border border-dashed border-slate-800 text-slate-400">
            <p className="text-sm font-medium">No tasks found in this view.</p>
            <p className="text-xs text-slate-500 mt-1">Type a task above or switch filters.</p>
          </div>
        ) : (
          filteredTasks.map((t) => (
            <div
              key={t.id}
              className={cn(
                'p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 group',
                t.done
                  ? 'bg-slate-950/60 border-slate-800/60 opacity-60'
                  : t.priority === 'urgent'
                  ? 'bg-gradient-to-r from-red-950/30 to-slate-900 border-red-500/30 shadow-md shadow-red-950/20'
                  : t.priority === 'high'
                  ? 'bg-gradient-to-r from-amber-950/30 to-slate-900 border-amber-500/30 shadow-md shadow-amber-950/20'
                  : 'bg-slate-900/80 border-slate-800/80 hover:border-slate-700'
              )}
            >
              <div className="flex items-start gap-3.5 flex-1 min-w-0">
                <input
                  type="checkbox"
                  checked={t.done}
                  onChange={() => toggleDone(t.id)}
                  className="mt-1 w-4 h-4 rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 bg-slate-950 cursor-pointer"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        'text-sm font-semibold text-white break-words',
                        t.done && 'line-through text-slate-500'
                      )}
                    >
                      {t.title}
                    </span>

                    {/* Priority Badge */}
                    {t.priority === 'urgent' && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 border border-red-500/40 uppercase">
                        Urgent
                      </span>
                    )}
                    {t.priority === 'high' && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/40 uppercase">
                        High Priority
                      </span>
                    )}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1.5 flex-wrap">
                    {t.contact && <span className="font-medium text-slate-300">{t.contact}</span>}
                    {t.claimRef && <span className="text-slate-500">{t.claimRef}</span>}

                    {t.phone && (
                      <a
                        href={`tel:${t.phone.replace(/[^0-9]/g, '')}`}
                        className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        {t.phone}
                      </a>
                    )}
                  </div>
                </div>
              </div>

              {/* Delete Button */}
              <button
                onClick={() => deleteTask(t.id)}
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                title="Delete Task"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
