// After `expo export --platform web`: add iPhone "Add to Home Screen" tags and a 404 fallback for GitHub Pages.
const fs = require("fs");
const path = require("path");
const dist = path.join(__dirname, "..", "dist");
const base = (process.env.EXPO_BASE_URL || "").replace(/\/$/, "");
const file = path.join(dist, "index.html");
let html = fs.readFileSync(file, "utf8");
html = html.replace(
  /<meta name="viewport"[^>]*>/,
  '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover" />',
);
html = html.replace('<html lang="en">', '<html lang="hy">');
html = html.replace(
  "</head>",
  [
    `<link rel="manifest" href="${base}/manifest.json">`,
    `<link rel="apple-touch-icon" href="${base}/apple-touch-icon.png">`,
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="apple-mobile-web-app-title" content="Hovo">',
    "<style>body{background:#f5f7f6}</style>",
    "</head>",
  ].join("\n"),
);
fs.writeFileSync(file, html);
fs.writeFileSync(path.join(dist, "404.html"), html);
fs.writeFileSync(path.join(dist, ".nojekyll"), "");
console.log("PWA tags added", base || "/");
