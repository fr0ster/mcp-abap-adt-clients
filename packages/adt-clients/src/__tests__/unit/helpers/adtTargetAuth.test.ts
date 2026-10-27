/**
 * The hand-run scripts' target: SAP_AUTH_TYPE is required and taken as
 * stated — missing, or outside basic / jwt / xsuaa, the script stops naming
 * the key; the mode is never read off the credentials.
 */
import { configOf, type ITarget } from '../../../../scripts/lib/adtTarget';

const target = (env: Record<string, string>): ITarget => ({
  label: 'x',
  file: 'x.env',
  kind: 'onprem',
  env: { SAP_URL: 'https://example', ...env },
});

let stderr: jest.SpyInstance;
let exit: jest.SpyInstance;
beforeEach(() => {
  stderr = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  exit = jest.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`);
  }) as never);
});
afterEach(() => {
  stderr.mockRestore();
  exit.mockRestore();
});

const said = () => stderr.mock.calls.map((c) => String(c[0])).join('');

describe('configOf: the authentication type', () => {
  it('stops on a missing SAP_AUTH_TYPE, even beside a token alone', () => {
    expect(() => configOf(target({ SAP_JWT_TOKEN: 'T' }))).toThrow('exit 2');
    expect(said()).toMatch(/SAP_AUTH_TYPE is not set/);
  });

  it('stops on a value outside the set', () => {
    expect(() =>
      configOf(
        target({ SAP_AUTH_TYPE: 'jwtt', SAP_USERNAME: 'U', SAP_PASSWORD: 'P' }),
      ),
    ).toThrow('exit 2');
    expect(said()).toMatch(/SAP_AUTH_TYPE is "jwtt"/);
  });

  it('takes a stated type as stated', () => {
    expect(
      configOf(
        target({
          SAP_AUTH_TYPE: 'basic',
          SAP_USERNAME: 'U',
          SAP_PASSWORD: 'P',
          SAP_JWT_TOKEN: 'T',
        }),
      ).authType,
    ).toBe('basic');
    expect(
      configOf(target({ SAP_AUTH_TYPE: 'xsuaa', SAP_JWT_TOKEN: 'T' })).authType,
    ).toBe('jwt');
  });
});
