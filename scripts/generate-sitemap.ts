// Runs before `vite build` (prebuild hook); writes public/sitemap.xml.
// Includes static routes and dynamic /post/:postId and /profile/:userId entries
// fetched from the public Supabase API. RLS restricts to publicly-readable rows.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://www.openflip.in";
const SUPABASE_URL = "https://rbgwfkmirxgsktwejlig.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJiZ3dma21pcnhnc2t0d2VqbGlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTY3MzQsImV4cCI6MjA4MzAzMjczNH0.l3RUfpg-AFK8-Urr9nI-MLDWeyeEbsk0bB3hZ1f7MF4";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/explore", changefreq: "daily", priority: "0.9" },
  { path: "/reels", changefreq: "daily", priority: "0.9" },
  { path: "/search", changefreq: "weekly", priority: "0.6" },
  { path: "/auth", changefreq: "monthly", priority: "0.5" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.6" },
  { path: "/privacy", changefreq: "yearly", priority: "0.3" },
  { path: "/terms", changefreq: "yearly", priority: "0.3" },
];

async function fetchRest(path: string): Promise<any[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function xmlEscape(s: string) {
  return s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" }[c]!));
}

function renderEntry(e: SitemapEntry) {
  return [
    `  <url>`,
    `    <loc>${xmlEscape(BASE_URL + e.path)}</loc>`,
    e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
    e.priority ? `    <priority>${e.priority}</priority>` : null,
    `  </url>`,
  ]
    .filter(Boolean)
    .join("\n");
}

async function main() {
  const [posts, profiles] = await Promise.all([
    fetchRest("posts?select=id&limit=10000"),
    fetchRest("profiles?select=id,username,is_private&limit=10000"),
  ]);

  const dynamicEntries: SitemapEntry[] = [
    ...posts.map((p: any) => ({ path: `/post/${p.id}`, changefreq: "weekly" as const, priority: "0.7" })),
    ...profiles
      .filter((p: any) => !p.is_private)
      .map((p: any) => ({ path: `/profile/${p.username}`, changefreq: "weekly" as const, priority: "0.6" })),
  ];

  const all = [...staticEntries, ...dynamicEntries];
  const xml = [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...all.map(renderEntry),
    `</urlset>`,
  ].join("\n");

  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(`sitemap.xml written (${all.length} entries: ${staticEntries.length} static + ${dynamicEntries.length} dynamic)`);
}

main();
