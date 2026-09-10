// DEPRECATED 8/18 -- this served the stale, 2-month-old EXTRACTED_POLICY/
// EXTRACTED_GUIDELINES table-of-contents stub as the "master policy," which
// is what Policy Chat was silently answering off of instead of the real
// transcribed HW2130 text (see src/data/source-docs/_RESUME.md). Superseded
// by server-side per-question retrieval in policy-chat/route.ts via
// getPolicyDocsText(). No longer called from anywhere.
//
// The leading underscore on this folder opts it out of Next.js App Router
// routing entirely (Next treats `_folderName` as a private, non-routable
// folder), so this is inert even though the file is still on disk. Kept
// here rather than deleted per Jason's request on 8/18 -- see the task to
// review/delete this folder once the rewire has been trusted for a while.
import { NextResponse } from 'next/server'
import { EXTRACTED_POLICY } from '@/data/extracted-policy'
import { EXTRACTED_GUIDELINES } from '@/data/extracted-guidelines'

export async function GET() {
  try {
    const policyText = EXTRACTED_POLICY || ''
    const guidelinesText = EXTRACTED_GUIDELINES || ''
    
    return NextResponse.json({
      success: true,
      policyText,
      guidelinesText,
      combinedText: `${policyText}\n\n=========================================\n\n${guidelinesText}`
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
