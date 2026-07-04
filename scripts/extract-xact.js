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
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  let allText = "# Extracted Xactimate Codes\n\n";
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    const batch = files.slice(i, i + BATCH_SIZE);
    console.log(`Processing batch ${Math.floor(i/BATCH_SIZE) + 1} of ${Math.ceil(files.length/BATCH_SIZE)}...`);
    try {
      const text = await processBatch(batch);
      allText += text + "\n\n";
      fs.writeFileSync(outPath, allText);
      console.log(`Saved batch ${Math.floor(i/BATCH_SIZE) + 1}.`);
      await new Promise(r => setTimeout(r, 4000));
    } catch (e) {
      console.error(`Error in batch ${Math.floor(i/BATCH_SIZE) + 1}:`, e.message);
    }
  }
  console.log("Finished extracting all 94 images!");
}

run();
