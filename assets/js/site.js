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
// Important notes on playful "IN" highlighting:
// - Runs automatically once on DOMContentLoaded for static pages (/meetups/ etc.)
// - On /merchants/ pages, merchants-router.js updates #pageTitle and #pageIntro
//   (using innerHTML for links) → we must preserve <a> tags and other markup.
// - We walk and process only text nodes that need wrapping, skipping anything inside <a>
// - No global reset of content (avoids destroying links)
// - Small optimization: skip nodes already inside .in-word or .in spans

(function () {
  // ── NAV HIGHLIGHTING ────────────────────────────────────────────────────────

  // Normalize path for consistent comparison
  let path = window.location.pathname || "/";
  path = path.replace(/\/+$/, "") || "/";

  // Helper: true if path is exactly "/segment" OR starts with "/segment/"
  function isSection(segment) {
    return path === `/${segment}` || path.startsWith(`/${segment}/`);
  }

  // Map URL path to nav key matching data-nav attributes
  // Treat "/" as Merchants (home page)
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

  window.highlightPlayfulIn = function () {
    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) return;

    const IN_RE = /in/gi;
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

    // Process a single text node
    function processTextNode(tn) {
      const parent = tn.parentElement;
      if (!parent) return;

      // Skip protected tags and anything inside links
      if (SKIP_TAGS.has(parent.tagName)) return;
      if (parent.closest("a")) return;

      // Small improvement: skip if already wrapped in .in-word or .in
      if (parent.classList.contains("in-word") || parent.classList.contains("in")) {
        return;
      }

      const text = tn.nodeValue;
      if (!text || !text.trim()) return;

      // Only process if contains "in"
      if (!IN_RE.test(text)) return;
      IN_RE.lastIndex = 0;

      wrapInTextNode(tn);
    }

    roots.forEach(root => {
      // Tree walker to find text nodes safely
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const p = node.parentElement;
            if (!p) return NodeFilter.FILTER_REJECT;
            if (SKIP_TAGS.has(p.tagName)) return NodeFilter.FILTER_REJECT;
            if (p.closest("a")) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      // Collect nodes first (to avoid live DOM mutations during walking)
      const textNodes = [];
      while (walker.nextNode()) {
        textNodes.push(walker.currentNode);
      }

      // Process collected nodes
      textNodes.forEach(processTextNode);
    });
  };

  // Run once when DOM is ready (covers static pages like /meetups/)
  document.addEventListener("DOMContentLoaded", () => {
    window.highlightPlayfulIn();
  });

})();
