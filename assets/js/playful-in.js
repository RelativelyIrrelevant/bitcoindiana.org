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
    console.log("playful-in.js: starting applyPlayfulIn");

    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) {
      console.log("playful-in.js: no roots found");
      return;
    }

    const IN_RE = /in/gi;

    // Step 1: Clean old .in spans safely (unwrap without losing text)
    roots.forEach(root => {
      root.querySelectorAll(".in").forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) {
          parent.insertBefore(span.firstChild, span);
        }
        parent.removeChild(span);
      });
    });

    // Step 2: Collect all eligible text nodes FIRST (snapshot to avoid mutation issues)
    const textNodesToProcess = [];

    roots.forEach(root => {
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (parent.closest("a")) return NodeFilter.FILTER_REJECT; // protect links
            if (["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) {
              return NodeFilter.FILTER_REJECT;
            }
            if (parent.classList.contains("in")) return NodeFilter.FILTER_REJECT; // skip already wrapped
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      while (walker.nextNode()) {
        const tn = walker.currentNode;
        if (tn.nodeValue && IN_RE.test(tn.nodeValue)) {
          textNodesToProcess.push(tn);
        }
      }
    });

    console.log("playful-in.js: found", textNodesToProcess.length, "text nodes to process");

    // Step 3: Process collected nodes (mutations are now safe)
    textNodesToProcess.forEach(tn => {
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

    console.log("playful-in.js: applyPlayfulIn completed");
  }

  // Run once after full page load (after all deferred scripts)
  window.addEventListener("load", () => {
    console.log("playful-in.js: load event fired");
    applyPlayfulIn();
  });

  // Expose for manual testing in console if needed
  window.applyPlayfulIn = applyPlayfulIn;
})();
