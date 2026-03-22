export function buildPrompt(text) {
  return `You are a friendly writing assistant. Fix grammar, spelling, and improve clarity while keeping the text conversational and natural.

Guidelines:
- Keep the original tone and voice (casual, formal, etc.)
- Do not change the meaning
- Make it sound human-written, not robotic
- Keep it concise and natural-sounding
- Maintain personal voice and personality
- Support English, Hindi, and Hinglish
- Return ONLY the corrected/improved text, nothing else

Text to fix:
${text}`;
}

function extractDeltaText(json) {
  const parts = json?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return "";
  return parts.map((p) => p?.text ?? "").join("");
}

/**
 * Streams text from Gemini streamGenerateContent.
 * Calls onText(fullTextSoFar) repeatedly.
 */
export async function streamGeminiFix({ apiKey, model, text, signal, onText }) {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

  console.log("🌐 Calling Gemini API:", model, "with SSE alt");

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(text) }]
        }
      ],
      generationConfig: {
        temperature: 0.2
      }
    }),
    signal
  });

  console.log("📊 Response status:", res.status);

  if (!res.ok) {
    const err = await res.text().catch(() => "");
    const errorMsg = `Gemini error ${res.status}: ${err || res.statusText}`;
    console.log("❌", errorMsg);
    console.log("Error details:", err.substring(0, 500));
    throw new Error(errorMsg);
  }

  if (!res.body) {
    console.log("❌ No response body");
    throw new Error("No response body");
  }

  console.log("✓ Response OK, starting to read body...");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  let buffer = "";
  let finalText = "";
  let lineCount = 0;
  let chunkCount = 0;

  const flushLine = (rawLine) => {
    lineCount++;
    const line = rawLine.trim();
    if (!line) {
      console.log(`📄 Line ${lineCount}: Empty line, skipping`);
      return;
    }

    // Common format: SSE "data: {...}".
    const payload = line.startsWith("data:") ? line.slice(5).trim() : line;

    if (
      payload === "[DONE]" ||
      payload === "[" ||
      payload === "]" ||
      payload === ","
    ) {
      console.log(`📄 Line ${lineCount}: Marker "${payload}", skipping`);
      return;
    }

    console.log(`📄 Line ${lineCount}: Raw payload: "${payload.substring(0, 100)}..."`);

    try {
      const json = JSON.parse(payload);
      console.log(`📄 Line ${lineCount}: Parsed JSON, extracting text...`);
      const delta = extractDeltaText(json);
      if (!delta) {
        console.log(`📄 Line ${lineCount}: extractDeltaText returned empty`);
        return;
      }
      finalText += delta;
      console.log(`📄 Line ${lineCount}: ✓ Got delta "${delta.substring(0, 40)}", total length: ${finalText.length}`);
      onText(finalText);
    } catch (e) {
      console.log(`📄 Line ${lineCount}: ❌ Parse error: ${e.message}`);
    }
  };

  console.log("📖 Starting to read stream...");
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.log(`📖 ✓ Stream ended. Processed ${chunkCount} chunks, ${lineCount} lines. Final text length: ${finalText.length}`);
      break;
    }

    chunkCount++;
    const chunkText = decoder.decode(value, { stream: true });
    if (chunkCount === 1) {
      console.log(`📖 ⭐ FIRST CHUNK (${value.length} bytes): "${chunkText.substring(0, 200)}"`);
    }
    console.log(`📖 Chunk ${chunkCount}: Received ${value.length} bytes`);
    buffer += chunkText;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    console.log(`📖 Chunk ${chunkCount}: Split into ${lines.length} lines (${buffer.length} bytes remain in buffer)`);
    for (const line of lines) flushLine(line);
  }

  // Last buffer may contain a final line without newline.
  if (buffer.trim()) {
    console.log("📖 Processing final buffer");
    flushLine(buffer);
  }

  console.log("✨ Stream complete. Final text:", finalText.substring(0, 150));
  return finalText;
}
