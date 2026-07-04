const fs = require('fs');
const https = require('https');
const FormData = require('form-data');

const BASE_URL = 'https://the-claims-experience.hijasond.workers.dev';

const dummyPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
const dummyPngBuffer = Buffer.from(dummyPngBase64, 'base64');
fs.writeFileSync('dummy.png', dummyPngBuffer);

async function testEndpoint(name, endpoint, isJson, setupData) {
  console.log(`\n--- Testing ${name} (${endpoint}) ---`);
  
  return new Promise((resolve) => {
    let headers = {};
    let body;

    if (isJson) {
      body = JSON.stringify(setupData);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    } else {
      body = new FormData();
      setupData(body);
      headers = body.getHeaders();
    }

    const req = https.request(BASE_URL + endpoint, {
      method: 'POST',
      headers,
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`Status: ${res.statusCode}`);
        try {
          const json = JSON.parse(data);
          if (json.success || json.result || json.note || json.materials) {
            console.log(`✅ SUCCESS: Snippet:`, JSON.stringify(json).substring(0, 100));
          } else {
            console.log(`❌ FAILED (API Error):`, data);
          }
        } catch(e) {
          console.log(`❌ FAILED (Parse Error):`, data.substring(0, 200));
        }
        resolve();
      });
    });

    req.on('error', (e) => {
      console.log(`❌ FAILED (Network Error):`, e.message);
      resolve();
    });

    if (isJson) {
      req.write(body);
      req.end();
    } else {
      body.pipe(req);
    }
  });
}

async function runTests() {
  await testEndpoint('Field Scope', '/api/field-scope', false, (form) => {
    form.append('photos', fs.createReadStream('dummy.png'));
    form.append('transcript', 'Water damage on drywall in Kitchen');
  });

  await testEndpoint('Xact Analyze', '/api/xact-analyze', false, (form) => {
    form.append('images', fs.createReadStream('dummy.png'));
    form.append('notes', 'Need to replace 10 sq ft of drywall');
  });

  await testEndpoint('Field Note', '/api/field-note', true, {
    transcript: 'The roof is missing shingles and there is water intrusion in the attic.',
    claimRef: '5678'
  });

  fs.unlinkSync('dummy.png');
}

runTests();
