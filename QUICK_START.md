# X Reply Drafter v2.0.0 - Quick Start Guide

## 🚀 Load the Extension (60 seconds)

1. **Open Chrome**
2. **Go to:** `chrome://extensions/`
3. **Enable:** Toggle "Developer mode" (top right)
4. **Click:** "Load unpacked"
5. **Select:** `/Users/bots/.openclaw/workspace/x-reply-drafter/extension/dist/`
6. **Done!** Icon appears in your toolbar

## ⚙️ Configure (90 seconds)

1. **Click extension icon** in toolbar
2. **Go to Settings tab**
3. **Add API Key:**
   - Choose provider (OpenAI recommended)
   - Paste your API key
   - Click "Fetch Models"
4. **Select Model** (e.g., gpt-4o-mini)
5. **Click "Save Settings"**

## 📝 Create Your First Prompt

1. **Click "Prompts" tab**
2. **Click "+ New"**
3. **Write instructions** (e.g., "Keep replies witty and under 50 words")
4. **Add tags** (e.g., "humor, concise")
5. **Choose tone** (casual, professional, provocative, contrarian)
6. **Click "Save Prompt"**

## ✨ Draft Your First Reply

1. **Go to X.com**
2. **Find any post**
3. **Look for "Draft" button** (appears when hovering over post)
4. **Click "Draft"**
5. **Wait 3 seconds** for AI to generate reply
6. **Reply appears in compose box!**
7. **Edit if needed, then post normally**

## 📊 Track Engagement

1. **Keep extension popup open** while posts are live
2. **Go to Analytics tab** after 30+ seconds
3. **See likes, retweets, replies** for your drafted posts
4. **Engagement auto-updates** every 30 seconds

## 🎯 Pro Tips

- **Use multiple prompts:** Create prompts for different styles (funny, professional, contrarian)
- **Set a default tone:** Choose a tone that matches your brand in Settings
- **Auto-submit carefully:** Only enable if you're very confident in the AI provider
- **Keep it open:** For best engagement tracking, keep the extension popup or DevTools open
- **Hard refresh X:** If "Draft" button stops appearing, press `Cmd+Shift+R` to hard refresh

## ❌ Troubleshooting

| Problem | Solution |
|---------|----------|
| "Draft" button doesn't appear | Hard refresh X (`Cmd+Shift+R`), reload extension |
| Text doesn't appear in compose | Close/reopen X.com, try drafting again |
| API key error | Verify key is correct, try "Fetch Models" button |
| No engagement data | Keep popup open for 30+ seconds, refresh page if needed |
| Auto-submit doesn't work | Try without auto-submit first, use manual post |

## 📚 Full Documentation

- **Changes made:** See `CHANGES_SUMMARY.md`
- **Detailed testing:** See `TEST_CHECKLIST.md`
- **Source code:** `extension/src/`

## 🔧 Settings Explained

| Setting | What it does |
|---------|-------------|
| **LLM Provider** | OpenAI / Anthropic / Custom endpoint |
| **API Key** | Your auth token for the provider |
| **Model** | Which AI model to use (fetch list button) |
| **Default Tone** | Style applied to all replies (overridable per prompt) |
| **Custom Endpoint** | For OpenAI-compatible APIs (e.g., Together.ai) |
| **Auto-Submit** | Automatically post replies (⚠️ use carefully!) |
| **Engagement Tracking** | Tracks likes/retweets/replies (must keep open) |

## 💡 Example Prompts

### Humor-Focused
```
Keep replies witty and funny. Use humor to deflate pretension. 
Add emojis if they land the joke better. Max 50 words.
```
Tags: `humor, witty, emoji`  
Tone: `casual`

### Professional
```
Reply thoughtfully with relevant insights. Show expertise without being condescending.
Cite sources or data if possible. Keep to ~100 words.
```
Tags: `expert, insightful, professional`  
Tone: `professional`

### Contrarian
```
Take the opposite view or find the nuance others miss.
Be respectful but direct. Challenge assumptions politely.
```
Tags: `nuance, contrarian, critical-thinking`  
Tone: `contrarian`

---

**Questions?** Check the help text in Settings or consult `TEST_CHECKLIST.md` for detailed guides.

**Ready to go!** 🎉
