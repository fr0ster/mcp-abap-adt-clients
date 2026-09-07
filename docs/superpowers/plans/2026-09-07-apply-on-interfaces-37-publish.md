# Close the publication type hole on `@mcp-abap-adt/interfaces@37.0.0`

**Goal:** the demand `AdtServiceBinding.update` makes on the class is the same
demand it makes through the contract a consumer holds.

**Blocked on:** [interfaces#74](https://github.com/fr0ster/mcp-abap-adt-interfaces/pull/74)
merged, released and published to npm.

**Executed inside PR #138, before it merges — not as a post-merge follow-up.**
Merging without it would ship 18.0.0 in an intermediate API state and cost a
second breaking change to restore a capability the binding already has.

## The hole, and what does not close it

Under the installed `36.0.0`, `IAdtUpdatable` applies `Partial` to the config
inside the atom. So a consumer who holds the binding as
`IAdtUpdatable<IServiceBindingPublicationConfig, string>` can write
`update({})`: it compiles and throws before the wire. The class refuses the same
call, because its own `update` takes `IServiceBindingPublicationConfig` — a
class can always narrow its own parameter, and method parameters are bivariant,
so the narrowing does not travel.

**Dropping `implements IAdtUpdatable` does not close it.** That was tried on
this branch and reverted. TypeScript is structural: the class has a compatible
`update`, so it stays assignable to the atom with or without the clause.
Measured — with the clause removed, this still compiled clean:

```typescript
const asAtom: IAdtUpdatable<IServiceBindingPublicationConfig, string> = binding;
void (await asAtom.update({}));
```

All that removal achieved was deleting an honest declaration of a capability the
binding genuinely has. A binding's `update` **is** its publication job; the atom
belongs there. The only thing that closes the hole is the dependency.

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

- [ ] **3. Add the assertion that holds it.** In
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

- [ ] **4. Verify, and prove the assertion has teeth.**

  ```bash
  npx tsc --noEmit -p tsconfig.test.json   # expect 0 errors
  npm run build
  MCP_ENV_PATH=/tmp/nonexistent-env npx jest src/__tests__/unit   # 110 suites
  ```

  Then delete the `@ts-expect-error` line, re-run `tsc`, and confirm `TS2345`
  naming `IServiceBindingPublicationConfig`. Restore it. An assertion whose
  teeth were never checked is a comment.

- [ ] **5. Re-run the full cloud integration suite** on the branch head — the
  dependency changed under 1737 tests — and update PR #138's numbers, then
  remove its blocking notice — at that point it is no longer blocked.

- [ ] **6. Delete this file.** Per `CLAUDE.md`, plans live in the tree only
  while active.
