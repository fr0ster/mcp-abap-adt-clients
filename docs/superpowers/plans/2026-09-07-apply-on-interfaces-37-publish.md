# Apply on `@mcp-abap-adt/interfaces@37.0.0` publish

**Goal:** close the gap between what `AdtServiceBinding` demands and what the
contract a consumer holds demands.

**Blocked on:** [interfaces#74](https://github.com/fr0ster/mcp-abap-adt-interfaces/pull/74)
being merged, released and published to npm. Nothing here can land before that,
and PR #138 must not merge before it either.

## Why this file exists rather than the change

PR #138 already sweeps all 76 write-atom type arguments onto the shape 37.0.0
asks for, including `IAdtUpdatable<IServiceBindingPublicationConfig, …>` on the
binding. Under the installed 36.0.0 that line is *forward-compatible but not yet
in force*: the atom still applies `Partial` internally, so the contract a
consumer holds resolves to `Partial<IServiceBindingPublicationConfig>` and still
admits a call with no `bindingName`, no `serviceType` and no
`desiredPublicationState`. The class refuses it; the interface does not, because
method parameters are bivariant.

The test that would catch this cannot be committed yet — it is only an error
once the dependency moves. Measured, both halves:

| installed contract | the atom-level bad call | result |
|---|---|---|
| 36.0.0 (`Partial<TConfig>`) | compiles | `error TS2578: Unused '@ts-expect-error'` — 1 error, branch red |
| 37.0.0 build (`TConfig`) | refused | 0 errors in this file; dropping the directive gives `TS2345: '{ desiredPublicationState: "published" }' is not assignable to 'IServiceBindingPublicationConfig'` |

Measured with a `paths` override onto the local 37.0.0 build. Nothing was
installed and the lockfile was not touched.

## Steps

- [ ] **1. Bump the dependency.** `@mcp-abap-adt/interfaces` to `^37.0.0` in
  `package.json`, then `npm install --package-lock-only`, then confirm
  `package-lock.json` has no `"link": true`.

- [ ] **2. Correct the floor in the changelog.** `CHANGELOG.md`, the 18.0.0
  section: `Requires @mcp-abap-adt/interfaces@^36.0.0` → `^37.0.0`.

- [ ] **3. Apply the atom-level test.** The patch is in this session's
  scratchpad as `atom-level-test.patch`; if it is gone, it is these three edits
  to `src/__tests__/unit/core/service/publicationSignature.test.ts`:

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
   * Every other check in this file calls `AdtServiceBinding.update` directly,
   * and a class can always narrow its own parameter. The consumer does not hold
   * the class — they hold the atom, and TypeScript's method parameters are
   * bivariant, so a narrowing the atom does not carry is a narrowing nobody
   * outside this package is held to.
   */
  type BindingPublication = IAdtUpdatable<
    IServiceBindingPublicationConfig,
    string
  >;
  ```

  and, inside `_onlyTypeChecked`, taking `contract: BindingPublication` as a
  second parameter:

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

- [ ] **4. Verify.** `npx tsc --noEmit -p tsconfig.test.json` → 0 errors;
  `npm run build`; `MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit`
  → 110 suites green. Then prove the new assertion has teeth by deleting the
  `@ts-expect-error` line and confirming `TS2345`; restore it.

- [ ] **5. Re-run the full cloud integration suite** on the branch head, and
  update PR #138's numbers and its blocking notice.

- [ ] **6. Delete this file.** Per `CLAUDE.md`, plans live in the tree only
  while active.
