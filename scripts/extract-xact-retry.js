const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
if (env) process.env.GEMINI_API_KEY = env.split('=')[1].trim();

const { GoogleGenAI } = require('@google/genai');

const dir = 'C:\\Users\\Dewey\\Desktop\\stuff\\xact';
const outPath = path.join(__dirname, '../src/data/extracted_xactimate_codes.md');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
const BATCH_SIZE = 5;
const BATCHES_TO_RETRY = [9, 12, 13]; // 0-indexed: Batch 10, 13, 14

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
    text: "Extract all Xactimate line item codes and descriptions from these images. Format as a Markdown table with columns: Code, Description, Unit, Price (if available). Only output the table, nothing else. Do not hallucinate."
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts }],
  });
  
  return response.text;
}

async function run() {
  let allText = "\n\n";
  for (const batchIndex of BATCHES_TO_RETRY) {
    const startIndex = batchIndex * BATCH_SIZE;
    const batch = files.slice(startIndex, startIndex + BATCH_SIZE);
    
    let success = false;
    let attempts = 0;
    
    while (!success && attempts < 3) {
      attempts++;
      console.log(`Processing batch ${batchIndex + 1} (Attempt ${attempts})...`);
      try {
        const text = await processBatch(batch);
        allText += text + "\n\n";
        fs.appendFileSync(outPath, text + "\n\n");
        console.log(`Saved batch ${batchIndex + 1}.`);
        success = true;
      } catch (e) {
        console.error(`Error in batch ${batchIndex + 1}:`, e.message);
        console.log(`Waiting 10 seconds before retry...`);
        await new Promise(r => setTimeout(r, 10000));
      }
    }
  }
  console.log("Finished retrying the skipped batches!");
}

run();
