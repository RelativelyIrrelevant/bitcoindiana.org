// assets/js/playful-in.js
//
// Dedicated script for playful "IN" highlighting.
// Loads LAST on merchants pages so it runs AFTER router updates text/links.
//
// Features:
// - Wraps case-insensitive "in" in header title/intro
// - Hovering the word highlights the "in" part in BTC orange (via CSS)
// - Preserves existing HTML (links, etc.)
// - Safe to run on already-processed content (skips wrapped nodes)

(function () {
  "use strict";

  // Run once DOM is ready + all other scripts have likely finished
  document.addEventListener("DOMContentLoaded", () => {
    applyPlayfulIn();
  });

  // Also run immediately if called manually (e.g. from router)
  window.applyPlayfulIn = applyPlayfulIn;

  function applyPlayfulIn() {
    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) return;

    const IN_RE = /in/gi;

    // Unwrap any old .in spans (flatten without losing text)
    roots.forEach(root => {
      root.querySelectorAll(".in").forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      });
    });

    // Recursive walk to find & wrap text nodes
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent) return;

        // Skip inside links and protected tags
        if (parent.closest("a")) return;
        if (["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) return;

        // Skip if parent is already a wrapper
        if (parent.classList.contains("in")) return;

        const text = node.nodeValue;
        if (!text || !IN_RE.test(text)) return;

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
        }

        if (last < text.length) frag.appendChild(document.createTextNode(text.slice(last)));

        node.parentNode.replaceChild(frag, node);
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      // Don't recurse into <a>
      if (node.tagName === "A") return;

      for (const child of node.childNodes) {
        walk(child);
      }
    }

    roots.forEach(walk);
  }
})();
