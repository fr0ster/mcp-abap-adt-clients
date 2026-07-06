import { AdtAbapGitClient } from '../../index.abapgit';
import { AdtClientBatch } from '../../index.batch';
import { AdtClient } from '../../index.core';
import { AdtExecutor } from '../../index.executors';
import { AdtRuntimeClient } from '../../index.runtime';
import { AdtClientsWS } from '../../index.ws';

describe('subpath barrels', () => {
  it('each group barrel resolves its primary export', () => {
    expect(typeof AdtClient).toBe('function');
    expect(typeof AdtClientsWS).toBe('function');
    expect(typeof AdtAbapGitClient).toBe('function');
    expect(typeof AdtRuntimeClient).toBe('function');
    expect(typeof AdtClientBatch).toBe('function');
    expect(typeof AdtExecutor).toBe('function');
  });
});
