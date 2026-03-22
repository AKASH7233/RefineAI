# AI Grammar Fix (Chrome Extension, MV3)

This repo uses **Vite** to bundle the background script, content script, and options page into `dist/` with stable filenames suitable for `manifest.json`.

## Install (unpacked)
1. Copy `.env.example` to `.env` and set `VITE_GEMINI_API_KEY`
2. Install deps: `npm install`
3. Build: `npm run build`
4. Open `chrome://extensions`
5. Enable **Developer mode**
6. Click **Load unpacked**
7. Select the `dist/` folder (it contains `manifest.json`)

## Configure
- Set the key via `.env` (`VITE_GEMINI_API_KEY`)

## Use
- Focus any `input`, `textarea`, or `contenteditable` field
- Click the floating **✨ Fix** button
- Watch the text update live as Gemini streams the response
- Click **Undo** to restore the original text

## Notes
- The request is executed in the background service worker (keeps the API key off the page context).
- Some complex web editors may not behave like plain inputs; the extension uses `input`/`change` events to minimize breakage.
