// Generates an original, hand-styled stand-up pouch illustration for a product
// (kraft-paper pouch with a window showing the powder colour, plus a leaf mark).
// If the owner has set a real photo URL for a product, that photo is used instead.
function jarSVG(hex, name, imageUrl) {
  if (imageUrl) {
    return `<img src="${imageUrl}" alt="${name}" style="width:100%;height:100%;object-fit:contain;" onerror="this.parentElement.innerHTML = pouchSVG('${hex}','${name.replace(/'/g, "")}')">`;
  }
  return pouchSVG(hex, name);
}
function pouchSVG(hex, name) {
  const safeId = 'g' + (hex || '#4C7A3D').replace('#', '');
  return `<svg viewBox="0 0 200 240" class="jar-svg" role="img" aria-label="${name}">
    <defs><linearGradient id="${safeId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#D9C4A0"/><stop offset="100%" stop-color="#C8A97E"/>
    </linearGradient></defs>
    <path d="M42 58 L42 208 Q42 224 58 224 H142 Q158 224 158 208 V58 Z" fill="url(#${safeId})" stroke="#8A6F4D" stroke-width="2"/>
    <line x1="58" y1="58" x2="58" y2="224" stroke="#8A6F4D" stroke-width="1" opacity="0.35"/>
    <line x1="142" y1="58" x2="142" y2="224" stroke="#8A6F4D" stroke-width="1" opacity="0.35"/>
    <rect x="42" y="52" width="116" height="12" rx="5" fill="#8A6F4D"/>
    <rect x="55" y="86" width="90" height="98" rx="10" fill="#FBF7EE" stroke="#C9A227" stroke-width="1.5"/>
    <circle cx="100" cy="130" r="27" fill="${hex}"/>
    <path d="M100 92 q9 15 0 24 q-9 -9 0 -24" fill="#3C6E52"/>
    <text x="100" y="172" text-anchor="middle" font-family="Fraunces, serif" font-weight="600" font-size="10" fill="#9C7A14" letter-spacing="1">SUNVORA</text>
  </svg>`;
}
function starString(avg) {
  const full = Math.round(avg || 0);
  return "★".repeat(full) + "☆".repeat(5 - full);
}