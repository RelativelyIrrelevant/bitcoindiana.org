// assets/js/playful-in.js
//
// Dedicated script for playful "IN" highlighting.
// Loads LAST so it runs AFTER router/map have updated text/links.
//
// - Wraps case-insensitive "in" in header title/intro
// - Hovering the word highlights the "in" part in BTC orange (via CSS)
// - Preserves existing HTML (links, etc.)
// - Safe single-pass: collects nodes first, then mutates

(function () {
  "use strict";

  function applyPlayfulIn() {
    console.log("[playful-in] Starting applyPlayfulIn");

    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) {
      console.log("[playful-in] No roots found");
      return;
    }
    console.log("[playful-in] Found", roots.length, "roots");

    const IN_RE = /in/gi;

    // Step 1: Clean old .in spans safely
    roots.forEach(root => {
      root.querySelectorAll(".in").forEach(span => {
        span.replaceWith(...span.childNodes);
      });
    });

    // Step 2: Collect all eligible text nodes FIRST (snapshot)
    const textNodes = [];

    roots.forEach(root => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        node => {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;
          if (parent.closest("a")) return NodeFilter.FILTER_REJECT; // protect links
          if (["SCRIPT","STYLE","CODE","PRE","NOSCRIPT","TEXTAREA"].includes(parent.tagName)) {
            return NodeFilter.FILTER_REJECT;
          }
          if (parent.classList.contains("in")) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }
      );

      while (walker.nextNode()) {
        const tn = walker.currentNode;
        const text = tn.nodeValue;
        if (text && text.trim() && IN_RE.test(text)) {
          textNodes.push(tn);
        }
      }
    });

    console.log("[playful-in] Collected", textNodes.length, "text nodes to wrap");

    // Step 3: Now mutate (safe, no live iteration)
    textNodes.forEach(tn => {
      const text = tn.nodeValue;
      IN_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0;
      let match;

      while ((match = IN_RE.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (start > last) {
          frag.appendChild(document.createTextNode(text.slice(last, start)));
        }

        const span = document.createElement("span");
        span.className = "in";
        span.textContent = text.slice(start, end);
        frag.appendChild(span);

        last = end;
      }

      if (last < text.length) {
        frag.appendChild(document.createTextNode(text.slice(last)));
      }

      tn.parentNode.replaceChild(frag, tn);
    });

    console.log("[playful-in] Completed");
  }

  // Run once after full load
  window.addEventListener("load", () => {
    console.log("[playful-in] Load event fired");
    applyPlayfulIn();
  });

  // Manual trigger if needed (type applyPlayfulIn() in console)
  window.applyPlayfulIn = applyPlayfulIn;
})();
