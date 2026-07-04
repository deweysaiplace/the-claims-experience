const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
if (env) process.env.GEMINI_API_KEY = env.split('=')[1].trim();

const { GoogleGenAI } = require('@google/genai');

const dir = 'C:\\Users\\Dewey\\Desktop\\stuff\\2137';
const outPath = path.join(__dirname, '../src/data/extracted_policy.md');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
const BATCH_SIZE = 5;

async function processBatch(batchFiles) {
  const parts = batchFiles.map(f => {
    const fullPath = path.join(dir, f);
    const data = fs.readFileSync(fullPath).toString('base64');
    return {
      inlineData: {
        data,
        mimeType: 'image/jpeg'
      }
    };
  });
  
  parts.unshift({
    text: "Extract all policy text from these images, specifically noting Coverages, Limits, Deductibles, Exclusions, Conditions, and Endorsements. Format the extracted information into clean, readable Markdown structure. Do not hallucinate or guess details not present in the images."
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
  });
  
  return response.text;
}

async function run() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "# Extracted Homeowners Policy (2137)\n\n");
  
  console.log(`Starting extraction of ${files.length} policy photos...`);
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(files.length / BATCH_SIZE);
    
    let success = false;
    let attempts = 0;
    
    while (!success && attempts < 5) {
      attempts++;
      console.log(`Processing batch ${batchNum} of ${totalBatches} (Attempt ${attempts})...`);
      try {
        const text = await processBatch(batch);
        fs.appendFileSync(outPath, text + "\n\n");
        console.log(`Saved batch ${batchNum}.`);
        success = true;
        // Insert a solid delay between successful requests to be polite to the API rate limit
        await new Promise(r => setTimeout(r, 15000));
      } catch (e) {
        console.error(`Error in batch ${batchNum}:`, e.message);
        const waitTime = 15000 * attempts;
        console.log(`Waiting ${waitTime / 1000} seconds before retry...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
    
    if (!success) {
      console.error(`Skipped batch ${batchNum} completely after failing 5 attempts.`);
    }
  }
  console.log("Finished extracting homeowners policy!");
}

run();
