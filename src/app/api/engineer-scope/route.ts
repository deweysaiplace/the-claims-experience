import { NextRequest, NextResponse } from 'next/server'
import { generateWithFallback } from '@/lib/ai-fallback'
import { scrubPii } from '@/utils/sanitizer'

export const maxDuration = 120

async function filesToBase64(files: File[]) {
  const images = files.filter(
    (f) => f.type.startsWith('image/') || /\.(jpe?g|png|webp|gif|bmp|heic)$/i.test(f.name)
  )
  const pdfs = files.filter(
    (f) => (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) && !images.includes(f)
  )
  const [base64Images, base64Pdfs] = await Promise.all([
    Promise.all(images.map(async (f) => Buffer.from(await f.arrayBuffer()).toString('base64'))),
    Promise.all(pdfs.map(async (f) => Buffer.from(await f.arrayBuffer()).toString('base64'))),
  ])
  return { base64Images, base64Pdfs }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()

    // Support both 'report' and 'files' form fields
    const files = (formData.getAll('report') as File[]).concat(
      formData.getAll('files') as File[]
    )
    const claimRef = (formData.get('claimRef') as string) || ''
    const address = (formData.get('address') as string) || ''

    if (files.length === 0) {
      return NextResponse.json({ error: 'No engineering report files provided.' }, { status: 400 })
    }

    const scrubRef = scrubPii(claimRef)
    const scrubAddr = scrubPii(address)
    const today = new Date().toISOString().split('T')[0]

    const { base64Images, base64Pdfs } = await filesToBase64(files)

    const systemPrompt = `You are a Senior Forensic Structural Engineering Specialist and Property Insurance Coverage Auditor with over 25 years of experience evaluating structural damage, Haag Engineering standards, State Farm Policy (HW2130), and Xactimate structural scoping rules.

Date of Review: ${today}
Claim Reference: ${scrubRef || 'Pending'}
Property Address: ${scrubAddr || 'Inspected Property'}

CORE OBJECTIVE:
Conduct an exhaustive, forensic-grade engineering audit of the provided Expert Engineer's Report. You must cross-examine the engineer's technical findings, isolate covered storm damage from pre-existing or excluded conditions, provide specific page/photo evidence citations, and generate a comprehensive structural Xactimate estimate scope with precise line items, quantities, and F9 justification notes.

CRITICAL INSTRUCTIONS & METHODOLOGY:
1. DETAILED FORENSIC CAUSATION BREAKDOWN:
   - Identify the primary engineering firm, report author/PE license #, and inspection date.
   - Analyze the precise structural failure mechanisms: lateral shear, uplift, bending moment deflection, impact puncture, or foundation settlement.
   - Rigorously differentiate Accidental Direct Physical Loss (covered storm peril, wind uplift, tree/limb impact, sudden structural fracture) from Excluded Perils (chronic attic humidity, fungal rot/decay, deferred maintenance, foundation settlement/soil heave, thermal expansion/contraction).
   - Cite EXACT report page numbers, photo labels, and measurement figures (e.g. [Page 4, Photo 7], [Table 2, Elevation Survey]).

2. STATE FARM POLICY & COVERAGE ALIGNMENT (HW2130 & CLAIM MANUAL):
   - Coverage A Dwelling: Clearly define all covered direct physical loss framing repairs.
   - Losses Not Insured (Exclusions): Identify any wear and tear, dry rot, mold, or earth movement excluded by policy.
   - Ensuing Loss Analysis: If pre-existing rot or settlement is present, determine if a covered storm opening caused distinct, ensuing framing failure that must be covered.
   - Ordinance or Law / Code Compliance: Note if the structural repairs trigger mandatory building code upgrades (e.g. IRC hurricane clips, continuous load paths, or engineered truss bracing).

3. COMPREHENSIVE STRUCTURAL XACTIMATE CATALOG:
   Utilize industry-standard Xactimate codes with realistic quantities and detailed F9 contractor/audit notes:
   - ROOF SHEATHING / DECKING:
     • RFG PLY (Roof sheathing - 7/16" OSB - SQ)
     • RFG PLY5 (Roof sheathing - 1/2" CDX plywood - SQ)
     • RFG PLY5/8 (Roof sheathing - 5/8" CDX plywood - SQ)
     • RFG DECB (Roof decking - 1"x6" board / skip sheathing - SQ)
     • STR SHTH (Wall sheathing - OSB/plywood - SF)
   - FRAMING, TRUSSES & RAFTERS:
     • STR RFT (Rafter - replace - LF)
     • STR RFTR (Rafter - sister / repair - LF)
     • STR TRUSS (Pre-engineered truss - replace - EA)
     • STR TRUSSR (Truss repair / chord sistering with engineered gusset plates - EA)
     • STR PURL (Purlin brace / web support - LF)
     • STR CLR (Collar tie installation - LF)
     • STR FRM (Wall framing - 2x4 - LF)
     • STR FRM6 (Wall framing - 2x6 - LF)
     • STR POST (Structural post - 4x4 / 6x6 - LF)
     • STR BEAM (Engineered glulam / LVL structural header or ridge beam - LF)
     • STR JST (Floor / ceiling joist - replace - LF)
     • STR JSTR (Floor / ceiling joist - sister / repair - LF)
   - TEMPORARY SHORING & SELECTIVE DEMO:
     • STR SHOR (Temporary structural shoring tower / support beam - LF/EA)
     • GEN DEMO (Selective demolition of damaged framing - HR)
     • GEN LABOR (General labor for structural access & debris - HR)
     • SPC DMPST (Dumpster / debris haul - EA)
   - CONSEQUENTIAL INTERIOR RESTORATION:
     • DRY 1/2 or DRY 5/8 (Drywall removal & replacement beneath framing repairs - SF)
     • INS B13 or INS B19 (Batt insulation disturbed during structural access - SF)
     • PNT P2 (Seal & paint 2 coats - SF)
   - FEES & PROFESSIONAL SERVICES:
     • FEE PERMIT (Municipal building permit fee)
     • FEE ENGR (Structural engineering site re-inspection / certification fee)

4. PUBLIC ADJUSTER & CONTRACTOR DISPUTE REBUTTAL STRATEGY:
   - Anticipate contractor/PA supplemental arguments (e.g. arguing that localized 1/2" deflection mandates a 100% total roof framing teardown).
   - Arm the adjuster with specific engineering counter-arguments grounded in the PE report findings.

5. ZERO PII RULE:
   - Never print the policyholder's actual proper name. Refer to them as "the insured" or "the homeowner".`

    const userPrompt = `Please perform an in-depth, forensic-grade engineering audit of this structural report.
Review all engineering findings across all uploaded pages, separate covered storm damage from pre-existing wear/rot, and build a complete Xactimate structural scope.

You MUST wrap your output in these EXACT structural tags:

<summary_data>
ENGINEER_FIRM: [Name of engineering firm and PE if noted]
REPORT_DATE: [Date of inspection and report]
PRIMARY_FINDINGS: [Comprehensive executive summary of structural damage, deflected framing, sheathing, and causation]
</summary_data>

<policy_alignment>
### 1. Forensic Engineering Causation Analysis
- **Causation Mechanics**: [Detailed explanation of how the damage occurred — wind uplift, impact, shear, decay, or settlement]
- **Specific Evidence Citations**: [Cite exact report pages, photo numbers, and test readings]

### 2. State Farm Policy & Coverage Determination (HW2130)
- **Covered Structural Damage (Coverage A)**: [Itemize all covered structural elements resulting from covered peril]
- **Excluded Conditions & Prior Wear**: [Detail any pre-existing rot, thermal checking, deferred maintenance, or foundation settlement]
- **Code Upgrades & Ensuing Loss**: [Assess building code requirements, IRC compliance, and ensuing damage]

### 3. Contractor / Public Adjuster Rebuttal Strategy
- **Anticipated Dispute**: [What excessive supplement or total replacement might the contractor demand?]
- **Defensible Rebuttal**: [Clear engineering rebuttal grounded in the engineer's structural findings]
</policy_alignment>

<xactimate_scope>
### Recommended Structural Xactimate Scope
| Cat | Sel | Act | Description | Qty | Unit | F9 Justification & Engineer Report Citation |
|:---|:---|:---:|:---|:---:|:---:|:---|
[List all necessary structural, framing, sheathing, shoring, insulation, drywall, and permit line items with realistic quantities and exact report citations]

**Quick Entry Bar Batch**:
\`\`\`
[Xactimate quick entry string, e.g. STR SHOR + 1; STR RFTR + 24; RFG PLY + 2; ...]
\`\`\`
</xactimate_scope>

<file_note>
### Formal Adjuster Claim System File Note
**Date of Review**: ${today}
**Claim Reference**: ${scrubRef || 'Pending'}
**Engineering Firm**: [Firm Name] | **Inspection Date**: [Date]
**Coverage Determination**: [Partially Covered / Fully Covered / Excluded]
**Summary of Forensic Review**:
[Comprehensive, professional claim file note ready to paste into carrier claim management software summarizing covered scope vs exclusions and total structural allowances.]
</file_note>`

    console.log(`Processing forensic engineering report (${files.length} pages/files)...`)
    const response = await generateWithFallback(userPrompt, systemPrompt, base64Images, base64Pdfs)

    console.log(`Forensic engineering audit succeeded via ${response.provider}!`)
    return NextResponse.json({
      success: true,
      result: response.text,
      provider: response.provider,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('Forensic engineer scope failed:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
