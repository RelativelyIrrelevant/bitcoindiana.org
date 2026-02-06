// assets/js/site.js
//
// Shared site behavior (tiny + dependency-free).
//
// Current features:
// 1. Highlight the current page in the top nav by setting aria-current="page"
//    on the matching <a data-nav="..."> link.
// 2. Playful "IN" highlight: wraps "in" (case-insensitive) inside header titles/intros
//    so that hovering the word containing "in" turns the "in" substring Bitcoin-orange
//    via CSS: .in-word:hover .in { color: #F7931A; }
//
// Site structure assumptions (current):
// - Merchants pages live at: /  /merchants  /merchants/...
// - Meetups pages live at:   /meetups  /meetups/...
//
// Important notes on playful "IN" highlighting:
// - Runs automatically once on DOMContentLoaded for static pages (/meetups/ etc.)
// - On /merchants/ pages, merchants-router.js overwrites #pageTitle and #pageIntro
//   using .textContent or innerHTML → this destroys any existing <span> wrappers.
// - Therefore we expose window.highlightPlayfulIn() so the router can call it *after*
//   it has finished updating the header text.
// - The function is idempotent-ish: it first strips old wrappers before re-applying.

(function () {
  // ── NAV HIGHLIGHTING ────────────────────────────────────────────────────────

  // Normalize the path so comparisons are consistent.
  // Examples: "/" stays "/", "/meetups/" → "/meetups", "/merchants///" → "/merchants"
  let path = window.location.pathname || "/";
  path = path.replace(/\/+$/, "") || "/";

  // Helper: true if path is exactly "/segment" OR starts with "/segment/"
  function isSection(segment) {
    return path === `/${segment}` || path.startsWith(`/${segment}/`);
  }

  // Map current URL path to nav key that matches data-nav attributes.
  // Treat "/" as Merchants (home page).
  const navKey =
    (path === "/" || isSection("merchants")) ? "merchants" :
    isSection("meetups")   ? "meetups" :
    isSection("events")    ? "events" :
    isSection("resources") ? "resources" :
    isSection("about")     ? "about" :
    null;

  if (navKey) {
    document.querySelectorAll(".topnav a[data-nav]").forEach(a => {
      if (a.dataset.nav === navKey) {
        a.setAttribute("aria-current", "page");
      } else {
        a.removeAttribute("aria-current");
      }
    });
  }

  // ── PLAYFUL "IN" HIGHLIGHTING ───────────────────────────────────────────────

  // This function can be called multiple times (e.g. after router updates text).
  // It first clears any previous .in / .in-word spans, then reapplies them.
  window.highlightPlayfulIn = function () {
    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) return;

    const IN_RE = /in/gi; // case-insensitive "in"
    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA"]);

    // Helper: wraps "in" substrings inside a single text node
    function wrapInTextNode(textNode) {
      const text = textNode.nodeValue;
      if (!text || !IN_RE.test(text)) return;

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

      textNode.parentNode.replaceChild(frag, textNode);
    }

    // Helper: processes one root element (h1 or p)
    function processElement(root) {
      // Step 1: Strip any existing .in / .in-word wrappers (prevents nesting)
      root.textContent = root.textContent;

      // Step 2: Walk text nodes (skip links, scripts, etc.)
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            if (parent.closest("a")) return NodeFilter.FILTER_REJECT; // protect links
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      for (const tn of textNodes) {
        const text = tn.nodeValue;
        const parts = text.split(/(\s+)/); // preserve whitespace
        const frag = document.createDocumentFragment();

        for (const part of parts) {
          if (part === "") continue;

          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            continue;
          }

          // Wrap word in hover container
          const wordSpan = document.createElement("span");
          wordSpan.className = "in-word";
          wordSpan.textContent = part;

          // If word contains "in", wrap the substring(s)
          if (IN_RE.test(part)) {
            IN_RE.lastIndex = 0;
            wrapInTextNode(wordSpan.firstChild);
          }

          frag.appendChild(wordSpan);
        }

        tn.parentNode.replaceChild(frag, tn);
      }
    }

    roots.forEach(processElement);
  };

  // Run once when the DOM is ready (covers static pages like /meetups/)
  document.addEventListener("DOMContentLoaded", () => {
    window.highlightPlayfulIn();
  });

})();   // end IIFE
