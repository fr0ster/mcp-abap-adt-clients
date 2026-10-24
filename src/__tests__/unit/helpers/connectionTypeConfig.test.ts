/**
 * The wire comes from the configuration. One that cannot be read throws:
 * read as "http", a test would run on a wire nobody configured.
 */
let mockEnvironment: () => unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  getEnvironmentConfig: () => mockEnvironment(),
}));

import { getConnectionType } from '../../helpers/sessionConfig';

describe('getConnectionType', () => {
  it('answers the configured wire', () => {
    mockEnvironment = () => ({ connection_type: 'rfc' });
    expect(getConnectionType()).toBe('rfc');
    mockEnvironment = () => ({});
    expect(getConnectionType()).toBe('http');
  });

  it('throws when the configuration cannot be read', () => {
    mockEnvironment = () => {
      throw new Error(
        'test-config.overlay.yaml: environment.system is required',
      );
    };
    expect(() => getConnectionType()).toThrow(/environment.system is required/);
  });
});
