// assets/js/site.js
//
// Shared site behavior (tiny + dependency-free).
//
// Current features:
// - Highlight the current page in the top nav by setting aria-current="page"
//   on the matching <a data-nav="..."> link.
// - Optional playful "IN" highlight: wraps "in" inside header titles/intros so that
//   the "in" substring turns Bitcoin-orange when hovering the word.
//
// Site structure assumptions (current):
// - Merchants pages live at:
//     /
//     /merchants
//     /merchants/...
// - Meetups pages live at:
//     /meetups
//     /meetups/...

(function () {
  // Normalize the path so comparisons are consistent.
  // Examples:
  // - "/" stays "/"
  // - "/meetups/" becomes "/meetups"
  // - "/merchants///" becomes "/merchants"
  let path = window.location.pathname || "/";
  path = path.replace(/\/+$/, "") || "/";

  // Helper: true if path is exactly "/segment" OR starts with "/segment/"
  function isSection(segment) {
    return path === `/${segment}` || path.startsWith(`/${segment}/`);
  }

  // Map the current URL path to a nav key that matches data-nav attributes.
  // NOTE: We treat "/" as Merchants (home page).
  const navKey =
    (path === "/" || isSection("merchants")) ? "merchants" :
    isSection("meetups") ? "meetups" :
    isSection("events") ? "events" :
    isSection("resources") ? "resources" :
    isSection("about") ? "about" :
    null;

  if (navKey) {
    // Set aria-current="page" on the matching link; remove it from others.
    document.querySelectorAll(".topnav a[data-nav]").forEach(a => {
      if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  // --- Optional playful "IN" hover highlighting (header only) ---
  //
  // This wraps "in" (case-insensitive) inside header titles/intros so that when the user
  // hovers the *word* containing it, only that substring changes color via CSS:
  //   .in-word:hover .in { color: #F7931A; }
  //
  // IMPORTANT:
  // - We only target header content to keep it tasteful.
  // - We do NOT alter text inside <a> tags to avoid breaking links.
  (function () {
    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) return;

    // Matches "in" in any case (in/IN/In).
    // If you want uppercase-only later, change to: const IN_RE = /IN/g;
    const IN_RE = /in/gi;

    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA"]);

    function wrapInTextNode(textNode) {
      const text = textNode.nodeValue;
      if (!text || !IN_RE.test(text)) return;

      // Reset regex state (because /g)
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

      textNode.parentNode.replaceChild(frag, textNode);
    }

    function processElement(root) {
      // Walk only text nodes that are NOT inside an <a> (so we don't mess with links).
      const walker = document.createTreeWalker(
        root,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode(node) {
            const parent = node.parentElement;
            if (!parent) return NodeFilter.FILTER_REJECT;
            if (SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
            if (parent.closest("a")) return NodeFilter.FILTER_REJECT; // don't alter link text
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            return NodeFilter.FILTER_ACCEPT;
          }
        }
      );

      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);

      for (const tn of textNodes) {
        const text = tn.nodeValue;

        // Split into tokens while preserving whitespace
        const parts = text.split(/(\s+)/);

        const frag = document.createDocumentFragment();

        for (const part of parts) {
          if (part === "") continue;

          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
            continue;
          }

          // Wrap each token in a hoverable container
          const wordSpan = document.createElement("span");
          wordSpan.className = "in-word";
          wordSpan.textContent = part;

          // Wrap "in" inside that wordSpan (by converting its single text node)
          if (IN_RE.test(part)) {
            IN_RE.lastIndex = 0;
            wrapInTextNode(wordSpan.firstChild);
          } else {
            IN_RE.lastIndex = 0;
          }

          frag.appendChild(wordSpan);
        }

        tn.parentNode.replaceChild(frag, tn);
      }
    }

    roots.forEach(processElement);
  })();
})();
