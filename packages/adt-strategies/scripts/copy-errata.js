// Ships adt-clients' ERRATA.md with this package. The document lives once, in
// docs/usage; the copy is made at pack time and never committed. Its relative
// links point at siblings this package does not carry, so they are rewritten to
// the repository on GitHub.
const fs = require('node:fs');
const path = require('node:path');

const source = path.resolve(__dirname, '../../../docs/usage/ERRATA.md');
const target = path.resolve(__dirname, '../ERRATA.md');
const base =
  'https://github.com/fr0ster/mcp-abap-adt-clients/blob/main/docs/usage/';

const text = fs
  .readFileSync(source, 'utf8')
  .replace(
    /\]\((?!https?:|#|mailto:)([^)]+)\)/g,
    (_, link) => `](${new URL(link, base).href})`,
  );
fs.writeFileSync(target, text);
