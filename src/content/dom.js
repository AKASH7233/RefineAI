export function isEditableElement(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;

    const tag = el.tagName;
    if (tag === "TEXTAREA") return true;

    if (tag === "INPUT") {
      const type = (el.getAttribute("type") || "text").toLowerCase();
      // Text-like inputs only.
      return [
        "text",
        "search",
        "email",
        "url",
        "tel",
        "password",
        "number"
      ].includes(type);
    }

    if (el.isContentEditable) return true;

    return false;
  }

export function getEditableTargetFromEvent(eventTarget) {
    if (!eventTarget) return null;

    // Prefer the element that triggered the focus event.
    const input = eventTarget.closest?.("input, textarea");
    if (isEditableElement(input)) return input;

    const ce = eventTarget.closest?.(
      "[contenteditable='true'], [contenteditable=''], [contenteditable]"
    );
    if (isEditableElement(ce)) return ce;

    // Prefer the exact active element.
    const active = document.activeElement;
    if (isEditableElement(active)) return active;

    return null;
  }

export function getText(el) {
    if (!el) return "";

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      return el.value ?? "";
    }

    if (el.isContentEditable) {
      // Use innerText to match what the user sees.
      return el.innerText ?? "";
    }

    return "";
  }

function dispatchInputEvents(el) {
    try {
      // Dispatch input event
      el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
      // Dispatch change event
      el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
      // For React, also try beforeinput
      el.dispatchEvent(new Event("beforeinput", { bubbles: true, cancelable: true }));
    } catch {
      // ignore
    }
  }

function dispatchRichInputEvent(el, text) {
  try {
    // InputEvent with insertComposedText for better React compatibility
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertComposedText",
        data: text
      })
    );
    // Also try insertReplacementText
    el.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        inputType: "insertReplacementText",
        data: text
      })
    );
  } catch {
    // ignore
  }
}

function placeCaretAtEnd(contentEditableEl) {
    try {
      const range = document.createRange();
      range.selectNodeContents(contentEditableEl);
      range.collapse(false);
      const sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(range);
    } catch {
      // ignore
    }
  }

export function setText(el, text) {
    if (!el) {
      console.log("⚠️ setText: no element");
      return;
    }

    if (el.tagName === "TEXTAREA" || el.tagName === "INPUT") {
      const hadFocus = document.activeElement === el;
      const start = el.selectionStart;
      const end = el.selectionEnd;

      el.value = text;
      dispatchInputEvents(el);

      // Keep selection stable when possible; otherwise move caret to end.
      try {
        if (hadFocus && typeof start === "number" && typeof end === "number") {
          const pos = Math.min(text.length, end);
          el.setSelectionRange(pos, pos);
        }
      } catch {
        // ignore
      }

      return;
    }

    if (el.isContentEditable) {
      try {
        el.focus();
      } catch {
        // ignore
      }

      console.log("🔄 Clearing contenteditable, setting text:", text.substring(0, 50));
      
      // Detect if this is WhatsApp Web (has specific data attributes or structure)
      const isWhatsApp = el.getAttribute("data-testid")?.includes("chat") || 
                         el.getAttribute("data-testid")?.includes("message") ||
                         el.closest("[data-testid*='message']") ||
                         el.closest(".x1hx0egp"); // WhatsApp Web container class
      
      console.log("🌐 Detected WhatsApp:", !!isWhatsApp);
      
      // Method 1: Clear all children and set textContent  
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }
      
      // Method 2: Create a new text node and append
      const textNode = el.ownerDocument.createTextNode(text);
      el.appendChild(textNode);
      
      console.log("📝 After appendChild:", el.textContent.substring(0, 50));

      // For WhatsApp, try mutating the innerHTML as well
      if (isWhatsApp) {
        console.log("⚙️  WhatsApp detected - using innerHTML fallback");
        el.innerHTML = text;
      }

      // Dispatch events to notify React/frameworks of the change
      requestAnimationFrame(() => {
        dispatchRichInputEvent(el, text);
        dispatchInputEvents(el);
        
        // For WhatsApp, also dispatch more events
        if (isWhatsApp) {
          try {
            el.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "a" }));
            el.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: "a" }));
          } catch {
            // ignore
          }
        }
        
        console.log("📢 Events dispatched");
      });

      // Place caret at the end if the field is active
      setTimeout(() => {
        if (document.activeElement === el) {
          try {
            placeCaretAtEnd(el);
          } catch {
            // ignore
          }
        }
      }, 0);
    }
  }

export function getAnchorRect(el) {
  let cur = el;

  for (let i = 0; i < 6 && cur; i += 1) {
    try {
      const rect = cur.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) return rect;
    } catch {
      // ignore
    }

    cur = cur.parentElement;
  }

  return null;
  }
