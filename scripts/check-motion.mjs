// Motion guard (spec 6 / DoD): fails the build if src/ reintroduces a banned motion pattern.
// Tests are skipped because they spell the banned strings out in order to assert their absence.
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');

const RULES = [
  { name: 'transition: all', re: /transition:\s*all/ },
  { name: 'transition-all', re: /transition-all/ },
  // (?!-out): the token --ease-in-out is legitimate; only a bare ease-in (slow start, feels laggy) is banned.
  { name: 'ease-in (not ease-in-out)', re: /ease-in(?!-out)/ },
  { name: 'scale(0)', re: /scale\(0\)/ },
];

const SCANNED = /\.(css|tsx?|jsx?|html)$/;
const SKIPPED = /\.test\.[jt]sx?$/;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (SCANNED.test(entry.name) && !SKIPPED.test(entry.name)) yield full;
  }
}

const hits = [];
let files = 0;
for (const file of walk(srcDir)) {
  files++;
  readFileSync(file, 'utf8')
    .split('\n')
    .forEach((line, i) => {
      for (const rule of RULES) {
        if (rule.re.test(line)) hits.push(`${relative(root, file)}:${i + 1}  ${rule.name}  ->  ${line.trim()}`);
      }
    });
}

if (hits.length > 0) {
  console.error(`check:motion FAILED, ${hits.length} banned pattern(s):\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`check:motion OK (${files} files, ${RULES.length} rules)`);
