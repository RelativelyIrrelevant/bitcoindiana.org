// assets/js/playful-in.js
//
// Dedicated script for playful "IN" highlighting.
// Loads LAST so it runs AFTER router/map have updated text/links.
//
// - Wraps case-insensitive "in" in header title/intro
// - Hovering the word highlights the "in" part in BTC orange (via CSS)
// - Preserves existing HTML (links, etc.)

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

    // Step 1: Clean old .in spans
    let cleaned = 0;
    roots.forEach(root => {
      root.querySelectorAll(".in").forEach(span => {
        span.replaceWith(...span.childNodes);
        cleaned++;
      });
    });
    console.log("[playful-in] Cleaned", cleaned, "old .in spans");

    // Step 2: Collect text nodes that contain "in"
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
          return NodeFilter.FILTER_ACCEPT;
        }
      );

      while (walker.nextNode()) {
        const tn = walker.currentNode;
        const text = tn.nodeValue || "";
        if (text.trim() && IN_RE.test(text)) {
          textNodes.push(tn);
          console.log("[playful-in] Collected text node:", text.trim().substring(0, 30) + "...");
        }
      }
    });

    console.log("[playful-in] Collected", textNodes.length, "text nodes containing 'in'");

    // Step 3: Wrap
    let wrappedCount = 0;
    textNodes.forEach(tn => {
      const text = tn.nodeValue;
      IN_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let last = 0;
      let match;

      while ((match = IN_RE.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (start > last) frag.appendChild(document.createTextNode(text.slice(last, start)));

        const span = document.createElement("span");
        span.className = "in";
        span.textContent = text.slice(start, end);
        frag.appendChild(span);

        last = end;
        wrappedCount++;
      }

      if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

      tn.parentNode.replaceChild(frag, tn);
    });

    console.log("[playful-in] Wrapped", wrappedCount, "'in' occurrences");
    console.log("[playful-in] applyPlayfulIn completed");
  }

  // Run once after full load, but delay the highlighting by 2 seconds
  window.addEventListener("load", () => {
    console.log("[playful-in] Load event fired");
    setTimeout(applyPlayfulIn, 2000); // 2 seconds delay
  });

  // Manual trigger (type applyPlayfulIn() in console for re-test)
  window.applyPlayfulIn = applyPlayfulIn;
})();
