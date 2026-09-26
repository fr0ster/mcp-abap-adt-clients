/**
 * The LOCK and version-history wire functions of accessControl,
 * appendStructure, authorizationField, behaviorDefinition,
 * behaviorImplementation, dataElement and domain answer SAP's reply as it
 * came. The handle is `lockHandleOf`'s to read and the feed is the result
 * strategy's; a transport failure goes back unchanged for the caller's
 * `analyse`. See `tableVersions.test.ts` for the reference.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { lockAccessControl } from '../../../core/accessControl/lock';
import {
  getAccessControlVersionSource,
  getAccessControlVersions,
} from '../../../core/accessControl/versions';
import { lockAppendStructure } from '../../../core/appendStructure/lock';
import { getAppendStructureVersions } from '../../../core/appendStructure/versions';
import { lockAuthorizationField } from '../../../core/authorizationField/lock';
import { lock as lockBehaviorDefinition } from '../../../core/behaviorDefinition/lock';
import { getBehaviorDefinitionVersions } from '../../../core/behaviorDefinition/versions';
import { getBehaviorImplementationVersions } from '../../../core/behaviorImplementation/versions';
import { lockDataElement } from '../../../core/dataElement/lock';
import { lockDomain } from '../../../core/domain/lock';

function conn(handler: (o: any) => Promise<IAdtWireResponse>): IAbapConnection {
  return { makeAdtRequest: handler } as unknown as IAbapConnection;
}

// A 200 carrying no LOCK_HANDLE: these functions used to throw "Failed to
// extract lock handle" on it; now the answer goes back for the member to read.
const NO_HANDLE = '<asx:abap><asx:values><DATA/></asx:values></asx:abap>';

const LOCKS: Array<
  [string, (c: IAbapConnection) => Promise<IAdtWireResponse>, string]
> = [
  [
    'accessControl',
    (c) => lockAccessControl(c, 'ZDCL'),
    '/acm/dcl/sources/zdcl?_action=LOCK',
  ],
  [
    'appendStructure',
    (c) => lockAppendStructure(c, 'ZAPP'),
    '/ddic/structures/zapp?_action=LOCK',
  ],
  [
    'authorizationField',
    (c) => lockAuthorizationField(c, 'zauth'),
    '/aps/iam/auth/ZAUTH?_action=LOCK',
  ],
  [
    'behaviorDefinition',
    (c) => lockBehaviorDefinition(c, 'ZBDEF'),
    '/bo/behaviordefinitions/zbdef?_action=LOCK',
  ],
  [
    'dataElement',
    (c) => lockDataElement(c, 'ZDTEL'),
    '/ddic/dataelements/zdtel?_action=LOCK',
  ],
  ['domain', (c) => lockDomain(c, 'ZDOMA'), '/ddic/domains/zdoma?_action=LOCK'],
];

describe.each(LOCKS)('%s lock', (_name, lock, urlPart) => {
  it('POSTs the LOCK and answers it as it came, handle or not', async () => {
    let seen: any;
    const reply = {
      data: NO_HANDLE,
      status: 200,
      headers: {},
    } as IAdtWireResponse;
    const answer = await lock(
      conn(async (o) => {
        seen = o;
        return reply;
      }),
    );
    expect(seen.method).toBe('POST');
    expect(seen.url).toContain(urlPart);
    expect(answer).toBe(reply);
  });

  it('lets a refusal through as the transport raised it', async () => {
    const err: any = new Error('locked');
    err.response = { status: 403 };
    await expect(
      lock(
        conn(async () => {
          throw err;
        }),
      ),
    ).rejects.toBe(err);
  });
});

const FEED = '<feed xmlns="http://www.w3.org/2005/Atom"/>';

const VERSIONS: Array<
  [string, (c: IAbapConnection) => Promise<IAdtWireResponse>, string]
> = [
  [
    'accessControl',
    (c) => getAccessControlVersions(c, { accessControlName: 'ZDCL' }),
    '/sap/bc/adt/acm/dcl/sources/zdcl/source/main/versions',
  ],
  [
    'appendStructure',
    (c) => getAppendStructureVersions(c, { appendStructureName: 'ZAPP' }),
    '/sap/bc/adt/ddic/structures/zapp/source/main/versions',
  ],
  [
    'behaviorDefinition',
    (c) => getBehaviorDefinitionVersions(c, { name: 'ZBDEF' }),
    '/sap/bc/adt/bo/behaviordefinitions/zbdef/source/main/versions',
  ],
  [
    'behaviorImplementation',
    (c) => getBehaviorImplementationVersions(c, { className: 'ZBP_X' }),
    '/sap/bc/adt/oo/classes/ZBP_X/includes/implementations/versions',
  ],
];

describe.each(VERSIONS)('%s versions', (_name, versions, url) => {
  it('GETs the feed with the atom Accept and answers it as it came', async () => {
    let seen: any;
    const answer = await versions(
      conn(async (o) => {
        seen = o;
        return { data: FEED, status: 200, headers: {} } as IAdtWireResponse;
      }),
    );
    expect(seen.url).toBe(url);
    expect(seen.headers.Accept).toContain('application/atom+xml;type=feed');
    // `objectVersions` in adt-strategies reads it.
    expect(answer.data).toBe(FEED);
  });

  it('lets a 404 through as the transport raised it, not as a library error', async () => {
    const err: any = new Error('not found');
    err.response = { status: 404 };
    await expect(
      versions(
        conn(async () => {
          throw err;
        }),
      ),
    ).rejects.toBe(err);
  });
});

describe('version source', () => {
  it('GETs the contentUri as text and answers it as it came', async () => {
    let seen: any;
    const answer = await getAccessControlVersionSource(
      conn(async (o) => {
        seen = o;
        return {
          data: '@EndUserText',
          status: 200,
          headers: {},
        } as IAdtWireResponse;
      }),
      '/sap/bc/adt/x/00000/content',
    );
    expect(seen.url).toBe('/sap/bc/adt/x/00000/content');
    expect(seen.headers.Accept).toBe('text/plain');
    expect(answer.data).toBe('@EndUserText');
  });
});
