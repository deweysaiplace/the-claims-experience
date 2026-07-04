const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(line => line.startsWith('GEMINI_API_KEY='));
if (env) process.env.GEMINI_API_KEY = env.split('=')[1].trim();

const { GoogleGenAI } = require('@google/genai');

const dir = 'C:\\Users\\Dewey\\Desktop\\stuff\\W & W guide';
const outPath = path.join(__dirname, '../src/data/extracted_guidelines.md');

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
    text: "Extract the claims handling guidelines from these images. Focus on capturing and structuring: \n1. Standard operating procedures (SOPs) for wind damage and water damage claims.\n2. Specific requirements for moisture mapping, dry-out, and equipment usage.\n3. Rules regarding material matching, repair vs. replacement thresholds, and approvals.\n4. Documentation and photo requirements.\nFormat the extracted content into structured Markdown with clear headings and bullet points. Do not guess or hallucinate details."
  });

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: [{ role: 'user', parts }],
  });
  
  return response.text;
}

async function run() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "# Extracted Wind & Water Claims Guidelines\n\n");
  
  console.log(`Starting extraction of ${files.length} Wind & Water guideline photos using gemini-2.5-pro...`);
  
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(files.length / BATCH_SIZE);
    
    let success = false;
    let attempts = 0;
    
    while (!success && attempts < 3) {
      attempts++;
      console.log(`Processing batch ${batchNum} of ${totalBatches} (Attempt ${attempts})...`);
      try {
        const text = await processBatch(batch);
        fs.appendFileSync(outPath, text + "\n\n");
        console.log(`Saved batch ${batchNum}.`);
        success = true;
        // Wait 35 seconds to stay safe from the RPM limits
        await new Promise(r => setTimeout(r, 35000));
      } catch (e) {
        console.error(`Error in batch ${batchNum}:`, e.message);
        console.log(`Waiting 40 seconds before retry...`);
        await new Promise(r => setTimeout(r, 40000));
      }
    }
    
    if (!success) {
      console.error(`Skipped batch ${batchNum} completely after failing 3 attempts.`);
    }
  }
  console.log("Finished extracting Wind & Water guidelines!");
}

run();
