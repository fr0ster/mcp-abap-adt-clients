/**
 * The wire comes from the configuration. One that cannot be read throws:
 * read as "http", a test would run on a wire nobody configured.
 */
let mockEnvironment: () => unknown;

jest.mock('../../helpers/test-helper', () => ({
  ...jest.requireActual('../../helpers/test-helper'),
  getEnvironmentConfig: () => mockEnvironment(),
}));

import {
  getConfig,
  getConnectionType,
  requiredEnvironmentFlag,
} from '../../helpers/sessionConfig';

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

  it('refuses a missing type, whatever the credentials, naming the key', () => {
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(() => getConfig()).toThrow(/SAP_AUTH_TYPE is not set/);
    delete process.env.SAP_USERNAME;
    delete process.env.SAP_PASSWORD;
    process.env.SAP_JWT_TOKEN = 'T';
    expect(() => getConfig()).toThrow(/SAP_AUTH_TYPE is not set/);
  });

  it('refuses a missing type on the RFC wire too', () => {
    mockEnvironment = () => ({ connection_type: 'rfc' });
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    expect(() => getConfig()).toThrow(/SAP_AUTH_TYPE is not set/);
  });

  it('takes basic as stated', () => {
    process.env.SAP_AUTH_TYPE = 'basic';
    process.env.SAP_USERNAME = 'U';
    process.env.SAP_PASSWORD = 'P';
    process.env.SAP_JWT_TOKEN = 'T';
    expect(getConfig().authType).toBe('basic');
  });
});

describe('requiredEnvironmentFlag', () => {
  it('answers a stated boolean', () => {
    mockEnvironment = () => ({ read_message_class_after_create: false });
    expect(requiredEnvironmentFlag('read_message_class_after_create')).toBe(
      false,
    );
  });

  it('refuses a missing or non-boolean value, naming the key', () => {
    mockEnvironment = () => ({});
    expect(() =>
      requiredEnvironmentFlag('read_message_class_after_create'),
    ).toThrow(/environment\.read_message_class_after_create is not set/);
    mockEnvironment = () => ({ read_message_class_after_create: 'true' });
    expect(() =>
      requiredEnvironmentFlag('read_message_class_after_create'),
    ).toThrow(/is not set \(found "true"\)/);
  });
});
