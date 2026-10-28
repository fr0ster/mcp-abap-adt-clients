/**
 * Format every recorded XML body under `corpus/adt/` in place
 * (`formatCorpusXml`): `npm run corpus:format`.
 *
 * Run it after adding recordings that were not captured through
 * `scripts/capture-adt-corpus.ts`, which formats what it writes.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { formatCorpusXml } from './lib/formatCorpusXml';

const CORPUS = path.join(__dirname, '..', 'corpus', 'adt');

const bodies = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return bodies(full);
    return entry.name.endsWith('.body.xml') ? [full] : [];
  });

let changed = 0;
for (const file of bodies(CORPUS)) {
  const text = fs.readFileSync(file, 'utf-8');
  const formatted = formatCorpusXml(text);
  if (formatted !== text) {
    fs.writeFileSync(file, formatted, 'utf-8');
    changed += 1;
  }
}
process.stdout.write(`corpus:format — ${changed} XML bodies formatted\n`);
