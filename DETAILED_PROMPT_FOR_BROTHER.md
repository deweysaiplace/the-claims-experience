# COMPREHENSIVE PROJECT BRIEF - Insurance Claims Video Processing System

## EXECUTIVE SUMMARY
**Project Name:** The Claims Experience - Video Document Parser  
**Goal:** Build a web application that extracts text from videos of insurance documents (policies, Xactimate estimates) using AI  
**Current Status:** 90% complete, blocked by Gemini API quota issues  
**Urgency:** HIGH - needed for insurance inspection workflow  

---

## 1. PROJECT OVERVIEW

### What We're Building
A Next.js web application that allows insurance adjusters to:
1. Upload video files (MP4, MOV) showing scrolling insurance documents
2. Extract ALL visible text using AI (Gemini/Claude APIs)
3. Organize extracted data into structured format
4. Analyze coverage, line items, and financial summaries
5. Export results for claims processing

### Why This Matters
Current workflow: Manually watching videos and typing notes (2-3 hours per video)  
Target workflow: Upload video, get organized data in 2-3 minutes  

---

## 2. TECHNICAL STACK

### Frontend
- **Framework:** Next.js 16 with App Router
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **UI Components:** shadcn/ui
- **Icons:** Lucide React
- **State:** React hooks (useState, useCallback, useRef)

### Backend APIs
- **Framework:** Next.js API Routes
- **AI Processing:** Google Gemini API (primary), Claude API (fallback)
- **File Storage:** Google Files API (temporary video hosting)
- **Authentication:** JWT tokens (already implemented)

### Database/Storage
- **User Data:** SQLite (already configured)
- **Session Cache:** In-memory Map (for API results)
- **Local Storage:** Browser localStorage (for UI state)

### Dependencies
```json
{
  "@google/genai": "^1.0.0",
  "react-dropzone": "^14.0.0",
  "react-markdown": "^9.0.0",
  "lucide-react": "^0.400.0",
  "@anthropic-ai/sdk": "^0.24.0"
}
```

---

## 3. PROJECT STRUCTURE

### File Locations
```
C:\Users\Dewey\CascadeProjects\the-claims-experience\
├── src/
│   ├── app/
│   │   ├── (dashboard)/
│   │   │   ├── site-walkthroughs/
│   │   │   │   └── page.tsx          # Main upload interface
│   │   │   └── policy-chat/
│   │   │       └── page.tsx          # Chat about extracted policies
│   │   └── api/
│   │       ├── parse-video/
│   │       │   └── route.ts          # Video text extraction API
│   │       ├── upload-video/
│   │       │   └── route.ts          # Video upload handler
│   │       ├── test-new-api/
│   │       │   └── route.ts          # Test endpoint for new API
│   │       ├── parse-video-smart/
│   │       │   └── route.ts          # Smart processing with retries
│   │       └── policy-chat/
│   │           └── route.ts          # Policy analysis chat
│   ├── lib/
│   │   ├── gemini.ts                 # Gemini API client
│   │   └── claude.ts                 # Claude API client
│   └── components/
│       └── ui/                       # shadcn components
├── .env.local                        # API keys (CRITICAL)
├── next.config.js
└── package.json
```

### Current API Keys (from .env.local)
```
GEMINI_API_KEY=AQ.Ab8RN6KM85JHD5sIFHbtjoeiszlIsJgllPySxw0kDIJ7HEypbA
NEXT_PUBLIC_GEMINI_KEY=AIzaSyDgwiWHsDx6Tu7xsCt19Q4duexPPUi4LHE
ANTHROPIC_API_KEY=sk-ant-api03-...
```

---

## 4. CURRENT WORKFLOW

### Step 1: Video Upload
- User drags/drops video file (MP4/MOV, up to 500MB)
- Frontend converts file to base64
- Sends to `/api/upload-video` endpoint
- Server uploads to Google Files API
- Returns file URI for processing

### Step 2: Text Extraction
- Frontend calls `/api/parse-video` with file URI
- Backend tries multiple Gemini models:
  1. gemini-2.5-pro
  2. gemini-2.0-flash
  3. gemini-1.5-pro
  4. gemini-1.5-flash
- AI extracts text from video frames
- Returns structured markdown output

### Step 3: Data Organization
System automatically categorizes into:
- **POLICY INFORMATION** (policy numbers, coverage limits, deductibles)
- **COVERAGE ANALYSIS** (Coverage A-D, perils, exclusions)
- **STRUCTURED LINE ITEMS** (Xactimate codes, descriptions, amounts)
- **FINANCIAL SUMMARY** (subtotals, taxes, O&P, totals)
- **RAW TEXT DUMP** (complete verbatim extraction)

---

## 5. THE PROBLEM (CRITICAL)

### Issue: Gemini API Quota Limits
**Error Message:**
```
{"code":429,"message":"You exceeded your current quota...
* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_input_token_count
* Quota exceeded for metric: generativelanguage.googleapis.com/generate_content_free_tier_requests
Please retry in 59s.","status":"RESOURCE_EXHAUSTED"}
```

### Root Cause Analysis
1. Using free tier Gemini API limits (60 requests/minute, 1,500/day)
2. Video processing requires ~1,000-5,000 tokens per request
3. 3.2MB video = multiple API calls = quota exceeded instantly
4. Multiple API keys attempted but all hitting same quota limits
5. Caching implemented but not preventing initial quota hit

### Attempted Solutions (All Failed)
✅ Tried 4 different Gemini models (all have same quota)  
✅ Implemented retry logic with exponential backoff  
✅ Added result caching (helps on repeats, not first run)  
✅ Created new API endpoint with different auth format  
✅ Model rotation system  

**Still getting quota errors on every video upload.**

---

## 6. REQUIRED SOLUTIONS (In Priority Order)

### SOLUTION 1: Upgrade Gemini API Account (Easiest)
**Action:** Verify billing is enabled on Google Cloud Project
**Steps:**
1. Go to https://console.cloud.google.com/billing
2. Enable billing for project
3. Check quotas at https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
4. Upgrade to paid tier ($20/month typically sufficient)
5. Update API key if needed

**Expected Result:** 10x higher quota limits, should process videos without errors

### SOLUTION 2: Implement Claude API Fallback (Medium)
**Action:** If Gemini fails, automatically try Anthropic Claude API
**Current Status:** Claude API key already in .env.local
**Implementation Needed:**
- Update `/api/parse-video/route.ts` to try Claude if Gemini quota fails
- Claude has different pricing ($3-5 per video typically)
- May have higher rate limits

**Code Location:** `src/app/api/parse-video/route.ts` lines 105-150

### SOLUTION 3: Local OCR Processing (Hardest but Most Reliable)
**Action:** Use Tesseract.js or similar for client-side OCR
**Pros:** No API quotas, no costs, works offline  
**Cons:** Slower, less accurate on complex documents, requires frame extraction  

**Implementation Needed:**
- Extract frames from video using ffmpeg.wasm
- Run OCR on each frame
- Stitch results together
- Much more complex implementation

---

## 7. SUCCESS CRITERIA

The system is **COMPLETE and WORKING** when:

1. ✅ User can upload IMG_0409.MP4 (3.2MB video file)
2. ✅ System processes without "quota exceeded" errors
3. ✅ Returns structured data with all 5 sections populated
4. ✅ Processing time under 3 minutes per video
5. ✅ Results are accurate (text matches what's visible in video)
6. ✅ Can process 7 different videos without hitting limits
7. ✅ Policy Chat feature works with extracted data

---

## 8. TESTING CHECKLIST

### Before Handing Back:
- [ ] Restart dev server: `npm run dev`
- [ ] Navigate to http://localhost:3000/site-walkthroughs
- [ ] Upload test video (IMG_0409.MP4 or similar)
- [ ] Click "Extract All Text & Line Items"
- [ ] Verify no quota errors in browser console
- [ ] Verify data appears in organized sections
- [ ] Check that Policy Information table is populated
- [ ] Verify Line Items table shows Xactimate codes
- [ ] Confirm Financial Summary shows totals
- [ ] Test "Chat About Policy" button works

---

## 9. FILES TO MODIFY

### Critical Files:
1. `src/app/api/parse-video/route.ts` - Main extraction logic
2. `src/lib/gemini.ts` - API client configuration
3. `.env.local` - API keys (may need new key)

### Reference Files:
- `src/app/api/test-new-api/route.ts` - Working test endpoint
- `src/app/api/parse-video-smart/route.ts` - Alternative implementation
- `TROUBLESHOOTING.md` - Diagnostic steps

---

## 10. API ENDPOINTS

### Working Endpoints:
- `POST /api/upload-video` - Uploads video to Google Files
- `POST /api/parse-video` - Extracts text (CURRENTLY BROKEN - quota)
- `POST /api/test-new-api` - Test endpoint with new API format
- `POST /api/parse-video-smart` - Smart processing with retries
- `POST /api/policy-chat` - Chat about extracted policy

### Test Commands:
```bash
# Test new API format
curl -X POST http://localhost:3000/api/test-new-api \
  -H "Content-Type: application/json" \
  -d '{"text":"Explain how AI works"}'

# Check server status
curl http://localhost:3000/api/health
```

---

## 11. KEY TECHNICAL DETAILS

### Gemini API Usage Pattern:
```typescript
// Current (failing with quota):
const genai = new GoogleGenAI({ apiKey })
const response = await genai.models.generateContent({
  model: 'gemini-2.0-flash',
  contents: [{ parts: [{ text: prompt }, { fileData: { fileUri, mimeType } }] }]
})

// New API format (needs testing):
const response = await fetch(
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-goog-api-key': apiKey
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }]
    })
  }
)
```

### Video File Format:
- Input: MP4 or MOV files
- Max size: 500MB (browser limitation)
- Processing: Converted to base64, uploaded to Google Files API
- Gemini reads video frames and extracts text

---

## 12. DELIVERABLES

### What's Already Built:
✅ Next.js application framework  
✅ Video upload interface with drag-and-drop  
✅ Google Files API integration  
✅ Multiple Gemini model support  
✅ Result caching system  
✅ Policy Chat feature  
✅ Data organization/parsing logic  
✅ UI components and styling  
✅ Error handling and retry logic  

### What Needs to Be Fixed:
❌ API quota limits preventing any video processing  
❌ Need working API key or alternative processing method  
❌ Verify end-to-end workflow functions correctly  

---

## 13. TIMELINE

**URGENT:** This system is needed for active insurance inspections  
**Target:** Working system within 24 hours  
**Budget:** $50-100 for API costs acceptable  
**Backup Plan:** If APIs fail, implement local OCR (2-3 days work)  

---

## 14. CONTACT & CONTEXT

**End User:** Dewey (insurance adjuster)  
**Current Location:** C:\Users\Dewey\CascadeProjects\the-claims-experience  
**Test Video:** IMG_0409.MP4 (3.2MB) located on desktop  
**Other Videos:** 7 total videos need processing for inspection reports  

**Success looks like:** Upload video → 2-3 minutes → Organized policy data ready for claims analysis

---

## 15. FINAL INSTRUCTIONS TO BROTHER

**Your Task:**
1. Read all files in `src/app/api/` to understand current implementation
2. Diagnose why quota errors persist with new API key
3. Implement Solution 1 (billing) OR Solution 2 (Claude fallback)
4. Test with IMG_0409.MP4 until it works without errors
5. Verify all 5 data sections are populated
6. Document what fixed it
7. Hand back working system

**Do NOT:**
- Rewrite the entire application (it's 90% done)
- Change the UI/UX (it's already polished)
- Remove existing functionality
- Skip testing (must verify with actual video)

**DO:**
- Focus ONLY on fixing the API quota issue
- Keep all existing code that works
- Test thoroughly before declaring success
- Document the solution for future reference

---

## QUESTIONS?

If anything is unclear, ask before implementing. This system needs to work reliably for insurance inspections. No partial solutions - it must process videos end-to-end without quota errors.

**GOAL: Upload video → AI extraction → Organized data → Ready for claims analysis**

---

*Document Created: June 11, 2024*  
*Status: URGENT - Blocking Insurance Workflows*  
*Priority: CRITICAL*
