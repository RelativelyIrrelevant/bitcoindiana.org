// assets/js/site.js
//
// Shared site behavior (tiny + dependency-free).
//
// Current features:
// - Highlight the current page in the top nav by setting aria-current="page"
//   on the matching <a data-nav="..."> link.
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

  if (!navKey) return;

  // Set aria-current="page" on the matching link; remove it from others.
  document.querySelectorAll(".topnav a[data-nav]").forEach(a => {
    if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
})();
