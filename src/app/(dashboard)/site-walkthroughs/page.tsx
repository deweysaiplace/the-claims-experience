'use client'

import { useState, useCallback, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import { Video, Upload, Loader2, Copy, Mail, Check, FileVideo, X, MonitorPlay, Smartphone, Info, MessageCircle, Link, Bug } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ReactMarkdown from 'react-markdown'
import { useRouter } from 'next/navigation'

type UploadStage = 'idle' | 'uploading' | 'processing' | 'done' | 'error'

const DOC_TYPES = [
  { value: 'state_farm_policy', label: 'State Farm Policy / Estimate' },
  { value: 'xactimate_estimate', label: 'Xactimate Estimate (line items)' },
  { value: 'contractor_estimate', label: "Contractor's Estimate" },
  { value: 'inspection_walkthrough', label: 'Property Inspection Walkthrough' },
  { value: 'other', label: 'Other Document' },
]

export default function SiteWalkthroughsPage() {
  const router = useRouter()
  const [video, setVideo] = useState<File | null>(null)
  const [driveUrl, setDriveUrl] = useState('')
  const [claimRef, setClaimRef] = useState('')
  const [address, setAddress] = useState('')
  const [docType, setDocType] = useState('state_farm_policy')
  const [stage, setStage] = useState<UploadStage>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [result, setResult] = useState('')
  const [parsedData, setParsedData] = useState<any>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [sortBy, setSortBy] = useState<'category' | 'code' | 'total'>('category')
  const [retryMessage, setRetryMessage] = useState('')
  const xhrRef = useRef<XMLHttpRequest | null>(null)

  // Parse and organize extracted data
  const parseExtractedData = (text: string) => {
    const sections: any = {
      policyInfo: null,
      coverageAnalysis: null,
      lineItems: [],
      financialSummary: null,
      rawText: ''
    }

    // Parse policy information
    const policyMatch = text.match(/## POLICY INFORMATION[\s\S]*?(?=##|$)/)
    if (policyMatch) {
      sections.policyInfo = policyMatch[0]
    }

    // Parse coverage analysis
    const coverageMatch = text.match(/## COVERAGE ANALYSIS[\s\S]*?(?=##|$)/)
    if (coverageMatch) {
      sections.coverageAnalysis = coverageMatch[0]
    }

    // Parse line items
    const lineItemsMatch = text.match(/## STRUCTURED LINE ITEMS[\s\S]*?(?=##|$)/)
    if (lineItemsMatch) {
      sections.lineItems = lineItemsMatch[0]
    }

    // Parse financial summary
    const financialMatch = text.match(/## FINANCIAL SUMMARY[\s\S]*?(?=##|$)/)
    if (financialMatch) {
      sections.financialSummary = financialMatch[0]
    }

    // Parse raw text
    const rawTextMatch = text.match(/## RAW TEXT DUMP[\s\S]*/)
    if (rawTextMatch) {
      sections.rawText = rawTextMatch[0]
    }

    return sections
  }

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) {
      setVideo(accepted[0])
      setResult('')
      setError('')
      setRetryMessage('')
      setStage('idle')
      setUploadProgress(0)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/mp4': ['.mp4'],
      'video/quicktime': ['.mov'],
      'video/x-msvideo': ['.avi'],
      'video/webm': ['.webm'],
      'audio/mp4': ['.m4a'],
      'audio/mpeg': ['.mp3'],
    },
    maxFiles: 1,
  })

  const uploadToFilesApi = async (file: File): Promise<{ fileUri: string; mimeType: string }> => {
    // Convert file to base64 to bypass FormData parsing issues
    const fileBase64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.split(',')[1] // Remove data URL prefix
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    console.log('Starting upload:', { fileName: file.name, fileSize: file.size, fileType: file.type })

    const xhr = new XMLHttpRequest()
    xhrRef.current = xhr

    return new Promise((resolve, reject) => {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      }

      xhr.onload = () => {
        console.log('Upload response status:', xhr.status)
        console.log('Upload response:', xhr.responseText)
        
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText)
            if (data.success) {
              resolve({ fileUri: data.fileUri, mimeType: data.mimeType })
            } else {
              reject(new Error(data.error || 'Upload failed'))
            }
          } catch {
            reject(new Error('Failed to parse upload response'))
          }
        } else {
          try {
            const errorData = JSON.parse(xhr.responseText)
            reject(new Error(`Upload failed: ${errorData.error || xhr.statusText}`))
          } catch {
            reject(new Error(`Upload failed: ${xhr.status} ${xhr.statusText}`))
          }
        }
      }

      xhr.onerror = () => {
        console.error('Upload network error')
        reject(new Error('Upload network error'))
      }
      xhr.onabort = () => {
        console.error('Upload cancelled')
        reject(new Error('Upload cancelled'))
      }

      // Send as JSON with base64 encoded file
      xhr.open('POST', '/api/upload-video')
      xhr.setRequestHeader('Content-Type', 'application/json')
      xhr.send(JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileBase64
      }))
    })
  }

  const fetchFromDrive = async (url: string): Promise<File> => {
  // Convert Google Drive share URL to direct download URL
  const fileId = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/id=([a-zA-Z0-9_-]+)/)?.[1]
  if (!fileId) throw new Error('Invalid Google Drive URL format')
  
  // Try multiple URL formats for Google Drive
  const urls = [
    `https://drive.google.com/uc?export=download&id=${fileId}`,
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`,
    `https://drive.google.com/open?id=${fileId}`
  ]
  
  let response: Response | null = null
  let lastError: string = ''
  
  for (const downloadUrl of urls) {
    try {
      response = await fetch(downloadUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })
      
      if (response.ok) {
        break
      } else {
        lastError = `Status ${response.status}: ${response.statusText}`
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error'
      continue
    }
  }
  
  if (!response || !response.ok) {
    throw new Error(`Failed to fetch from Google Drive. Last error: ${lastError}`)
  }
  
  const blob = await response.blob()
  if (blob.size === 0) {
    throw new Error('Downloaded file is empty')
  }
  
  const filename = `drive-video-${fileId}.mp4`
  return new File([blob], filename, { type: blob.type || 'video/mp4' })
}

const extractVideoFrames = async (file: File, fps: number = 0.5): Promise<{ base64: string; mimeType: string }[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.muted = true
    video.playsInline = true
    video.src = URL.createObjectURL(file)

    video.onloadedmetadata = () => {
      const duration = video.duration
      const frames: { base64: string; mimeType: string }[] = []
      const interval = 1 / fps // interval in seconds
      
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Canvas context not available'))
        return
      }

      // Resize frame to max width 1280 to keep sizes low but high enough for OCR
      let w = video.videoWidth
      let h = video.videoHeight
      const maxW = 1280
      if (w > maxW) {
        h = (h * maxW) / w
        w = maxW
      }
      canvas.width = w
      canvas.height = h

      let currentTime = 0

      const seekAndCapture = async () => {
        if (currentTime >= duration) {
          URL.revokeObjectURL(video.src)
          resolve(frames.slice(0, 20)) // Claude supports max 20 images
          return
        }
        video.currentTime = currentTime
      }

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const base64 = canvas.toDataURL('image/jpeg', 0.8).split(',')[1]
        frames.push({ base64, mimeType: 'image/jpeg' })
        
        currentTime += interval
        seekAndCapture()
      }

      seekAndCapture()
    }

    video.onerror = (e) => {
      reject(new Error('Failed to load video metadata'))
    }
  })
}

const handleProcess = async () => {
  let videoFile = video
  
  // If no local video but we have a Drive URL, fetch it
  if (!videoFile && driveUrl.trim()) {
    try {
      setError('')
      setResult('')
      setStage('uploading')
      setUploadProgress(0)
      
      videoFile = await fetchFromDrive(driveUrl.trim())
      setVideo(videoFile) // Store it for potential re-use
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch from Google Drive'
      setError(`${errorMessage}\n\nTip: Try downloading the video from Google Drive and uploading it directly, or make sure the link is shared as "Anyone with the link can view".`)
      setStage('error')
      return
    }
  }
  
  if (!videoFile) return
  
  setError('')
  setResult('')
  setStage('uploading')
  setUploadProgress(0)

  try {
    // Upload to Google Files API directly from browser
    const { fileUri, mimeType } = await uploadToFilesApi(videoFile)

    // Now call our server-side Gemini analysis route
    setStage('processing')
    setRetryMessage('Starting video analysis...')
    
    const res = await fetch('/api/parse-video', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileUri, mimeType, claimRef, address, docType }),
    })

    const data = await res.json()
    if (!res.ok) {
      // Check if it's a quota error
      const isQuotaError = data.error?.includes('quota') || data.error?.includes('RESOURCE_EXHAUSTED')
      if (isQuotaError) {
        setRetryMessage('Gemini quota limit hit. Extracting video frames locally for Claude fallback...')
        try {
          const frames = await extractVideoFrames(videoFile)
          setRetryMessage(`Analyzing ${frames.length} frames with Anthropic Claude...`)
          
          const claudeRes = await fetch('/api/parse-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ claimRef, address, docType, frames, useClaude: true }),
          })
          
          const claudeData = await claudeRes.json()
          if (!claudeRes.ok) throw new Error(claudeData.error || 'Claude analysis failed')
          
          setResult(claudeData.result)
          const parsed = parseExtractedData(claudeData.result)
          setParsedData(parsed)
          setStage('done')
          setRetryMessage('')
          return
        } catch (claudeErr: any) {
          throw new Error(`Claude fallback failed: ${claudeErr.message || claudeErr}`)
        }
      }
      throw new Error(data.error)
    }

    setResult(data.result)
    const parsed = parseExtractedData(data.result)
    setParsedData(parsed)
    setStage('done')
    setRetryMessage('')
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : 'Processing failed')
    setStage('error')
  }
}

  const handleCancel = () => {
    xhrRef.current?.abort()
    setStage('idle')
    setUploadProgress(0)
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(result)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDebug = () => {
    console.log('Raw result:', result)
    console.log('Parsed data:', parsedData)
    console.log('Stage:', stage)
    // Also save to localStorage for debugging
    localStorage.setItem('lastExtractionResult', result)
    localStorage.setItem('lastParsedData', JSON.stringify(parsedData))
    alert('Debug data saved to console and localStorage. Check browser console (F12).')
  }

  const handleEmail = async () => {
    setEmailSending(true)
    try {
      const res = await fetch('/api/send-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: `Video Document Parse${claimRef ? ` — Claim ${claimRef}` : ''}${address ? ` — ${address}` : ''}`,
          body: result,
          claimRef,
        }),
      })
      if (!res.ok) throw new Error('Send failed')
      setEmailSent(true)
      setTimeout(() => setEmailSent(false), 3000)
    } catch {
      setError('Email failed — check SMTP settings in .env.local')
    } finally {
      setEmailSending(false)
    }
  }

  const handleChatAboutPolicy = () => {
    // Save the extracted text to localStorage for the Policy Chat page to pick up
    localStorage.setItem('claims_policy_text', result)
    router.push('/policy-chat')
  }

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Video className="w-6 h-6 text-blue-400" />
          Video Document Parser
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Record your screen or phone video of any scrolling document — Gemini extracts every line item and all visible text
        </p>
      </div>

      {/* Tips */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4 flex gap-3">
            <MonitorPlay className="w-8 h-8 text-green-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-medium text-sm">Best: Screen Recording</div>
              <div className="text-slate-400 text-xs mt-0.5">
                Press <kbd className="bg-slate-800 px-1.5 py-0.5 rounded text-slate-300 font-mono">Win + G</kbd> → Record as you scroll through the policy or estimate. Crisp text, no glare.
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900 border-slate-700">
          <CardContent className="p-4 flex gap-3">
            <Smartphone className="w-8 h-8 text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-white font-medium text-sm">Also works: Phone video</div>
              <div className="text-slate-400 text-xs mt-0.5">
                Record your screen with your phone. Transfer via USB or cloud. Gemini handles glare and angle corrections well.
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Controls */}
        <div className="lg:col-span-2 space-y-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Document Type</label>
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  {DOC_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Claim Ref (last 4)</label>
                <input
                  type="text"
                  value={claimRef}
                  onChange={(e) => setClaimRef(e.target.value)}
                  placeholder="e.g. 7842"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Property Address</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 412 Maple St"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-1.5">Google Drive URL (optional)</label>
                <input
                  type="url"
                  value={driveUrl}
                  onChange={(e) => setDriveUrl(e.target.value)}
                  placeholder="https://drive.google.com/file/d/..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
                {driveUrl && (
                  <p className="text-xs text-slate-500 mt-1">
                    Share as "Anyone with the link can view"
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Drop zone */}
          {video ? (
            <Card className="bg-slate-900 border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <FileVideo className="w-8 h-8 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="text-white text-sm font-medium truncate">{video.name}</div>
                    <div className="text-slate-500 text-xs mt-0.5">{formatBytes(video.size)} · {video.type}</div>
                  </div>
                  {stage === 'idle' && (
                    <button onClick={() => { setVideo(null); setStage('idle') }} className="text-slate-600 hover:text-red-400">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Progress bar */}
                {(stage === 'uploading' || stage === 'processing') && (
                  <div className="mt-4 space-y-2">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>{stage === 'uploading' ? `Uploading… ${uploadProgress}%` : 'Gemini is reading the video…'}</span>
                      {stage === 'uploading' && (
                        <button onClick={handleCancel} className="text-red-400 hover:text-red-300">Cancel</button>
                      )}
                    </div>
                    <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${stage === 'processing' ? 'bg-purple-500 animate-pulse w-full' : 'bg-blue-500'}`}
                        style={{ width: stage === 'uploading' ? `${uploadProgress}%` : '100%' }}
                      />
                    </div>
                    {stage === 'processing' && (
                      <p className="text-xs text-slate-500">This may take 1–3 minutes depending on video length…</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
                ${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-slate-700 hover:border-slate-500 bg-slate-900'}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-10 h-10 text-slate-600 mb-3 mx-auto" />
              <p className="text-slate-400 text-sm font-medium">Drop video here or paste Google Drive URL</p>
              <p className="text-slate-600 text-xs mt-1">MP4 · MOV · AVI · WebM · M4A · up to 2GB</p>
            </div>
          )}

          {error && (
            <div className="bg-red-950/30 border border-red-800/40 rounded-xl p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={handleProcess}
            disabled={(!video && !driveUrl.trim()) || stage === 'uploading' || stage === 'processing'}
            className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-colors"
          >
            {stage === 'uploading' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Uploading {uploadProgress}%…</>
            ) : stage === 'processing' ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Gemini reading video…</>
            ) : (
              <><Video className="w-4 h-4" /> Extract All Text & Line Items</>
            )}
          </button>

          {/* Debug button for accessing previous results */}
          {(result || parsedData) && (
            <button
              onClick={handleDebug}
              className="w-full py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium flex items-center justify-center gap-2 transition-colors"
            >
              <Bug className="w-4 h-4" /> Debug Previous Results
            </button>
          )}

          <div className="flex items-start gap-2 text-slate-600 text-xs">
            <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>Video uploads go directly to Google Files API from your browser. Your Gemini API key is used client-side for this step only.</span>
          </div>
        </div>

        {/* Right: Results */}
        <div className="lg:col-span-3">
          {result ? (
            <Card className="bg-slate-900 border-slate-800 h-full">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-white text-base">Extracted Content</CardTitle>
                    <Badge variant="outline" className="text-green-400 border-green-600/30 bg-green-600/10 text-xs">Complete</Badge>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCopy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied!' : 'Copy All'}
                    </button>
                    <button
                      onClick={handleChatAboutPolicy}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-medium transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      Chat About Policy
                    </button>
                    <button
                      onClick={handleEmail}
                      disabled={emailSending}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium transition-colors"
                    >
                      {emailSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : emailSent ? <Check className="w-3.5 h-3.5" /> : <Mail className="w-3.5 h-3.5" />}
                      {emailSent ? 'Sent!' : 'Email Report'}
                    </button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 max-h-[70vh] overflow-y-auto">
                <div className="prose prose-invert prose-sm max-w-none prose-table:text-xs prose-headings:text-slate-200 prose-p:text-slate-300 prose-li:text-slate-300 prose-code:text-blue-300">
                  <ReactMarkdown>{result}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-80 text-slate-700">
              <Video className="w-20 h-20 mb-4 opacity-20" />
              <p className="text-sm">Extracted line items and text will appear here</p>
              <p className="text-xs mt-1 text-slate-800">Supports policies, Xactimate estimates, contractor bids</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
