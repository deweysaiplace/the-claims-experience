// Data monitoring script - checks if video processing data is flowing
console.log('🔍 DATA MONITORING - Checking video processing flow')
console.log('=====================================================\n')

// Check 1: Browser localStorage for stored results
console.log('📦 CHECK 1: Browser LocalStorage')
console.log('---------------------------------')
if (typeof localStorage !== 'undefined') {
  const lastResult = localStorage.getItem('lastExtractionResult')
  const lastParsed = localStorage.getItem('lastParsedData')
  const lastVideo = localStorage.getItem('lastProcessedVideo')
  
  console.log('✅ localStorage accessible')
  console.log('Last result exists:', !!lastResult)
  console.log('Last parsed data exists:', !!lastParsed)
  console.log('Last video info exists:', !!lastVideo)
  
  if (lastResult) {
    console.log('📄 Last result length:', lastResult.length, 'characters')
    console.log('📄 Preview:', lastResult.substring(0, 200) + '...')
  }
  
  if (lastParsed) {
    try {
      const parsed = JSON.parse(lastParsed)
      console.log('📊 Parsed sections:')
      console.log('  - Policy info:', !!parsed.policyInfo)
      console.log('  - Coverage analysis:', !!parsed.coverageAnalysis)
      console.log('  - Line items:', !!parsed.lineItems)
      console.log('  - Financial summary:', !!parsed.financialSummary)
    } catch (e) {
      console.log('❌ Failed to parse stored data')
    }
  }
} else {
  console.log('❌ localStorage not available')
}

// Check 2: Session state
console.log('\n💾 CHECK 2: Session State')
console.log('-------------------------')
console.log('Current page:', window.location.href)
console.log('Document ready:', document.readyState)
console.log('Page load time:', performance.now().toFixed(2), 'ms')

// Check 3: API endpoint status
console.log('\n🔌 CHECK 3: API Endpoints')
console.log('--------------------------')

const endpoints = [
  '/api/parse-video',
  '/api/upload-video',
  '/api/policy-chat'
]

endpoints.forEach(async (endpoint) => {
  try {
    const start = performance.now()
    const response = await fetch(endpoint, { method: 'HEAD' })
    const duration = (performance.now() - start).toFixed(2)
    console.log(`✅ ${endpoint}: ${response.status} (${duration}ms)`)
  } catch (error) {
    console.log(`❌ ${endpoint}: Not accessible`)
  }
})

console.log('\n🎯 MONITORING COMPLETE')
console.log('========================')
console.log('If you see ✅ above, data flow is working!')
console.log('If you see ❌, there may be connection issues.')
