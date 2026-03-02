// Generate simple SVG icons and convert to PNG data URIs for the manifest
const fs = require('fs');
const sizes = [16, 48, 128];
for (const size of sizes) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${size * 0.2}" fill="#1d9bf0"/>
    <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="${size * 0.5}" fill="white">XR</text>
  </svg>`;
  fs.writeFileSync(`public/icons/icon${size}.svg`, svg);
  // For Chrome, we need PNGs — use SVGs for now and note in README
  fs.copyFileSync(`public/icons/icon${size}.svg`, `public/icons/icon${size}.png`);
}
console.log('Icons generated (SVG placeholders)');
