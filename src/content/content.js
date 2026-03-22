import * as dom from "./dom.js";
import * as ui from "./ui.js";

(() => {
  "use strict";

  const { getEditableTargetFromEvent, getText, setText, getAnchorRect } = dom;

  const widgetHost = ui.createWidget();

  let messageTimer = null;
  let messagePurpose = null;

  /** @type {HTMLElement|null} */
  let currentTarget = null;
  let lastOriginal = null;
  let lastTarget = null;

  let activePort = null;
  let activeRequestId = null;
  let lastAppliedText = "";

  function newRequestId() {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function disconnectPort() {
    if (activePort) {
      try {
        activePort.disconnect();
      } catch {
        // ignore
      }
    }
    activePort = null;
    activeRequestId = null;
  }

  function setWidgetForTarget(target) {
    currentTarget = target;
    const rect = target ? getAnchorRect(target) : null;

    if (!target || !rect) {
      ui.setVisible(widgetHost, false);
      return;
    }
    ui.setVisible(widgetHost, true);
    ui.setPosition(widgetHost, rect);

    // Re-measure next frame (first paint can have 0-size panel).
    requestAnimationFrame(() => {
      if (currentTarget !== target) return;
      const r2 = getAnchorRect(target);
      if (r2) ui.setPosition(widgetHost, r2);
    });
  }

  function isLoading() {
    return widgetHost._aigf.state.loading;
  }

  function setLoading(loading) {
    ui.setLoading(widgetHost, loading);
  }

  function setError(msg) {
    ui.setMessage(widgetHost, msg);
    messagePurpose = "error";
  }

  function clearMessage() {
    ui.setMessage(widgetHost, "");
    messagePurpose = null;
  }

  function clearMessageTimer() {
    if (messageTimer) {
      clearTimeout(messageTimer);
      messageTimer = null;
    }
  }

  function showTempError(msg, ms = 3000) {
    clearMessageTimer();
    setError(msg);
    messageTimer = setTimeout(() => {
      messageTimer = null;
      if (messagePurpose === "error") {
        clearMessage();
      }
    }, ms);
  }

  function setUndoVisible(visible) {
    ui.setUndoVisible(widgetHost, visible);
  }

  function updatePositionSoon() {
    // Coalesce scroll/resize.
    if (!currentTarget) return;
    requestAnimationFrame(() => setWidgetForTarget(currentTarget));
  }

  function readCurrentText() {
    if (!currentTarget) return "";
    return getText(currentTarget);
  }

  function writeCurrentText(text) {
    if (!currentTarget) {
      console.log("⚠️ writeCurrentText: no currentTarget");
      return;
    }
    console.log("✏️ Writing text to", currentTarget.tagName, "text:", text.substring(0, 50));
    lastAppliedText = text;
    setText(currentTarget, text);
    console.log("✓ setText called. New value:", getText(currentTarget).substring(0, 50));
  }

  function startFix() {
    if (!currentTarget || isLoading()) return;
    const text = readCurrentText();
    if (!text || !text.trim()) return;

    clearMessageTimer();
    clearMessage();
    setUndoVisible(false);

    lastOriginal = text;
    lastTarget = currentTarget;

    setLoading(true);

    disconnectPort();

    try {
      activePort = chrome.runtime.connect({ name: "aigf" });
      console.log("🔗 Connected to background port");
    } catch {
      console.log("❌ Failed to connect to background port");
      setLoading(false);
      return;
    }
    activeRequestId = newRequestId();

    activePort.onMessage.addListener((msg) => {
      console.log("📬 Content received message:", msg?.type, "requestId:", msg?.requestId, "activeRequestId:", activeRequestId);
      if (!msg || msg.requestId !== activeRequestId) {
        console.log("⚠️  Message filtered out: no msg or mismatched requestId");
        return;
      }

      if (msg.type === "UPDATE") {
        console.log("📤 UPDATE message received, calling writeCurrentText");
        writeCurrentText(msg.text || "");
        return;
      }

      if (msg.type === "DONE") {
        console.log("✅ DONE message received");
        setLoading(false);
        setUndoVisible(true);
        disconnectPort();
        return;
      }

      if (msg.type === "ERROR") {
        setLoading(false);
        const errText = msg.error || "Request failed";

        setUndoVisible(false);
        showTempError(errText, 3000);
        disconnectPort();
      }
    });

    activePort.onDisconnect.addListener(() => {
      // If the port dropped while loading, show a generic error.
      if (isLoading()) {
        setLoading(false);
        setUndoVisible(false);
        showTempError("Disconnected", 3000);
      }
      activePort = null;
      activeRequestId = null;
    });

    activePort.postMessage({
      type: "START",
      requestId: activeRequestId,
      text
    });
  }

  function undo() {
    if (!lastTarget || !lastOriginal) return;
    currentTarget = lastTarget;
    writeCurrentText(lastOriginal);
    setUndoVisible(false);
    clearMessage();
  }

  // Wire UI.
  ui.onFix(widgetHost, startFix);
  ui.onUndo(widgetHost, undo);

  // Focus tracking.
  document.addEventListener(
    "focusin",
    (e) => {
      // If focus moved within our own widget (shadow DOM), ignore.
      try {
        const path = e.composedPath?.() || [];
        if (path.includes(widgetHost)) return;
      } catch {
        // ignore
      }

      const target = getEditableTargetFromEvent(e.target);
      if (!target) return;

      setWidgetForTarget(target);
      // Don't clear errors immediately; they auto-clear after a few seconds.
      // Undo stays available only for lastTarget.
      setUndoVisible(Boolean(lastTarget && lastTarget === target && lastOriginal));

    },
    true
  );

  document.addEventListener(
    "focusout",
    () => {
      // Hide after a tick; pointerdown on the widget prevents focus change.
      setTimeout(() => {
        const active = document.activeElement;

        // Keep visible if focus moved into the widget itself (shadow DOM focuses the host).
        if (active === widgetHost) return;
        if (dom.isEditableElement(active)) return;
        currentTarget = null;
        ui.setVisible(widgetHost, false);
      }, 0);
    },
    true
  );

  window.addEventListener("scroll", updatePositionSoon, true);
  window.addEventListener("resize", updatePositionSoon, true);
})();
