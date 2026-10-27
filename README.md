# mcp-abap-adt-clients

The repository of three packages, each with its README and CHANGELOG in its directory:

- [`packages/adt-clients`](packages/adt-clients/README.md) — `@mcp-abap-adt/adt-clients`, the ADT
  clients for SAP ABAP systems;
- [`packages/adt-strategies`](packages/adt-strategies/README.md) — `@mcp-abap-adt/adt-strategies`,
  the default result and failure strategies, derived from recorded ADT answers;
- [`packages/adt-clients-legacy`](packages/adt-clients-legacy/README.md) —
  `@mcp-abap-adt/adt-clients-legacy`, the clients for legacy systems (SAP_BASIS 7.40,
  measured on 7.40 SP04, over RFC only). It depends on `@mcp-abap-adt/adt-clients`
  `^37.4.0`; `adt-clients` holds no legacy code, and the consumer declares the system type by
  constructing `AdtClientLegacy` from it.

This root is private and holds only the tools that build, check and publish the packages.

The packages are npm workspaces: one install at the root, one lockfile. Every third-party package
comes from the registry; npm links only the workspace siblings to each other. Install scripts are
denied: `.npmrc` sets `strict-allow-scripts=true` (npm 11.19 or later), and `package.json` lists in
`allowScripts` every dependency of the lockfile that has an install script, each denied.

```bash
npm ci --ignore-scripts     # every package's dependencies
npm run build               # every package
npm run check               # build, type-check, lint, unit tests, packed contents, publish path
npm run release:publish     # publishes the packages whose version is not on the registry (the owner runs it)
npm run release:publish -- --dry-run   # the plan, and nothing published
```

At the root, `npm test` runs the unit suites of every package and needs no SAP system. The
integration suites run in `packages/adt-clients` against a real system:
[RUNNING_TESTS.md](packages/adt-clients/docs/development/RUNNING_TESTS.md).

Releases are tagged `<package directory>-v<version>` (`adt-clients-v<version>`,
`adt-strategies-v<version>`, `adt-clients-legacy-v<version>`). `release:publish` publishes in `publishOrder` (the root
`package.json`), only from a clean tree whose tags name `HEAD`, and only after `npm run check`
passed.
