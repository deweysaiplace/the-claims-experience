#!/usr/bin/env node
// API Diagnostic Script - Check your Gemini API configuration

console.log('🔍 GEMINI API DIAGNOSTIC TOOL')
console.log('==============================\n')

const fs = require('fs')
const path = require('path')

// Check 1: API Key presence
console.log('✅ CHECK 1: API Key Configuration')
console.log('----------------------------------')

const envPath = path.join(__dirname, '.env.local')
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8')
  
  const geminiKey = envContent.match(/GEMINI_API_KEY=(.+)/)
  const nextPublicKey = envContent.match(/NEXT_PUBLIC_GEMINI_KEY=(.+)/)
  
  if (geminiKey) {
    const key = geminiKey[1].trim()
    console.log('GEMINI_API_KEY found:', key.substring(0, 10) + '...' + key.substring(key.length - 5))
    console.log('Key length:', key.length, 'characters')
    console.log('Key format:', key.startsWith('AIza') ? '✅ Valid format' : '⚠️ Unusual format')
  } else {
    console.log('❌ GEMINI_API_KEY not found in .env.local')
  }
  
  if (nextPublicKey) {
    console.log('NEXT_PUBLIC_GEMINI_KEY found')
  }
} else {
  console.log('❌ .env.local file not found')
}

// Check 2: API connectivity test
console.log('\n🔌 CHECK 2: API Connectivity')
console.log('----------------------------')

async function testAPI() {
  try {
    const { getGenAI } = require('./src/lib/gemini')
    const genai = getGenAI()
    
    console.log('✅ Successfully created GenAI client')
    
    // Test with a simple request
    console.log('Testing API with simple request...')
    
    const testResponse = await genai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: 'Hello, this is a test.' }] }]
    })
    
    console.log('✅ API test successful!')
    console.log('Response:', testResponse.candidates?.[0]?.content?.parts?.[0]?.text || 'No text response')
    
  } catch (error) {
    console.log('❌ API test failed:', error.message)
    
    if (error.message.includes('quota')) {
      console.log('\n⚠️ QUOTA ISSUE DETECTED')
      console.log('This confirms the free_tier quota problem.')
      console.log('\n🔧 SOLUTIONS:')
      console.log('1. Verify billing is enabled at https://console.cloud.google.com/billing')
      console.log('2. Check API quotas at https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas')
      console.log('3. Ensure your project has billing attached')
      console.log('4. Consider upgrading to Gemini 1.5 Pro for higher limits')
    }
  }
}

testAPI().then(() => {
  console.log('\n📊 DIAGNOSTIC COMPLETE')
  console.log('=======================')
  console.log('Next steps:')
  console.log('1. If you see quota errors, verify billing at Google Cloud Console')
  console.log('2. Check your project quota settings')
  console.log('3. Try processing videos with 2+ minute delays between uploads')
})
.catch(err => {
  console.log('\n❌ Diagnostic failed:', err.message)
})
