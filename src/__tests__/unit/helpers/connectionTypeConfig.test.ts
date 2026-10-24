/**
 * The wire comes from the configuration. One that cannot be read throws:
 * read as "http", a test would run on a wire nobody configured.
 */
let mockEnvironment: () => unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  getEnvironmentConfig: () => mockEnvironment(),
}));

import { getConfig, getConnectionType } from '../../helpers/sessionConfig';

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

describe('getConfig: the authentication type', () => {
  const KEYS = [
    'SAP_URL',
    'SAP_AUTH_TYPE',
    'SAP_USERNAME',
    'SAP_PASSWORD',
    'SAP_JWT_TOKEN',
  ];
  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    for (const key of KEYS) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
    process.env.SAP_URL = 'https://example';
    mockEnvironment = () => ({});
  });
  afterEach(() => {
    for (const key of KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('refuses a stated value outside basic, jwt, xsuaa, naming the key', () => {
    process.env.SAP_AUTH_TYPE = 'jwtt';
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(() => getConfig()).toThrow(/SAP_AUTH_TYPE is "jwtt"/);
  });

  it('refuses it on the RFC wire too', () => {
    mockEnvironment = () => ({ connection_type: 'rfc' });
    process.env.SAP_AUTH_TYPE = 'basik';
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(() => getConfig()).toThrow(/SAP_AUTH_TYPE is "basik"/);
  });

  it('takes a stated type as stated', () => {
    process.env.SAP_AUTH_TYPE = 'xsuaa';
    process.env.SAP_JWT_TOKEN = 'T';
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(getConfig().authType).toBe('jwt');
  });

  it('reads an absent type off credentials that leave no choice', () => {
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(getConfig().authType).toBe('basic');
    delete process.env.SAP_USERNAME;
    delete process.env.SAP_PASSWORD;
    process.env.SAP_JWT_TOKEN = 'T';
    expect(getConfig().authType).toBe('jwt');
  });

  it('refuses an absent type beside both a token and a user', () => {
    process.env.SAP_JWT_TOKEN = 'T';
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(() => getConfig()).toThrow(/state SAP_AUTH_TYPE/);
  });
});
