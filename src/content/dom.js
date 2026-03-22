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

      // Detect if this is WhatsApp Web (has specific data attributes or structure)
      const isWhatsApp = el.getAttribute("data-testid")?.includes("chat") || 
                         el.getAttribute("data-testid")?.includes("message") ||
                         el.closest("[data-testid*='message']") ||
                         el.closest(".x1hx0egp") ||
                         el.getAttribute("data-testid") === "input-chatbox-input" ||
                         el.closest("[data-testid='input-chatbox-input']") ||
                         el.className?.includes("x1hx0egp") ||
                         window.location.hostname.includes("web.whatsapp.com");
      

      
      // Clear all children first
      while (el.firstChild) {
        el.removeChild(el.firstChild);
      }

      if (isWhatsApp) {
        // Function to apply text safely
        const applyText = () => {
          // Clear all children
          while (el.firstChild) {
            el.removeChild(el.firstChild);
          }
          
          // Create text node
          const textNode = el.ownerDocument.createTextNode(text);
          el.appendChild(textNode);
        };
        
        // Apply text immediately
        applyText();
        
        // Dispatch composition events (WhatsApp listens to these)
        requestAnimationFrame(() => {
          try {
            el.dispatchEvent(new CompositionEvent("compositionstart", { bubbles: true }));
            
            el.dispatchEvent(new InputEvent("beforeinput", {
              bubbles: true,
              cancelable: true,
              inputType: "insertComposedText",
              data: text
            }));
            
            el.dispatchEvent(new InputEvent("input", {
              bubbles: true,
              cancelable: true,
              inputType: "insertComposedText",
              data: text
            }));
            
            el.dispatchEvent(new CompositionEvent("compositionend", {
              bubbles: true,
              data: text
            }));
            
            el.dispatchEvent(new Event("change", { bubbles: true }));
          } catch (e) {
            // Event dispatch error, continue
          }
        });
        
        // Use MutationObserver to detect and fix React reversions
        let observer;
        const startWatching = () => {
          observer = new MutationObserver(() => {
            const currentText = el.textContent;
            // If text changed or was cleared, reapply
            if (currentText !== text) {
              applyText();
              
              // Re-dispatch events after reapplication
              setTimeout(() => {
                try {
                  el.dispatchEvent(new InputEvent("input", {
                    bubbles: true,
                    inputType: "insertComposedText",
                    data: text
                  }));
                  el.dispatchEvent(new Event("change", { bubbles: true }));
                } catch (e) {
                  // Event error, continue
                }
              }, 10);
            }
          });
          
          observer.observe(el, {
            characterData: true,
            childList: true,
            subtree: true
          });
          
          // Stop watching after 3 seconds
          const watchTimeout = setTimeout(() => {
            if (observer) {
              observer.disconnect();
            }
          }, 3000);
          
          // Store for cleanup if needed
          el.__watchTimeout = watchTimeout;
          el.__observer = observer;
        };
        
        startWatching();
      } else {
        // For other sites (ChatGPT, etc.) - use text node
        const textNode = el.ownerDocument.createTextNode(text);
        el.appendChild(textNode);
      }

      // Dispatch events to notify React/frameworks of the change
      requestAnimationFrame(() => {
        if (!isWhatsApp) {
          // For non-WhatsApp sites only
          dispatchRichInputEvent(el, text);
          dispatchInputEvents(el);
        }
        // WhatsApp events already dispatched above
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
