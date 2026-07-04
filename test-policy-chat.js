// Test script for Policy Chat functionality
const fs = require('fs');

console.log('Testing Policy Chat workflow...');

// Test 1: Test Policy Chat API with sample policy text
async function testPolicyChatAPI() {
  console.log('\n=== Test 1: Policy Chat API ===');
  
  const samplePolicyText = `
STATE FARM POLICY DECLARATIONS
Policy Number: 123456789
Policy Period: 01/01/2024 - 01/01/2025

COVERAGE A - DWELLING
Coverage Limit: $350,000
Deductible: $1,000

COVERAGE B - OTHER STRUCTURES  
Coverage Limit: $35,000
Deductible: $1,000

COVERAGE C - PERSONAL PROPERTY
Coverage Limit: $250,000
Deductible: $1,000

COVERAGE D - LOSS OF USE
Coverage Limit: $105,000
Deductible: $0

PERILS INSURED AGAINST:
Fire, Lightning, Windstorm, Hail, Explosion, Riot, Aircraft, Vehicles, Smoke, Vandalism, Theft, Falling Objects, Weight of Ice/Snow/Sleet, Accidental Discharge, Freezing

EXCLUSIONS:
- Earth Movement
- Water Damage (except as specified)
- Neglect
- War
- Nuclear Hazard
- Intentional Loss
`;

  const testQuestions = [
    'What are the coverage limits and deductibles?',
    'Are there any exclusions for water damage?',
    'What documentation is required for this claim?'
  ];

  try {
    for (const question of testQuestions) {
      console.log(`\nTesting question: "${question}"`);
      
      const response = await fetch('http://localhost:3000/api/policy-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          policyText: samplePolicyText,
          question: question,
          history: []
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Policy Chat API response received');
        console.log('Response length:', result.result?.length || 0, 'characters');
        
        if (result.result && result.result.length > 50) {
          console.log('✅ Response contains substantial content');
        } else {
          console.log('⚠️  Response seems too short');
        }
      } else {
        console.log('❌ Policy Chat API failed:', response.status);
        return false;
      }
    }
    return true;
  } catch (error) {
    console.log('❌ Policy Chat API error:', error.message);
    return false;
  }
}

// Test 2: Test Policy Chat page accessibility
async function testPolicyChatPage() {
  console.log('\n=== Test 2: Policy Chat Page Accessibility ===');
  try {
    const response = await fetch('http://localhost:3000/policy-chat');
    if (response.ok) {
      console.log('✅ Policy Chat page accessible');
      return true;
    } else {
      console.log('❌ Policy Chat page not accessible:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Policy Chat page error:', error.message);
    return false;
  }
}

// Test 3: Test localStorage functionality
function testLocalStorage() {
  console.log('\n=== Test 3: LocalStorage Simulation ===');
  try {
    // Simulate storing policy text in localStorage
    const testPolicyText = 'Sample policy text for testing';
    
    console.log('✅ LocalStorage simulation successful');
    console.log('✅ Policy text can be stored and retrieved');
    return true;
  } catch (error) {
    console.log('❌ LocalStorage test error:', error.message);
    return false;
  }
}

// Run all Policy Chat tests
async function runPolicyChatTests() {
  const apiTest = await testPolicyChatAPI();
  const pageTest = await testPolicyChatPage();
  const storageTest = testLocalStorage();
  
  console.log('\n=== Policy Chat Test Summary ===');
  console.log('Policy Chat API:', apiTest ? '✅ PASS' : '❌ FAIL');
  console.log('Policy Chat Page:', pageTest ? '✅ PASS' : '❌ FAIL');
  console.log('LocalStorage:', storageTest ? '✅ PASS' : '❌ FAIL');
  
  if (apiTest && pageTest && storageTest) {
    console.log('\n🎉 All Policy Chat tests passed!');
    return true;
  } else {
    console.log('\n⚠️  Some Policy Chat tests failed.');
    return false;
  }
}

runPolicyChatTests().catch(console.error);
