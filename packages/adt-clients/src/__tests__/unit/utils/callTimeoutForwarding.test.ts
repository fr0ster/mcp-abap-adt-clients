import type {
  IAbapConnection,
  IAbapRequestOptions,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { withCallTimeout } from '../../../utils/callTimeout';

/**
 * Y of #304: the deadline Proxy reads its target's members as `unknown` and
 * calls `makeAdtRequest` without a cast. What it forwards is unchanged:
 * the deadline on every request, every other method bound to the target, a
 * non-function member as it is, a member the contract does not name, and an
 * absent one.
 */
class Connection {
  readonly seen: IAbapRequestOptions[] = [];
  readonly label = 'plain value';
  private readonly secret = 'S';
  async makeAdtRequest(request: IAbapRequestOptions) {
    this.seen.push(request);
    return { status: 200, statusText: 'OK', headers: {}, data: this.secret };
  }
  async getBaseUrl() {
    return `https://${this.secret}.test`;
  }
  getSessionId() {
    return this.secret;
  }
  setSessionType() {}
  async connect() {}
  extra() {
    return this === undefined ? 'unbound' : this.secret;
  }
}

describe('withCallTimeout forwards as before', () => {
  const target = new Connection();
  const wrapped = withCallTimeout(target, 1500);
  const members: Record<string, unknown> = wrapped as unknown as Record<
    string,
    unknown
  >;

  it('puts the deadline on makeAdtRequest, over the request’s own', async () => {
    const answer = await wrapped.makeAdtRequest({
      url: '/u',
      method: 'GET',
      timeout: 0,
    });
    expect(answer.data).toBe('S');
    expect(target.seen.at(-1)).toEqual({
      url: '/u',
      method: 'GET',
      timeout: 1500,
    });
  });

  it('binds every other method to the target', async () => {
    const { getBaseUrl, getSessionId } = wrapped;
    expect(await getBaseUrl()).toBe('https://S.test');
    expect(getSessionId()).toBe('S');
  });

  it('binds a method the contract does not name', () => {
    const extra = members.extra;
    expect(typeof extra === 'function' && extra()).toBe('S');
  });

  it('reads a non-function member as it is', () => {
    expect(members.label).toBe('plain value');
  });

  it('reads an absent member as undefined', () => {
    expect(members.nothing).toBeUndefined();
  });

  it('answers the connection itself without a deadline', () => {
    const plain: IAbapConnection = new Connection();
    expect(withCallTimeout(plain, undefined)).toBe(plain);
  });
});
