const fs = require('fs');
const path = require('path');
const env = fs.readFileSync('.env.local', 'utf8').split('\n').find(line => line.startsWith('ANTHROPIC_API_KEY='));
if (env) process.env.ANTHROPIC_API_KEY = env.split('=')[1].trim();

const Anthropic = require('@anthropic-ai/sdk');

const dir = 'C:\\Users\\Dewey\\Desktop\\stuff\\2137';
const outPath = path.join(__dirname, '../src/data/extracted_policy.md');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const claudeModel = 'claude-3-5-sonnet-20241022';

const files = fs.readdirSync(dir).filter(f => f.endsWith('.jpg') || f.endsWith('.png'));
const BATCH_SIZE = 5;

async function processBatch(batchFiles) {
  const imageParts = batchFiles.map(f => {
    const fullPath = path.join(dir, f);
    const data = fs.readFileSync(fullPath).toString('base64');
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data
      }
    };
  });
  
  const content = [
    {
      type: 'text',
      text: "Extract all policy text from these images, specifically noting Coverages, Limits, Deductibles, Exclusions, Conditions, and Endorsements. Format the extracted information into clean, readable Markdown structure. Do not hallucinate or guess details not present in the images."
    },
    ...imageParts
  ];

  const response = await claude.messages.create({
    model: claudeModel,
    max_tokens: 4000,
    messages: [
      {
        role: 'user',
        content
      }
    ]
  });
  
  return response.content[0].text;
}

async function run() {
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "# Extracted Homeowners Policy (2137) via Claude\n\n");
  
  console.log(`Starting extraction of ${files.length} policy photos using Claude 3.5 Sonnet...`);
  
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
        // Small delay to be safe
        await new Promise(r => setTimeout(r, 5000));
      } catch (e) {
        console.error(`Error in batch ${batchNum}:`, e.message);
        console.log(`Waiting 15 seconds before retry...`);
        await new Promise(r => setTimeout(r, 15000));
      }
    }
    
    if (!success) {
      console.error(`Skipped batch ${batchNum} completely after failing 3 attempts.`);
    }
  }
  console.log("Finished extracting homeowners policy using Claude!");
}

run();
