import { streamGeminiFix } from "./geminiApi.js";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || "";
const MODEL = "gemini-2.5-flash";
const REQUEST_TIMEOUT_MS = 120000;

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== "aigf") return;

  /** @type {AbortController|null} */
  let controller = null;
  let timeoutId = null;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (controller) {
      try {
        controller.abort();
      } catch {
        // ignore
      }
      controller = null;
    }
  };

  port.onDisconnect.addListener(() => {
    cleanup();
  });

  port.onMessage.addListener(async (msg) => {
    if (!msg || msg.type !== "START") return;

    console.log("📨 Background received START:", msg.text?.substring(0, 50));
    cleanup();

    const requestId = msg.requestId;
    const text = msg.text || "";

    controller = new AbortController();
    timeoutId = setTimeout(() => controller?.abort(), REQUEST_TIMEOUT_MS);

    try {
      if (!API_KEY) {
        console.log("❌ No API key provided");
        port.postMessage({
          type: "ERROR",
          requestId,
          error: "Gemini API key not set. Define VITE_GEMINI_API_KEY in your .env."
        });
        cleanup();
        return;
      }

      console.log("🚀 Calling streamGeminiFix...");
      const finalText = await streamGeminiFix({
        apiKey: API_KEY,
        model: MODEL,
        text,
        signal: controller.signal,
        onText: (partial) => {
          try {
            console.log("🔤 Background sending UPDATE:", partial.substring(0, 40));
            port.postMessage({ 
              type: "UPDATE",
              requestId,
              text: partial
            });
          } catch {
            // If posting fails, the port likely disconnected.
            console.log("❌ Failed to post UPDATE message");
          }
        }
      });

      console.log("✨ Final text from API:", finalText.substring(0, 100));
      
      // Send final text as UPDATE if we haven't sent it yet (handles case where stream had no data)
      if (finalText && finalText.trim()) {
        console.log("📤 Sending final text as UPDATE");
        try {
          port.postMessage({ 
            type: "UPDATE",
            requestId,
            text: finalText
          });
        } catch {
          console.log("❌ Failed to send final UPDATE");
        }
      } else {
        console.log("⚠️  Final text is empty or whitespace only");
      }

      console.log("✅ Sending DONE message");
      port.postMessage({ type: "DONE", requestId });
      cleanup();
    } catch (e) {
      const msgText =
        (e && typeof e === "object" && "message" in e && e.message) ||
        String(e || "Request failed");

      console.log("❌ Error in streamGeminiFix:", msgText);

      port.postMessage({
        type: "ERROR",
        requestId,
        error: msgText
      });
      cleanup();
    }
  });
});
