import fs from "node:fs";
const url = process.env.VITE_SITE_URL;
if (!url || !/^https:\/\//.test(url))
  throw new Error("Set VITE_SITE_URL to your real public portal URL");
const base = url.replace(/\/$/, "");
const pages = [
  "",
  "/services",
  "/news",
  "/documents",
  "/events",
  "/now",
  "/help",
];
fs.writeFileSync(
  "public/sitemap.xml",
  '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' +
    pages
      .map(
        (p) => "<url><loc>" + base.replace(/&/g, "&amp;") + p + "</loc></url>",
      )
      .join("") +
    "</urlset>",
);
console.log("public/sitemap.xml generated for " + base);
fs.writeFileSync(
  "public/robots.txt",
  `User-agent: *\nDisallow: ${new URL(url).pathname}account/\nDisallow: ${new URL(url).pathname}staff/\nDisallow: ${new URL(url).pathname}admin/\nSitemap: ${base}/sitemap.xml\n`,
);
