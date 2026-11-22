/**
 * The abapGit live suite loads adt-clients, adt-strategies and connection
 * only from `ABAPGIT_CLIENT_UNDER_TEST`: a workspace path is refused, for the
 * client and the connection alike, and so is any file outside the install.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  installRootOf,
  isInside,
  loadAbapGitModules,
  originLabelFromEnv,
  refusalFor,
  resolveInsideInstall,
  UNDER_TEST_VARIABLE,
  WORKSPACE_ROOT,
} from '../../helpers/abapGitUnderTest';

describe('the abapGit live suite loads only the isolated install', () => {
  let install: string;
  let outside: string;

  /** A fake install: one file per package, resolved by the injected resolver. */
  function fakePackage(root: string, name: string): string {
    const dir = join(root, 'node_modules', ...name.split('/'));
    mkdirSync(dir, { recursive: true });
    const file = join(dir, 'index.js');
    writeFileSync(file, 'module.exports = {};\n');
    return file;
  }

  beforeAll(() => {
    install = mkdtempSync(join(tmpdir(), 'abapgit-under-test-'));
    outside = mkdtempSync(join(tmpdir(), 'abapgit-elsewhere-'));
  });

  afterAll(() => {
    rmSync(install, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  it('refuses a resolved file inside the workspace — the client and the connection alike', () => {
    for (const specifier of [
      '@mcp-abap-adt/adt-clients',
      '@mcp-abap-adt/connection',
    ]) {
      const refusal = refusalFor(
        specifier,
        join(WORKSPACE_ROOT, 'packages/adt-clients/dist/index.js'),
        install,
      );
      expect(refusal).toMatch(/inside the workspace/);
      expect(refusal).toContain(specifier);
    }
  });

  it('refuses a resolved file outside the install', () => {
    expect(
      refusalFor('@mcp-abap-adt/connection', join(outside, 'x.js'), install),
    ).toMatch(/outside/);
    expect(
      refusalFor('@mcp-abap-adt/connection', join(install, 'x.js'), install),
    ).toBeUndefined();
  });

  it('refuses an install root inside the workspace, and a relative one', () => {
    expect(() =>
      installRootOf(join(WORKSPACE_ROOT, 'packages/adt-clients')),
    ).toThrow(/overlaps the workspace/);
    expect(() => installRootOf('relative/dir')).toThrow(/absolute/);
    expect(installRootOf(install)).toBe(install);
  });

  it('checks every package and what each resolves of the others', () => {
    const files = new Map<string, string>();
    for (const name of [
      '@mcp-abap-adt/adt-clients',
      '@mcp-abap-adt/adt-clients/abapgit',
      '@mcp-abap-adt/adt-strategies',
      '@mcp-abap-adt/connection',
      '@mcp-abap-adt/interfaces-adt',
      '@mcp-abap-adt/interfaces-adt-connection',
    ])
      files.set(name, fakePackage(install, name));
    const inside = (specifier: string) => files.get(specifier) as string;
    expect(Object.keys(resolveInsideInstall(install, inside))).toEqual([
      '@mcp-abap-adt/adt-clients',
      '@mcp-abap-adt/adt-strategies',
      '@mcp-abap-adt/connection',
      '@mcp-abap-adt/adt-clients/abapgit',
    ]);

    // The connection from the workspace: refused, naming it.
    const workspaceConnection = (specifier: string) =>
      specifier === '@mcp-abap-adt/connection'
        ? join(WORKSPACE_ROOT, 'package.json')
        : inside(specifier);
    expect(() => resolveInsideInstall(install, workspaceConnection)).toThrow(
      /@mcp-abap-adt\/connection resolved to .* inside the workspace/,
    );

    // adt-clients' own adt-strategies from elsewhere: refused too.
    const strayStrategies = (specifier: string, from: string) =>
      specifier === '@mcp-abap-adt/adt-strategies' && from !== install
        ? fakePackage(outside, specifier)
        : inside(specifier);
    expect(() => resolveInsideInstall(install, strayStrategies)).toThrow(
      /adt-strategies \(as .* resolves it\) resolved to .* outside/,
    );
  });

  it('refuses a workspace directory named as the install before loading anything', () => {
    expect(() =>
      loadAbapGitModules({ [UNDER_TEST_VARIABLE]: WORKSPACE_ROOT }),
    ).toThrow(/overlaps the workspace/);
  });

  it('names the workspace build in the title when the variable is unset', () => {
    expect(originLabelFromEnv({})).toMatch(/workspace build/);
    expect(originLabelFromEnv({ [UNDER_TEST_VARIABLE]: install })).toBe(
      `the isolated install at ${install}`,
    );
  });

  it('reads containment by path segments, not by prefix', () => {
    expect(isInside('/a/b', '/a/b/c')).toBe(true);
    expect(isInside('/a/b', '/a/bc')).toBe(false);
    expect(isInside('/a/b', '/a')).toBe(false);
  });
});
