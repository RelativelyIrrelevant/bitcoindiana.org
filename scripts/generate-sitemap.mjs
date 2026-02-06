// scripts/generate-sitemap.mjs
//
// Generates sitemap.xml and robots.txt from merchant-states.json + static pages.
// Run via: node scripts/generate-sitemap.mjs
// Or in GitHub Actions for auto-commit on push.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // repo root

const MERCHANT_STATES_JSON = path.join(ROOT, 'assets/data/merchant-states.json');
const SITEMAP_OUT = path.join(ROOT, 'sitemap.xml');
const ROBOTS_OUT = path.join(ROOT, 'robots.txt');

const BASE_URL = 'https://bitcoindiana.org';
const TODAY = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

// Priority & changefreq helpers
const getPriority = (slug) => {
  if (slug === 'indiana') return '0.9';
  if (['illinois', 'kentucky', 'michigan', 'ohio'].includes(slug)) return '0.8';
  return '0.7';
};

const getChangefreq = (slug) => (slug === 'indiana' ? 'weekly' : 'monthly');

async function main() {
  try {
    const raw = await fs.readFile(MERCHANT_STATES_JSON, 'utf-8');
    const registry = JSON.parse(raw);
    const states = registry.states || [];

    if (!states.length) throw new Error('No states in merchant-states.json');

    // Build URL entries
    const urls = [];

    // Default / flagship
    urls.push({
      loc: `${BASE_URL}/merchants/?state=indiana`,
      lastmod: TODAY,
      changefreq: 'weekly',
      priority: '0.9',
    });

    // All other states
    for (const st of states) {
      const slug = st.slug;
      if (slug === 'indiana') continue; // already added

      urls.push({
        loc: `${BASE_URL}/merchants/?state=${encodeURIComponent(slug)}`,
        lastmod: TODAY,
        changefreq: getChangefreq(slug),
        priority: getPriority(slug),
      });
    }

    // Static pages (add more as needed)
    const staticPages = [
      { loc: BASE_URL + '/', changefreq: 'monthly', priority: '1.0' },
      { loc: BASE_URL + '/meetups/', changefreq: 'monthly', priority: '0.8' },
      // { loc: BASE_URL + '/about/', changefreq: 'monthly', priority: '0.6' },
    ];

    staticPages.forEach(p => urls.push({ ...p, lastmod: TODAY }));

    // ── Generate sitemap.xml ────────────────────────────────────────────────
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    u => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${u.lastmod}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    await fs.writeFile(SITEMAP_OUT, xml.trim() + '\n', 'utf-8');
    console.log(`Wrote sitemap.xml with ${urls.length} URLs`);

    // ── Generate robots.txt ─────────────────────────────────────────────────
    const robots = `User-agent: *
Allow: /

Sitemap: ${BASE_URL}/sitemap.xml
`.trim();

    await fs.writeFile(ROBOTS_OUT, robots + '\n', 'utf-8');
    console.log('Wrote robots.txt');

  } catch (err) {
    console.error('Error generating sitemap:', err.message);
    process.exit(1);
  }
}

main();
