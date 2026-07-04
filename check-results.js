// Script to check if we have any stored extraction results
console.log('Checking for previous extraction results...')

// Check localStorage
if (typeof localStorage !== 'undefined') {
  const lastResult = localStorage.getItem('lastExtractionResult')
  const lastParsed = localStorage.getItem('lastParsedData')
  
  console.log('=== LOCALSTORAGE RESULTS ===')
  console.log('Last extraction result found:', !!lastResult)
  console.log('Last parsed data found:', !!lastParsed)
  
  if (lastResult) {
    console.log('\n=== RAW EXTRACTION RESULT ===')
    console.log(lastResult.substring(0, 500) + '...')
    console.log('Full length:', lastResult.length, 'characters')
  }
  
  if (lastParsed) {
    console.log('\n=== PARSED DATA ===')
    try {
      const parsed = JSON.parse(lastParsed)
      console.log('Policy info:', !!parsed.policyInfo)
      console.log('Coverage analysis:', !!parsed.coverageAnalysis)
      console.log('Line items:', !!parsed.lineItems)
      console.log('Financial summary:', !!parsed.financialSummary)
      console.log('Raw text length:', parsed.rawText?.length || 0)
    } catch (e) {
      console.log('Failed to parse stored data:', e.message)
    }
  }
} else {
  console.log('localStorage not available')
}

console.log('\n=== INVESTIGATION COMPLETE ===')
