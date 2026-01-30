// assets/js/site.js
//
// Shared site behavior (tiny + dependency-free).
//
// Current features:
// - Highlight the current page in the top nav by setting aria-current="page"
//   on the matching <a data-nav="..."> link.
//
// Site structure assumptions (current):
// - Merchants page is reachable at both:
//     /
//     /merchants/   (or /merchants)
// - Meetups page is reachable at:
//     /meetups/     (or /meetups)

(function () {
  // Normalize the path so comparisons are consistent.
  // Examples:
  // - "/" stays "/"
  // - "/meetups/" becomes "/meetups"
  // - "/merchants///" becomes "/merchants"
  let path = window.location.pathname || "/";
  path = path.replace(/\/+$/, "") || "/";

  // Map the current URL path to a nav key that matches data-nav attributes.
  // NOTE: We treat BOTH "/" and "/merchants" as the Merchants page.
  const navKey =
    (path === "/" || path === "/merchants") ? "merchants" :
    path.startsWith("/meetups") ? "meetups" :
    path.startsWith("/events") ? "events" :
    path.startsWith("/resources") ? "resources" :
    path.startsWith("/about") ? "about" :
    null;

  // If we don't recognize the path, do nothing (no nav highlight).
  if (!navKey) return;

  // Set aria-current="page" on the matching link; remove it from others.
  document.querySelectorAll(".topnav a[data-nav]").forEach(a => {
    if (a.dataset.nav === navKey) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
})();
