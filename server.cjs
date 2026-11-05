// Runs the built dashboard online. It serves the pages from dist/ and passes /api, /images and
// /uploads to the shop's server, so the browser only ever talks to the dashboard's own address.
// That keeps the owner's sign-in on this site alone. Needs no packages beyond Node itself.
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { Readable } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const SHOP_URL = (process.env.KALACAR_SHOP_URL || "https://firebrick-squid-218523.hostingersite.com").replace(/\/$/, "");
const DIST = path.join(__dirname, "dist");
const PROXIED = /^\/(api|images|uploads)(\/|$)/;
const DROP_REQUEST = new Set(["host", "connection", "content-length", "transfer-encoding", "keep-alive", "upgrade", "accept-encoding", "x-forwarded-host"]);
// fetch has already unpacked the body, so its original encoding and length no longer apply.
const DROP_RESPONSE = new Set(["connection", "content-encoding", "content-length", "transfer-encoding", "keep-alive", "set-cookie"]);
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".ico": "image/x-icon", ".json": "application/json", ".woff2": "font/woff2" };

async function toShop(req, res) {
  const headers = {};
  for (const [name, value] of Object.entries(req.headers)) if (!DROP_REQUEST.has(name) && value !== undefined) headers[name] = Array.isArray(value) ? value.join(", ") : value;
  const forwardedHost = req.headers["x-forwarded-host"];
  headers["x-kalacar-dashboard-host"] = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost)?.split(",")[0].trim() || req.headers.host;
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  const upstream = await fetch(SHOP_URL + req.url, { method: req.method, headers, redirect: "manual", body: hasBody ? Readable.toWeb(req) : undefined, duplex: hasBody ? "half" : undefined });
  upstream.headers.forEach((value, name) => { if (!DROP_RESPONSE.has(name)) res.setHeader(name, value); });
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length) res.setHeader("set-cookie", cookies);
  res.writeHead(upstream.status);
  if (upstream.body && req.method !== "HEAD") await pipeline(Readable.fromWeb(upstream.body), res);
  else res.end();
}

function sendFile(res, file, cache) {
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": cache, "X-Content-Type-Options": "nosniff", "Referrer-Policy": "same-origin", "X-Robots-Tag": "noindex" });
  fs.createReadStream(file).pipe(res);
}

function page(req, res) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, "http://dashboard").pathname); } catch { res.writeHead(400).end(); return; }
  const file = path.join(DIST, pathname);
  const inside = file.startsWith(DIST + path.sep);
  if (inside && fs.statSync(file, { throwIfNoEntry: false })?.isFile()) return sendFile(res, file, pathname.startsWith("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  sendFile(res, path.join(DIST, "index.html"), "no-cache");
}

http.createServer((req, res) => {
  if (!PROXIED.test(req.url)) return page(req, res);
  toShop(req, res).catch(error => {
    console.error("Shop server unavailable:", error.message);
    if (!res.headersSent) { res.writeHead(502, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "The shop's server can't be reached. Try again in a moment." })); }
    else res.destroy();
  });
}).listen(Number(process.env.PORT) || 5173, () => console.log("Kalacar dashboard is running."));
