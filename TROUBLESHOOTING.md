# Gemini API Quota Troubleshooting Guide

## 🚨 Problem: Getting "free_tier" quota errors with paid account

## ✅ SOLUTION STEPS

### Step 1: Verify API Key (2 minutes)
```bash
cd C:\Users\Dewey\CascadeProjects\the-claims-experience
node diagnose-api.js
```
This will tell you if your API key is properly configured.

### Step 2: Check Google Cloud Billing (5 minutes)
1. Go to: https://console.cloud.google.com/billing
2. Verify billing is ENABLED for your project
3. Check if you have a valid payment method
4. Ensure "generativelanguage.googleapis.com" API is enabled

### Step 3: Verify Quota Settings (3 minutes)
1. Go to: https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas
2. Check if your quotas show paid tier limits:
   - Free tier: 60 requests/minute, 1,500 requests/day
   - Paid tier: Much higher limits
3. If you see free tier limits, your billing isn't properly linked

### Step 4: Test Different Models
The system now tries multiple models automatically:
1. `gemini-2.5-pro` (highest limits for paid accounts)
2. `gemini-2.0-flash` (fast, good for paid accounts)
3. `gemini-1.5-pro` (alternative paid model)
4. `gemini-1.5-flash` (fallback)

## 🔧 IMMEDIATE WORKAROUNDS

### Option 1: Use Smart Processing Endpoint
The new `/api/parse-video-smart` endpoint:
- Automatically rotates through models
- Implements rate limiting (1 min between requests)
- Better error handling

### Option 2: Manual Rate Limiting
Wait 2-3 minutes between video uploads to avoid hitting limits.

### Option 3: Batch Processing
Process videos one at a time with delays:
```javascript
// In browser console
const videos = ['video1.mp4', 'video2.mp4', 'video3.mp4']
for (const video of videos) {
  await processVideo(video)
  await new Promise(r => setTimeout(r, 120000)) // Wait 2 minutes
}
```

## 📊 MONITORING

### Check API Usage in Real-Time
```bash
# Watch server logs
tail -f server-log.txt | grep -E "(quota|rate|model|success|error)"
```

### Check Browser Storage
```javascript
// In browser console (F12)
localStorage.getItem('lastExtractionResult')
JSON.parse(localStorage.getItem('lastParsedData'))
```

## 🎯 NEXT STEPS

1. **Run the diagnostic**: `node diagnose-api.js`
2. **Verify billing** at Google Cloud Console
3. **Try the new smart endpoint**: `/api/parse-video-smart`
4. **Use rate limiting**: Wait 2+ minutes between uploads
5. **Monitor logs**: Check `server-log.txt` for detailed info

## 💡 PRO TIPS

- **Best time to process**: Late night/early morning (lower API usage)
- **File size matters**: Smaller videos process faster (less API tokens)
- **Model selection**: Pro models have higher limits but cost more
- **Caching**: Same videos won't re-process (uses cache)

## 🆘 STILL HAVING ISSUES?

If you've verified billing and still get quota errors:
1. Your API key might be from a different project
2. The key might be cached with old permissions
3. Try creating a fresh API key with billing enabled

## 📞 GETTING HELP

- Google AI Studio: https://aistudio.google.com/app/apikey
- Google Cloud Support: https://cloud.google.com/support
- API Quotas: https://ai.google.dev/gemini-api/docs/rate-limits

---

**The system is working - the quota issue is with the API configuration. Follow these steps to resolve it!**
