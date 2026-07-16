import { GoogleGenAI } from '@google/genai'
import Anthropic from '@anthropic-ai/sdk'

// Types for our unified fallback response
export interface AIFallbackResponse {
  text: string;
  provider: 'gemini' | 'claude' | 'grok';
}

export async function generateWithFallback(
  prompt: string, 
  systemInstruction?: string,
  base64Images?: string[] // Optional array of base64 images (without data URI prefix)
): Promise<AIFallbackResponse> {
  let errors: string[] = [];

  // 1. Try Gemini First (Preferred)
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('Attempting Gemini generation...');
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const contents = [];
      if (base64Images && base64Images.length > 0) {
        // If there are images, format them for Gemini
        for (const img of base64Images) {
          contents.push({
            inlineData: {
              data: img,
              mimeType: 'image/jpeg' // Assume jpeg for simplicity, or deduce it
            }
          });
        }
      }
      contents.push({ text: prompt });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: systemInstruction ? { systemInstruction } : undefined,
      });

      if (response.text) {
        return { text: response.text, provider: 'gemini' };
      }
    } catch (e: any) {
      console.error('Gemini failed:', e.message);
      errors.push(`Gemini Error: ${e.message}`);
    }
  }

  // 2. Try Claude (Anthropic) Fallback
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      console.log('Attempting Claude fallback...');
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      
      const content: any[] = [];
      if (base64Images && base64Images.length > 0) {
        for (const img of base64Images) {
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: img,
            }
          });
        }
      }
      content.push({ type: 'text', text: prompt });

      const msg = await anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4000,
        system: systemInstruction,
        messages: [{ role: 'user', content }],
      });

      if (msg.content && msg.content.length > 0 && msg.content[0].type === 'text') {
        return { text: msg.content[0].text, provider: 'claude' };
      }
    } catch (e: any) {
      console.error('Claude failed:', e.message);
      errors.push(`Claude Error: ${e.message}`);
    }
  }

  // 3. Try Grok Fallback (via xAI API which is OpenAI compatible)
  if (process.env.GROK_API_KEY) {
    try {
      console.log('Attempting Grok fallback...');
      // Note: xAI vision support might require specific formatting, 
      // but we'll use a basic fetch request to the OpenAI-compatible endpoint.
      const payload: any = {
        model: "grok-2-vision-latest",
        messages: [
          ...(systemInstruction ? [{ role: "system", content: systemInstruction }] : []),
        ],
      };

      const userContent: any[] = [{ type: "text", text: prompt }];
      if (base64Images && base64Images.length > 0) {
         for (const img of base64Images) {
            userContent.push({
              type: "image_url",
              image_url: { url: `data:image/jpeg;base64,${img}` }
            });
         }
      }
      payload.messages.push({ role: "user", content: userContent });

      const res = await fetch('https://api.x.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROK_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error(`Grok API error: ${res.statusText}`);
      }

      const data = await res.json();
      if (data.choices && data.choices.length > 0) {
        return { text: data.choices[0].message.content, provider: 'grok' };
      }
    } catch (e: any) {
      console.error('Grok failed:', e.message);
      errors.push(`Grok Error: ${e.message}`);
    }
  }

  throw new Error(`All AI providers failed. \n${errors.join('\n')}`);
}
