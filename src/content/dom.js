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

function getReactFiber(el) {
  // Find React Fiber key
  const fiberKeys = Object.keys(el).filter(key => key.startsWith("__react"));
  if (fiberKeys.length === 0) return null;
  
  return el[fiberKeys[0]];
}

function triggerReactValue(el, text) {
  try {
    // Try to find React Fiber and update its state
    const fiber = getReactFiber(el);
    if (!fiber) return false;
    
    // Traverse up to find the component with state
    let current = fiber;
    while (current) {
      // Look for useState state or memoizedState
      if (current.memoizedState) {
        // Found a component with state - it's holding the value
        // Force update by triggering a setter through events
        return true; // Signal that we found React
      }
      current = current.return;
    }
    
    return false;
  } catch {
    return false;
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

      const isWhatsApp = window.location.hostname.includes("web.whatsapp.com");

      if (isWhatsApp) {
        // WhatsApp strategy: Use actual Clipboard API + paste event
        // This forces React to update its state because paste is a legitimate user action
        try {
          el.focus();
          
          // Select all text in the element
          const range = document.createRange();
          range.selectNodeContents(el);
          const sel = window.getSelection();
          if (sel) {
            sel.removeAllRanges();
            sel.addRange(range);
          }
          
          // Use the real Clipboard API to copy paste data
          const clipboardData = new DataTransfer();
          clipboardData.setData("text/plain", text);
          
          // Create and dispatch a paste event with the clipboard data
          const pasteEvent = new ClipboardEvent("paste", {
            bubbles: true,
            cancelable: true,
            clipboardData: clipboardData
          });
          
          const handled = el.dispatchEvent(pasteEvent);
          
          if (!handled) {
            // If paste event wasn't handled, manually set the text
            // Clear existing content
            while (el.firstChild) {
              el.removeChild(el.firstChild);
            }
            
            // Add text as textContent
            el.textContent = text;
            
            // Force React update with explicit events
            setTimeout(() => {
              try {
                // Simulate the full input sequence
                el.dispatchEvent(new InputEvent("beforeinput", {
                  bubbles: true,
                  cancelable: true,
                  inputType: "insertFromPaste",
                  data: text
                }));
                
                el.dispatchEvent(new InputEvent("input", {
                  bubbles: true,
                  inputType: "insertFromPaste",
                  data: text
                }));
                
                el.dispatchEvent(new Event("change", { bubbles: true }));
              } catch {
                // ignore
              }
            }, 5);
          }
          
          // Position caret at end and maintain focus
          setTimeout(() => {
            try {
              if (document.activeElement !== el) {
                el.focus();
              }
              
              const range = document.createRange();
              range.selectNodeContents(el);
              range.collapse(false);
              const sel = window.getSelection();
              if (sel) {
                sel.removeAllRanges();
                sel.addRange(range);
              }
            } catch {
              // ignore
            }
          }, 10);
        } catch (err) {
          // Fallback: simple textContent
          try {
            el.textContent = text;
            el.focus();
          } catch {
            // ignore
          }
        }
      } else {
        // Non-WhatsApp sites
        // Clear and add text
        while (el.firstChild) {
          el.removeChild(el.firstChild);
        }
        
        const textNode = el.ownerDocument.createTextNode(text);
        el.appendChild(textNode);
        
        // Dispatch events
        requestAnimationFrame(() => {
          dispatchRichInputEvent(el, text);
          dispatchInputEvents(el);
        });
        
        // Place caret at end
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
