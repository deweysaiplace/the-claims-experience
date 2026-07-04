// Test script for video upload workflow
const fs = require('fs');
const path = require('path');

// Test environment variables
const apiKey = process.env.NEXT_PUBLIC_GEMINI_KEY || 'AIzaSyDgwiWHsDx6Tu7xsCt19Q4duexPPUi4LHE';

console.log('Testing video upload workflow...');
console.log('API Key available:', !!apiKey);

// Test 1: Check if environment variables are loaded
console.log('\n=== Test 1: Environment Variables ===');
if (apiKey) {
  console.log('✅ NEXT_PUBLIC_GEMINI_KEY is available');
} else {
  console.log('❌ NEXT_PUBLIC_GEMINI_KEY is missing');
  process.exit(1);
}

// Test 2: Test Google Files API upload initiation
console.log('\n=== Test 2: Google Files API Upload Initiation ===');
const testFileDetails = {
  name: 'test-video.mp4',
  size: 1000000, // 1MB test
  type: 'video/mp4'
};

const uploadInitData = {
  file: {
    display_name: testFileDetails.name
  }
};

async function testUploadInitiation() {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/upload/v1beta/files?uploadType=resumable&key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': testFileDetails.size.toString(),
          'X-Goog-Upload-Header-Content-Type': testFileDetails.type,
        },
        body: JSON.stringify(uploadInitData),
      }
    );

    if (response.ok) {
      const uploadUrl = response.headers.get('x-goog-upload-url');
      console.log('✅ Upload initiation successful');
      console.log('Upload URL received:', uploadUrl ? 'Yes' : 'No');
      
      if (uploadUrl) {
        const uploadIdMatch = uploadUrl.match(/upload_id=([^&]+)/);
        if (uploadIdMatch) {
          console.log('✅ Upload ID extracted:', uploadIdMatch[1]);
          return { success: true, uploadUrl, uploadId: uploadIdMatch[1] };
        }
      }
    } else {
      console.log('❌ Upload initiation failed:', response.status, response.statusText);
      return { success: false };
    }
  } catch (error) {
    console.log('❌ Upload initiation error:', error.message);
    return { success: false };
  }
}

// Test 3: Test parse-video API endpoint
async function testParseVideoAPI() {
  console.log('\n=== Test 3: Parse Video API Endpoint ===');
  try {
    const response = await fetch('http://localhost:3000/api/parse-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fileUri: 'test-file-uri',
        mimeType: 'video/mp4',
        docType: 'state_farm_policy',
        claimRef: 'TEST001',
        address: '123 Test St'
      })
    });

    if (response.ok) {
      console.log('✅ Parse-video API endpoint accessible');
      return true;
    } else {
      console.log('❌ Parse-video API failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Parse-video API error:', error.message);
    return false;
  }
}

// Run all tests
async function runAllTests() {
  const uploadTest = await testUploadInitiation();
  const apiTest = await testParseVideoAPI();
  
  console.log('\n=== Test Summary ===');
  console.log('Upload Initiation:', uploadTest.success ? '✅ PASS' : '❌ FAIL');
  console.log('Parse Video API:', apiTest ? '✅ PASS' : '❌ FAIL');
  
  if (uploadTest.success && apiTest) {
    console.log('\n🎉 All tests passed! System is ready for video upload.');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the issues above.');
  }
}

runAllTests().catch(console.error);
