import type { Plugin } from "vite";
export function pwa(): Plugin {
  let base = "/";
  return {
    name: "portal-pwa",
    configResolved(c) {
      base = c.base;
    },
    generateBundle(_, bundle) {
      const assets = Object.keys(bundle).filter(
        (p) => p.startsWith("assets/") || p === "index.html",
      );
      const files = [
        "offline.html",
        "logo.svg",
        "icons/icon-192.png",
        "icons/icon-512.png",
        ...assets,
      ].map((p) => base + p);
      const cache =
        "cherkasy-static-v2-" + base.replace(/\W/g, "") + "-" + Date.now();
      this.emitFile({
        type: "asset",
        fileName: "sw.js",
        source: `const CACHE=${JSON.stringify(cache)},FILES=${JSON.stringify(files)},BASE=${JSON.stringify(base)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('cherkasy-static-v2-'+BASE.replace(/\\W/g,'')+'-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==self.location.origin||e.request.headers.has('Authorization'))return;
if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).catch(()=>caches.match(BASE+'offline.html')));return;}
if(FILES.includes(u.pathname)&&!u.search){e.respondWith(caches.match(u.pathname).then(r=>r||fetch(e.request)));}
});`,
      });
      this.emitFile({
        type: "asset",
        fileName: "manifest.webmanifest",
        source: JSON.stringify({
          id: base,
          name: "Черкаси Цифрові",
          short_name: "Черкаси",
          lang: "uk",
          start_url: base,
          scope: base,
          display: "standalone",
          theme_color: "#087F72",
          background_color: "#f5faf7",
          icons: [
            {
              src: base + "icons/icon-192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: base + "icons/icon-512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        }),
      });
    },
  };
}
