'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// Root redirect — the real app lives under the (dashboard) route group
export default function RootPage() {
  const router = useRouter()
  useEffect(() => { router.replace('/reconciler') }, [router])
  return null
}
