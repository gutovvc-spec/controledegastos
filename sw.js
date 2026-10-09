const CACHE = "gastos-v6";
const ARQUIVOS = ["./","./index.html","./manifest.webmanifest","./icon-192.png","./icon-512.png","./icon-maskable-512.png"];

self.addEventListener("install", e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>Promise.all(ARQUIVOS.map(a=>c.add(a).catch(()=>{}))))
      .then(()=>self.skipWaiting())
  );
});
self.addEventListener("activate", e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

// Só arquivos do próprio app (Supabase passa direto).
// Rede primeiro (pega versão nova); se estiver sem internet ou lenta (>4s), usa o cache.
function comTimeout(req, ms){
  return new Promise((ok,fail)=>{
    const t = setTimeout(()=>fail(new Error("timeout")), ms);
    fetch(req).then(r=>{ clearTimeout(t); ok(r); }, e=>{ clearTimeout(t); fail(e); });
  });
}
self.addEventListener("fetch", e=>{
  const req = e.request;
  if(req.method!=="GET" || new URL(req.url).origin!==location.origin) return;
  e.respondWith(
    comTimeout(req, 4000).then(res=>{
      if(res.ok){ const copia = res.clone(); caches.open(CACHE).then(c=>c.put(req,copia)); }
      return res;
    }).catch(()=>
      caches.match(req, {ignoreSearch:true}).then(r=> r || caches.match("./index.html") || caches.match("./"))
    )
  );
});
