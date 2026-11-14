// Generates apps/web/src/styles/tokens.css from the design system's tokens.json.
// Dark is the primary theme on :root; light applies via prefers-color-scheme (unless data-theme="dark")
// and via data-theme="light".
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, 'tokens.json');
const out = path.join(__dirname, '../../apps/web/src/styles/tokens.css');
const T = JSON.parse(fs.readFileSync(src, 'utf8'));

const val = (v) => (typeof v === 'string' && /^\{[^}]+\}$/.test(v) ? `var(--${v.slice(1, -1)})` : v);
const themes = T.color.themes.map((t) => t.id);
const primary = themes[0];
const other = themes[1];

const colorLines = (theme) =>
  T.color.tokens.map((t) => {
    const v = typeof t.value === 'string' ? t.value : t.value[theme] ?? t.value[primary];
    return `  --${t.name}: ${val(v)};`;
  });

const fam = T.type.families;
const base = [
  `  --font-display: ${fam.display};`,
  `  --font-text: ${fam.text};`,
  `  --font-mono: ${fam.mono};`,
];
for (const family of ['spacing', 'radius', 'size', 'duration', 'easing', 'shadow']) {
  if (!T[family]) continue;
  for (const t of T[family].tokens) base.push(`  --${t.name}: ${t.value};`);
}

const css = [
  `/* ${T.name} — generated from packages/design-system/tokens.json by packages/design-system/build_tokens.cjs. Do not edit. */`,
  `:root {`,
  ...base,
  ...colorLines(primary),
  `  color-scheme: ${primary};`,
  `}`,
  `@media (prefers-color-scheme: ${other}) {`,
  `  :root:not([data-theme="${primary}"]) {`,
  ...colorLines(other).map((l) => '  ' + l),
  `    color-scheme: ${other};`,
  `  }`,
  `}`,
  `:root[data-theme="${other}"] {`,
  ...colorLines(other),
  `  color-scheme: ${other};`,
  `}`,
  `:root[data-theme="${primary}"] {`,
  ...colorLines(primary),
  `  color-scheme: ${primary};`,
  `}`,
  '',
].join('\n');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, css);
console.log('tokens.css written:', T.color.tokens.length, 'colours,', base.length, 'other tokens');
