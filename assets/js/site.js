// assets/js/site.js
//
// Shared site behavior.
// Keep it tiny + dependency-free so every page can include it.
//
// Current features:
// - Highlight current page in the top nav using aria-current="page".

(function () {
  const path = window.location.pathname;

  // Map current path to nav key.
  // Notes:
  // - GitHub Pages generally serves folder URLs with trailing slash (/meetups/).
  // - We treat "/" as the Map page.
  const navKey =
    path === "/" ? "map" :
    path.startsWith("/meetups") ? "meetups" :
    path.startsWith("/events") ? "events" :
    path.startsWith("/resources") ? "resources" :
    path.startsWith("/about") ? "about" :
    null;

  if (!navKey) return;

  document.querySelectorAll(".topnav a[data-nav]").forEach(a => {
    if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page");
  });
})();

