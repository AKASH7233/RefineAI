# 🎨 RefineAI - Chrome Extension (MV3)

A lightweight Chrome Extension that fixes grammar, improves clarity, and humanizes text across any website. Powered by Google's Gemini 2.5 Flash API with real-time streaming responses.

**Features:**
- ✨ Floating "Fix" button appears near any input field
- 🌍 Supports English, Hindi, and Hinglish
- 📱 Responsive design for all device sizes
- ⚡ Real-time streaming text updates
- 👤 Humanized output (not robotic AI text)
- ↩️ Undo functionality to revert changes
- 🔒 API key stored securely in environment variables
- 🎯 Works on ChatGPT, WhatsApp Web, Discord, and more

---

## 📋 Table of Contents
1. [Quick Start](#quick-start)
2. [Environment Setup](#environment-setup)
3. [Project Architecture](#project-architecture)
4. [How It Works](#how-it-works)
5. [File Structure](#file-structure)
6. [Development](#development)
7. [Building & Deployment](#building--deployment)
8. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Google Gemini API key (free tier available)
- Chrome browser with extension support

### Installation Steps

1. **Clone and install dependencies:**
   ```bash
   cd /path/to/refineAi
   npm install
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your Gemini API key:
   ```
   VITE_GEMINI_API_KEY=your_api_key_here
   ```

3. **Build the extension:**
   ```bash
   npm run build
   ```
   This generates optimized files in the `dist/` folder.

4. **Load into Chrome:**
   - Open `chrome://extensions`
   - Enable **Developer Mode** (toggle in top-right)
   - Click **Load unpacked**
   - Select the `dist/` folder
   - Done! The extension is now active

5. **Test it:**
   - Go to ChatGPT, WhatsApp Web, or any website
   - Focus on a text input field
   - Look for the cyan **✨** button
   - Click it and watch the text get fixed

---

## 🔧 Environment Setup

### Getting a Gemini API Key

1. Visit [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **"Get API Key"** and create a new project
3. Click **"Create API Key in new project"**
4. Copy the generated API key
5. Paste it into `.env` as `VITE_GEMINI_API_KEY`

### Environment File (.env)

Create a `.env` file in the project root:
```env
# Gemini API Configuration
VITE_GEMINI_API_KEY=AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
```

**Important:** 
- `.env` is in `.gitignore` and never committed
- API key is injected at **build time** by Vite
- Each build embeds the key into the bundled JavaScript (in `dist/`)
- The key is **not stored in the browser** - it lives in the service worker

### Build Configuration (vite.config.js)

The Vite configuration ensures:
- Stable output filenames (no hash suffixes) for Manifest V3 compatibility
- Separate chunks for background and content scripts
- Environment variables are substituted at build time

---

## 🏗️ Project Architecture

```
┌─────────────────────────────────────────────────┐
│          User's Browser / Website               │
├─────────────────────────────────────────────────┤
│  Content Script (content.js)                    │
│  ├─ Shadow DOM Widget (UI)                      │
│  ├─ Detects focused input/textarea/contenteditable
│  ├─ Port messaging to background worker         │
│  └─ Updates text on the page                    │
├─────────────────────────────────────────────────┤
│  Service Worker (background.js)                 │
│  ├─ Listens for port connections                │
│  ├─ Receives text from content script           │
│  ├─ Calls Gemini API (has API key)              │
│  ├─ Streams response back to content script     │
│  └─ Handles cleanup & errors                    │
└─────────────────────────────────────────────────┘
           ↓ Network Request
┌─────────────────────────────────────────────────┐
│    Google Gemini 2.5 Flash API                  │
│    https://generativelanguage.googleapis.com    │
│    (HTTP POST streaming response)               │
└─────────────────────────────────────────────────┘
```

### Data Flow Diagram

```
1. User focuses on input field
   ↓
2. Content script detects focus → shows widget
   ↓
3. User clicks "✨ Fix" button
   ↓
4. Content script sends START message to service worker
   Port: chrome.runtime.connect({ name: "aigf" })
   ↓
5. Service Worker receives message
   ├─ Validates API key exists
   ├─ Calls Gemini API with buildPrompt(text)
   └─ Streams response chunks
   ↓
6. For each chunk, service worker sends UPDATE message
   Message: { type: "UPDATE", text: "partial text..." }
   ↓
7. Content script receives UPDATE
   ├─ Calls setText() to update DOM
   ├─ Dispatches React-compatible events
   └─ User sees text change live
   ↓
8. When stream ends, service worker sends DONE message
   ↓
9. Content script shows "Undo" button
   User can click to restore original text
```

---

## 💡 How It Works

### 1. Content Script (`src/content/content.js`)

**Responsibility:** Manage the extension UI on web pages

- **Focus Tracking:** Detects when user focuses on input/textarea/contenteditable
- **Widget Hosting:** Creates a shadow DOM widget with Fix/Undo buttons
- **Message Routing:** Communicates with background service worker via Chrome ports
- **DOM Updates:** Calls `setText()` to apply corrected text to the page

**Key Functions:**
- `startFix()` - Reads text, connects to service worker, starts the fix process
- `writeCurrentText(text)` - Writes corrected text back to the focused element
- `readCurrentText()` - Extracts text from input/textarea/contenteditable
- `setUndoVisible(true/false)` - Shows/hides undo button

### 2. Service Worker (`src/background/background.js`)

**Responsibility:** Handle API calls securely

- **Port Listener:** Accepts connections from content scripts
- **API Key Management:** Has access to the Gemini API key (stored in environment)
- **Request Forwarding:** Sends text to Gemini API and streams response
- **Error Handling:** Catches network errors and sends ERROR messages

**Key Functions:**
- `chrome.runtime.onConnect` - Listens for content script connections
- `port.onMessage` - Handles START messages from content script
- `streamGeminiFix()` - Calls Gemini and streams response back

### 3. Gemini API Handler (`src/background/geminiApi.js`)

**Responsibility:** Handle streaming from Gemini API

- **Prompt Building:** `buildPrompt(text)` creates instructions for grammar fixing
- **SSE Parsing:** Reads Server-Sent Events (streaming JSON responses)
- **Text Extraction:** Parses Gemini's response format to extract corrected text
- **Callback Streaming:** Calls `onText(fullTextSoFar)` for each chunk

**Key Functions:**
- `buildPrompt(text)` - Creates the instruction prompt
- `streamGeminiFix()` - Handles HTTP streaming from Gemini
- `extractDeltaText(json)` - Extracts text from Gemini's response JSON

### 4. DOM Utilities (`src/content/dom.js`)

**Responsibility:** Handle text extraction and insertion safely

- **Element Detection:** Identifies input, textarea, and contenteditable fields
- **Text Extraction:** `getText(el)` reads from `.value`, `.innerText`, etc.
- **Text Insertion:** `setText(el, text)` handles React-managed fields
- **Event Dispatching:** Sends events to notify React/Vue/Angular of changes

**Key Functions:**
- `getText(el)` - Extracts text intelligently
- `setText(el, text)` - Sets text with React compatibility
- `dispatchInputEvents(el)` - Fires input/change/beforeinput events
- `getAnchorRect(el)` - Finds position for widget placement

### 5. Widget UI (`src/content/ui.js`)

**Responsibility:** Render and style the floating widget

- **Shadow DOM:** Creates isolated DOM tree (prevents page CSS interference)
- **Icon Rendering:** SVG icons for Fix, Undo, and Spinner
- **Positioning:** Places widget relative to focused field
- **Responsive Design:** Adapts to mobile/tablet/desktop screens
- **Visibility Control:** Shows/hides widget and messages

**Key Functions:**
- `createWidget(host)` - Creates the shadow DOM structure
- `setPosition(widgetHost, anchorRect)` - Positions widget on screen
- `setLoading(widgetHost, loading)` - Shows spinner during processing
- `setMessage(widgetHost, text)` - Displays status/error messages

---

## 📁 File Structure

```
refineAi/
├── public/
│   └── manifest.json          # Chrome extension manifest (MV3)
├── src/
│   ├── background/
│   │   ├── background.js      # Service worker (handles API calls)
│   │   └── geminiApi.js       # Gemini API streaming logic
│   ├── content/
│   │   ├── content.js         # Main content script (UI + messaging)
│   │   ├── dom.js             # DOM utilities (text extraction/insertion)
│   │   ├── ui.js              # Widget UI (shadow DOM, styling)
│   │   └── constants.js       # Shared constants
│   └── constants.js           # (if exists)
├── dist/                       # Build output (generated by Vite)
│   ├── manifest.json          # Copied from public/
│   ├── background/
│   │   ├── background.js      # Compiled service worker
│   │   └── background.js.map  # Source map for debugging
│   ├── content/
│   │   ├── content.js         # Compiled content script
│   │   └── content.js.map     # Source map for debugging
│   └── ...
├── .env                        # Environment variables (git-ignored)
├── .env.example                # Template for .env
├── .gitignore                  # Git ignore rules
├── vite.config.js             # Vite build configuration
├── package.json               # Node dependencies & scripts
├── package-lock.json          # Locked dependency versions
└── README.md                   # This file
```

### Key Files Explained

**`manifest.json`** - Chrome Extension manifest
- Declares permissions (if any)
- Registers content scripts and pages to inject into
- Specifies background service worker
- Defines extension metadata (name, icons, version)

**`vite.config.js`** - Build configuration
- Configures entry points for background and content scripts
- Ensures stable filenames (no hash suffixes)
- Defines build output directory
- Copies static assets (`public/manifest.json`)

**`package.json`** - Project metadata
- `npm run build` - Build extension to `dist/`
- `npm run dev` - Watch mode (rebuilds on file changes)
- Dependencies: `vite` only (no framework overhead)

---

## 🛠️ Development

### Development Workflow

1. **Start watch mode:**
   ```bash
   npm run dev
   ```
   Vite will rebuild on file changes automatically. The extension will also reload when `.env` file changes (through the envWatchPlugin).

2. **Edit code** in `src/` and rebuild

3. **Reload extension** in Chrome:
   - Go to `chrome://extensions`
   - Find "RefineAI"
   - Click the refresh icon

4. **Test changes** on the website

### Testing Different Platforms

The extension works on:
- ✅ ChatGPT.com (contenteditable field)
- ✅ WhatsApp Web (contenteditable field)
- ✅ Discord (contenteditable field)
- ✅ Gmail (contenteditable field)
- ✅ Twitter/X (contenteditable field)
- ✅ Regular `<input>` and `<textarea>` fields

---

## 🔨 Building & Deployment

### Production Build

```bash
npm run build
```

This generates:
- `dist/manifest.json` (copied from public)
- `dist/background/background.js` (minified service worker with embedded API key)
- `dist/content/content.js` (minified content script)
- `dist/*/**.js.map` (source maps for debugging)

**File Sizes:**
- `background.js`: ~4.4 KB (gzip: ~2.1 KB)
- `content.js`: ~11.5 KB (gzip: ~4.2 KB)

### Deploying to Chrome Web Store

1. Create a [Google Play Developer account](https://developer.chrome.com)
2. Upload `dist/` folder as a `.zip` file
3. Wait for review (~3 days)
4. Extension goes live on the Chrome Web Store

### Versioning

Edit `manifest.json` to bump version:
```json
{
  "version": "1.0.1"
}
```

Each deployment to Chrome Web Store should increment this.

---

## 🐛 Troubleshooting

### Extension doesn't show the button
- **Fix:** Make sure `dist/` folder exists with `manifest.json`
- Run `npm run build` again
- Reload extension in `chrome://extensions`

### "Extension context invalidated" error
- **Fix:** Extension reloaded. Reload the website tab.

### Text doesn't change on ChatGPT/WhatsApp
- **WhatsApp Web:** Uses MutationObserver to detect and fix React re-renders for reliable text replacement
- **ChatGPT & others:** Uses React-compatible event dispatching for text updates
- **Fix:** Ensure you're using the latest build
- Clear browser cache or test in private window if issues persist

### API key errors
- **Symptom:** "Gemini API key not set" message
- **Fix:** Check `.env` file has `VITE_GEMINI_API_KEY` set
- Rebuild: `npm run build`
- Reload extension

### Button doesn't appear on some websites
- **Symptom:** Button shows on ChatGPT but not on other sites
- **Reason:** Some sites use iframes or shadow DOM that blocks our content script
- **Workaround:** We handle top-level document elements; nested iframes may not work

### Text looks "AI-like"
- **Symptom:** Output is too formal/robotic
- **Fix:** Improved with humanized prompt that asks Gemini to keep conversational tone
- The extension prioritizes natural, human-written output over perfect grammar
- Rebuild extension if prompt was recently updated: `npm run build`

---

## 📚 API Reference

### Chrome Extension APIs Used

```javascript
// Connect to service worker
chrome.runtime.connect({ name: "aigf" })

// Send message through port
port.postMessage({ type: "START", text: "..." })

// Listen for messages
port.onMessage.addListener((msg) => { ... })

// Detect disconnection
port.onDisconnect.addListener(() => { ... })
```

### Gemini API Endpoint

```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse&key=API_KEY

Body: {
  contents: [{
    role: "user",
    parts: [{ text: "Fix grammar..." }]
  }],
  generationConfig: { temperature: 0.2 }
}

Response: Server-Sent Events (SSE) stream with JSON chunks
```

---

## 📝 License

This project is open source. Feel free to fork and modify!

---

## 🤝 Contributing

Have ideas to improve the extension? 

1. Fork the repo
2. Make changes in a new branch
3. Test thoroughly
4. Submit a pull request

---

## 📞 Support

If you encounter issues:

1. Check [Troubleshooting](#troubleshooting) section
2. Review the development section for build/reload instructions
3. Ensure `.env` file is correctly set up
4. Try clean rebuild: `npm run build && npm run dev`

Happy fixing! 🎉
