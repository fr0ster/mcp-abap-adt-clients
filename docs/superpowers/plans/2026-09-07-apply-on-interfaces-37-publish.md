# Restore the binding's write atom on `@mcp-abap-adt/interfaces@37.0.0`

**Goal:** `AdtServiceBinding` declares `IAdtUpdatable` again, and the demand it
makes through the contract is the same one it makes on the class.

**Blocked on:** [interfaces#74](https://github.com/fr0ster/mcp-abap-adt-interfaces/pull/74)
merged, released and published to npm.

## State on the branch

The declaration is **removed**, not merely flagged. `AdtServiceBinding`'s
`implements` clause lists every atom it can honour under the installed
`36.0.0`, and `IAdtUpdatable` is not one of them: that version applies `Partial`
to the config inside the atom, so declaring
`IAdtUpdatable<IServiceBindingPublicationConfig, …>` there would publish a
contract admitting `update({})`. The class refuses that call; an atom-typed
reference to the same object would not, because method parameters are bivariant.
Claiming an atom this package cannot honour is worse than claiming none.

Nothing else advertised it: no alias composes the binding out of atoms, and
`AdtClient.getServiceBinding()` returns `AdtServiceBinding<R>` itself, whose
`update` takes `IServiceBindingPublicationConfig`. So the consumer-facing demand
is correct today — it is simply not restatable as an atom until the dependency
moves.

Measured, with a `paths` override onto the local 37.0.0 build (nothing
installed, lockfile untouched):

| installed contract | the bad call, through the atom | result |
|---|---|---|
| `36.0.0` — `Partial<TConfig>` | compiles | `TS2578: Unused '@ts-expect-error'` |
| `37.0.0` — `TConfig` | refused | `TS2345: '{ desiredPublicationState: "published" }' is not assignable to 'IServiceBindingPublicationConfig'` |

## Steps

- [ ] **1. Install the dependency — really install it.**

  ```bash
  npm install @mcp-abap-adt/interfaces@^37.0.0
  ```

  `npm install --package-lock-only` is not enough here and would make step 4
  lie: it rewrites the lockfile and leaves `node_modules` on `36.0.0`, so `tsc`
  would still read the old declaration, the atom-level call would still compile,
  and the new assertion would fail with `TS2578` — a red build reported as a
  contract defect when it is an install that never happened.

  Then confirm the installed version and that no dependency resolves locally:

  ```bash
  node -p "require('@mcp-abap-adt/interfaces/package.json').version"
  grep -n '"link": true' package-lock.json || echo "no local links"
  ```

- [ ] **2. Correct the floor in the changelog.** `CHANGELOG.md`, the 18.0.0
  section: `Requires @mcp-abap-adt/interfaces@^36.0.0` → `^37.0.0`.

- [ ] **3. Restore the declaration.** In `src/core/service/AdtService.ts`,
  replace the comment block in the `implements` clause with the line it stands
  in for, between `IAdtMetadataReadable` and `IAdtDeletable`:

  ```typescript
  IAdtUpdatable<IServiceBindingPublicationConfig, ReturnType<R['updated']>>,
  ```

- [ ] **4. Add the assertion that holds it.** In
  `src/__tests__/unit/core/service/publicationSignature.test.ts` — every check
  there calls `AdtServiceBinding.update` directly, and a class can always narrow
  its own parameter, which is why they pass while the atom is widened. This one
  goes through the contract:

  ```typescript
  import type {
    IAbapConnection,
    IAdtUpdatable,
    ILogger,
  } from '@mcp-abap-adt/interfaces';
  import type { IServiceBindingPublicationConfig } from '../../../../core/service/types';

  /**
   * The same demand, made through the contract rather than the class.
   *
   * The consumer does not hold the class — they hold the atom, and TypeScript's
   * method parameters are bivariant, so a narrowing the atom does not carry is
   * a narrowing nobody outside this package is held to.
   */
  type BindingPublication = IAdtUpdatable<
    IServiceBindingPublicationConfig,
    string
  >;
  ```

  and, giving `_onlyTypeChecked` a second parameter `contract: BindingPublication`:

  ```typescript
  // Through the atom. If the installed contract still applies `Partial` to the
  // config, this call compiles and the `@ts-expect-error` is what fails.
  // @ts-expect-error the contract requires the binding, the state and the protocol
  void (await contract.update({ desiredPublicationState: 'published' }));

  void (await contract.update({
    bindingName: 'ZAC_SRVB01',
    desiredPublicationState: 'published',
    serviceType: 'odatav4',
  }));
  ```

- [ ] **5. Verify, and prove the assertion has teeth.**

  ```bash
  npx tsc --noEmit -p tsconfig.test.json   # expect 0 errors
  npm run build
  MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit   # 110 suites
  ```

  Then delete the `@ts-expect-error` line, re-run `tsc`, and confirm `TS2345`
  naming `IServiceBindingPublicationConfig`. Restore it. An assertion whose
  teeth were never checked is a comment.

- [ ] **6. Re-run the full cloud integration suite** on the branch head — the
  dependency changed under 1737 tests — and update PR #138's numbers and its
  blocking notice.

- [ ] **7. Delete this file.** Per `CLAUDE.md`, plans live in the tree only
  while active.
