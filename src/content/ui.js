import { constants } from "./constants.js";

const { WIDGET_ID } = constants;

const ICON_FIX = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2l1.2 4.6L18 8l-4.8 1.4L12 14l-1.2-4.6L6 8l4.8-1.4L12 2zm7 9l.8 3 3.2 1-3.2 1-.8 3-.8-3-3.2-1 3.2-1 .8-3zM5 12l.9 3.4 3.6 1.1-3.6 1.1L5 21l-.9-3.4L.5 16.5l3.6-1.1L5 12z"/>
  </svg>`;

const ICON_UNDO = `
  <svg class="icon" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 5c-3.9 0-7 3.1-7 7v1H2l4 4 4-4H7v-1c0-2.8 2.2-5 5-5 2.8 0 5 2.2 5 5s-2.2 5-5 5H8v2h4c3.9 0 7-3.1 7-7s-3.1-7-7-7z"/>
  </svg>`;

const ICON_SPINNER = `
  <svg class="icon spin" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M12 2a10 10 0 0 1 10 10h-2a8 8 0 0 0-8-8V2z"/>
  </svg>`;

function clamp(n, min, max) {
  return Math.min(Math.max(n, min), max);
}

export function createWidget() {
    let host = document.getElementById(WIDGET_ID);
    if (host) return host;

    host = document.createElement("div");
    host.id = WIDGET_ID;
    host.style.position = "fixed";
    host.style.zIndex = "2147483647";
    host.style.top = "0";
    host.style.left = "0";
    host.style.width = "0";
    host.style.height = "0";

    const shadow = host.attachShadow({ mode: "open" });

    const style = document.createElement("style");
    style.textContent = `
      :host{ all: initial; }

      .wrap{
        position: fixed;
        display: none;
        pointer-events: auto;
        font: 12px/1.2 system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
        z-index: 2147483647;
      }

      .panel{
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 4px;
        border-radius: 12px;
        background: transparent;
      }

      button{
        all: unset;
        cursor: pointer;
        user-select: none;
        width: 34px;
        height: 34px;
        min-width: 34px;
        min-height: 34px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border-radius: 12px;
        background: transparent;
        flex-shrink: 0;
        touch-action: manipulation;
      }

      button[aria-disabled='true']{
        opacity: 0.55;
        cursor: default;
      }

      .msg{
        margin-left: 2px;
        max-width: 200px;
        min-width: 0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: rgba(0,0,0,0.72);
        flex-shrink: 1;
      }

      .key{
        display: none;
        gap: 6px;
        align-items: center;
      }

      .key input{
        all: unset;
        min-width: 200px;
        padding: 6px 10px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,0.22);
        background: #fff;
        color: #111;
      }

      .key button{
        width: auto;
        padding: 0 10px;
        height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(0,0,0,0.22);
        background: #fff;
        color: #111;
        font-weight: 600;
      }

      .icon{
        width: 18px;
        height: 18px;
        fill: #00e5ff;
        filter: drop-shadow(0 0 6px rgba(0,229,255,0.65));
      }

      .spin{ animation: spin 0.9s linear infinite; }
      @keyframes spin { from{ transform: rotate(0deg);} to{ transform: rotate(360deg);} }

      /* Mobile responsive */
      @media (max-width: 480px) {
        button{
          width: 32px;
          height: 32px;
          min-width: 32px;
          min-height: 32px;
        }
        .msg{
          max-width: 120px;
          font-size: 11px;
        }
        .icon{
          width: 16px;
          height: 16px;
        }
      }

      @media (max-width: 320px) {
        button{
          width: 30px;
          height: 30px;
          min-width: 30px;
          min-height: 30px;
        }
        .msg{
          max-width: 80px;
          font-size: 10px;
        }
      }
    `;

    const wrap = document.createElement("div");
    wrap.className = "wrap";

    const panel = document.createElement("div");
    panel.className = "panel";

    const fixBtn = document.createElement("button");
    fixBtn.type = "button";
    fixBtn.setAttribute("aria-label", "Fix");
    fixBtn.innerHTML = ICON_FIX;

    const undoBtn = document.createElement("button");
    undoBtn.type = "button";
    undoBtn.setAttribute("aria-label", "Undo");
    undoBtn.innerHTML = ICON_UNDO;
    undoBtn.style.display = "none";

    const msg = document.createElement("span");
    msg.className = "msg";

    // Avoid breaking page JS: stop propagation so clicks don't hit the page.
    // For Fix/Undo buttons we also prevent default to avoid blurring the active field.
    wrap.addEventListener(
      "pointerdown",
      (e) => {
        e.stopPropagation();
      },
      true
    );

    for (const btn of [fixBtn, undoBtn]) {
      btn.addEventListener(
        "pointerdown",
        (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        true
      );
    }

    panel.appendChild(fixBtn);
    panel.appendChild(undoBtn);
    panel.appendChild(msg);
    wrap.appendChild(panel);
    shadow.appendChild(style);
    shadow.appendChild(wrap);

    document.documentElement.appendChild(host);

    host._aigf = {
      shadow,
      wrap,
      panel,
      fixBtn,
      undoBtn,
      msg,
      state: {
        visible: false,
        loading: false
      }
    };

    return host;
  }

export function setVisible(widgetHost, visible) {
    const api = widgetHost._aigf;
    api.state.visible = visible;
    api.wrap.style.display = visible ? "block" : "none";
  }

export function setPosition(widgetHost, anchorRect) {
    const api = widgetHost._aigf;
    if (!anchorRect) return;

    const margin = 4;
    let panelWidth = 280;
    let panelHeight = 40;

    try {
      const r = api.panel.getBoundingClientRect();
      if (r.width) panelWidth = r.width;
      if (r.height) panelHeight = r.height;
    } catch {
      // ignore
    }

    // Get viewport dimensions (works on mobile and desktop)
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

    // Try to place inside field, bottom-right first (most natural)
    let x = anchorRect.right - panelWidth - margin;
    let y = anchorRect.bottom + margin;

    // If it goes off-screen to the right, move left
    if (x + panelWidth > viewportWidth - margin) {
      x = Math.max(margin, anchorRect.left + margin);
      // If still doesn't fit, place outside to the left
      if (x + panelWidth > viewportWidth - margin) {
        x = viewportWidth - panelWidth - margin;
      }
    }

    // If it goes off-screen below, move above the field
    if (y + panelHeight > viewportHeight - margin) {
      y = Math.max(margin, anchorRect.top - panelHeight - margin);
    }

    // Final clamp to ensure widget stays in viewport
    x = clamp(x, margin, viewportWidth - panelWidth - margin);
    y = clamp(y, margin, viewportHeight - panelHeight - margin);

    api.wrap.style.left = `${Math.round(x)}px`;
    api.wrap.style.top = `${Math.round(y)}px`;
    api.wrap.style.transform = "none";
  }

export function setLoading(widgetHost, loading) {
    const api = widgetHost._aigf;
    api.state.loading = loading;

    api.fixBtn.innerHTML = loading ? ICON_SPINNER : ICON_FIX;
    api.fixBtn.setAttribute("aria-disabled", loading ? "true" : "false");
    api.undoBtn.setAttribute("aria-disabled", loading ? "true" : "false");
  }

export function setMessage(widgetHost, text) {
    const api = widgetHost._aigf;
    api.msg.textContent = text || "";
  }

export function setUndoVisible(widgetHost, visible) {
    const api = widgetHost._aigf;
    api.undoBtn.style.display = visible ? "" : "none";
  }

export function onFix(widgetHost, handler) {
    widgetHost._aigf.fixBtn.addEventListener("click", handler);
  }

export function onUndo(widgetHost, handler) {
    widgetHost._aigf.undoBtn.addEventListener("click", handler);
  }
