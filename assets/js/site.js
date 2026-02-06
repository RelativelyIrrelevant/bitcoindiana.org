// assets/js/site.js
//
// Shared lightweight behaviors for the entire site (no dependencies).
//
// Features:
// 1. Nav highlighting: sets aria-current="page" on the active topnav link
//    based on current URL path.
// 2. Playful "IN" highlighting: wraps case-insensitive "in" substrings in header
//    titles and intros so hovering the containing word turns "in" Bitcoin-orange
//    (CSS: .in-word:hover .in { color: #F7931A; }).
//
// Important timing notes:
// - Runs once on DOMContentLoaded for static pages (/meetups/, etc.).
// - For /merchants/ pages: merchants-router.js updates #pageTitle and #pageIntro
//   using innerHTML (inserting <a> links) → we must preserve those links.
// - highlightPlayfulIn() is designed to be called multiple times safely.
// - It cleans old spans first, then processes only unwrapped text nodes outside links.

(function () {
  "use strict";

  // ── NAV HIGHLIGHTING ────────────────────────────────────────────────────────

  // Normalize path (remove trailing slashes, handle root)
  let path = window.location.pathname || "/";
  path = path.replace(/\/+$/, "") || "/";

  // Helper: matches exact "/segment" or starts with "/segment/"
  function isSection(segment) {
    return path === `/${segment}` || path.startsWith(`/${segment}/`);
  }

  // Determine active nav section ("/" counts as merchants)
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

  // Exposed function so merchants-router.js can call it after updating text
  window.highlightPlayfulIn = function () {
    const roots = document.querySelectorAll(".header-content .page-title, .header-content .page-intro");
    if (!roots.length) return;

    const IN_RE = /in/gi;
    const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "NOSCRIPT", "TEXTAREA"]);

    // Wrap all "in" occurrences inside a single text node
    function wrapInTextNode(textNode) {
      const text = textNode.nodeValue;
      if (!text || !IN_RE.test(text)) return;

      IN_RE.lastIndex = 0;

      const frag = document.createDocumentFragment();
      let lastIndex = 0;
      let match;

      while ((match = IN_RE.exec(text)) !== null) {
        const start = match.index;
        const end = start + match[0].length;

        if (start > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, start)));
        }

        const span = document.createElement("span");
        span.className = "in";
        span.textContent = text.slice(start, end);
        frag.appendChild(span);

        lastIndex = end;
      }

      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }

      textNode.parentNode.replaceChild(frag, textNode);
    }

    // Recursively walk the DOM and process text nodes
    function walk(node) {
      if (node.nodeType === Node.TEXT_NODE) {
        const parent = node.parentElement;
        if (!parent) return;

        // Skip protected tags and anything inside or part of a link
        if (SKIP_TAGS.has(parent.tagName)) return;
        if (parent.closest("a")) return;

        // Small optimization: skip already processed wrappers
        if (parent.classList.contains("in") || parent.classList.contains("in-word")) {
          return;
        }

        const text = node.nodeValue.trim();
        if (text && IN_RE.test(text)) {
          IN_RE.lastIndex = 0;
          wrapInTextNode(node);
        }
        return;
      }

      if (node.nodeType !== Node.ELEMENT_NODE) return;

      // Don't recurse into <a> elements (protect link text)
      if (node.tagName === "A") return;

      // Process children
      for (const child of node.childNodes) {
        walk(child);
      }
    }

    roots.forEach(root => {
      // Step 1: Clean up any old .in / .in-word spans from previous runs
      // (unwrap them without losing text)
      root.querySelectorAll(".in, .in-word").forEach(el => {
        const parent = el.parentNode;
        while (el.firstChild) {
          parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
      });

      // Step 2: Walk and apply new highlighting to current text nodes
      walk(root);
    });
  };

  // Auto-run once when the DOM is fully loaded (covers static pages)
  document.addEventListener("DOMContentLoaded", () => {
    window.highlightPlayfulIn();
  });

})();
