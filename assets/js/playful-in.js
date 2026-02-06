// assets/js/playful-in.js
//
// Dedicated script for playful "IN" highlighting.
// Loads LAST on merchants pages so it runs AFTER router/map have finished updating text/links.
//
// - Wraps case-insensitive "in" in header title/intro
// - Hovering the word highlights the "in" part in BTC orange (via CSS)
// - Preserves existing HTML (links, etc.)
// - Re-applies if content changes (MutationObserver fallback)

(function () {
  "use strict";

  function applyPlayfulIn() {
    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) return;

    const IN_RE = /in/gi;

    // Clean old .in spans (unwrap safely)
    roots.forEach(root => {
      root.querySelectorAll(".in").forEach(span => {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        parent.removeChild(span);
      });
    });

    // Simple walk + wrap
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent) return;
        if (parent.closest("a")) return; // protect link text
        if (["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA"].includes(parent.tagName)) return;

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
      if (node.tagName === "A") return; // don't recurse into links

      for (const child of node.childNodes) {
        walk(child);
      }
    }

    roots.forEach(walk);
  }

  // Run once on full load (after deferred scripts)
  window.addEventListener("load", applyPlayfulIn);

  // Fallback: observe changes to title/intro (in case router re-runs or map updates)
  const observer = new MutationObserver(applyPlayfulIn);
  observer.observe(document.body, { childList: true, subtree: true });

  // Expose for manual call if needed
  window.applyPlayfulIn = applyPlayfulIn;
})();
