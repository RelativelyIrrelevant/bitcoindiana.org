// assets/js/site.js
//
// Shared lightweight behaviors for the entire site (no dependencies).
//
// Current feature:
// - Nav highlighting: sets aria-current="page" on the active topnav link
//   based on current URL path.

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

})();
