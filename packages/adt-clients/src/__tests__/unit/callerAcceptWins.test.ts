/**
 * A read member that takes `options.accept` sends the caller's Accept; the
 * library's own type is the default only when the caller gives none.
 *
 * Three members did otherwise: the class metadata read (and so every class
 * include's, which reads the class) replaced the caller's `accept` with the
 * content types' class Accept, and the authorization field read and the
 * function include metadata read sent a fixed Accept whatever the caller
 * gave. A caller on a system that serves another type — 7.40 SP04 answers the
 * class metadata only for `application/vnd.sap.adt.oo.classes+xml` — could
 * not choose it.
 */

import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_AUTHORIZATION_FIELD,
  ACCEPT_FUNCTION_INCLUDE,
} from '../../constants/contentTypes';
import { AdtAuthorizationField } from '../../core/authorizationField/AdtAuthorizationField';
import { authorizationFieldDocuments } from '../../core/authorizationField/types';
import { AdtClass } from '../../core/class/AdtClass';
import { AdtLocalTypes } from '../../core/class/AdtLocalTypes';
import { classDocuments } from '../../core/class/types';
import { AdtFunctionInclude } from '../../core/functionInclude/AdtFunctionInclude';
import { functionIncludeDocuments } from '../../core/functionInclude/types';
import { AdtContentTypesModern } from '../../core/shared/contentTypes';
import { expectResult } from '../helpers/contract';

const CALLER = 'application/x-callers-choice';

/** A connection that answers 200 and keeps the Accept of each request. */
function recording(): { connection: IAbapConnection; accepts: string[] } {
  const accepts: string[] = [];
  const connection = {
    makeAdtRequest: async (request: { headers?: Record<string, string> }) => {
      accepts.push(request.headers?.Accept ?? '');
      return { data: '<doc/>', status: 200, headers: {} } as IAdtWireResponse;
    },
    setSessionType: () => {},
  } as unknown as IAbapConnection;
  return { connection, accepts };
}

const contentTypes = new AdtContentTypesModern();

const members: {
  name: string;
  read: (connection: IAbapConnection, accept?: string) => Promise<unknown>;
  fallback: string;
}[] = [
  {
    name: 'AdtClass.readMetadata (with content types)',
    read: async (connection, accept) =>
      expectResult(
        await new AdtClass(
          connection,
          undefined,
          undefined,
          contentTypes,
          undefined,
          classDocuments,
        ).readMetadata(
          { className: 'ZCL_X' },
          accept === undefined ? {} : { accept },
        ),
        'read',
      ),
    fallback: contentTypes.classRead().accept,
  },
  {
    name: 'AdtLocalTypes.readMetadata (with content types)',
    read: async (connection, accept) =>
      expectResult(
        await new AdtLocalTypes(
          connection,
          undefined,
          undefined,
          contentTypes,
          undefined,
          classDocuments,
        ).readMetadata(
          { className: 'ZCL_X' },
          accept === undefined ? {} : { accept },
        ),
        'read',
      ),
    fallback: contentTypes.classRead().accept,
  },
  {
    name: 'AdtAuthorizationField.readMetadata',
    read: async (connection, accept) =>
      expectResult(
        await new AdtAuthorizationField(
          connection,
          undefined,
          undefined,
          undefined,
          authorizationFieldDocuments,
        ).readMetadata(
          { authorizationFieldName: 'ZAUTH' },
          accept === undefined ? {} : { accept },
        ),
        'read',
      ),
    fallback: ACCEPT_AUTHORIZATION_FIELD,
  },
  {
    name: 'AdtFunctionInclude.readMetadata',
    read: async (connection, accept) =>
      expectResult(
        await new AdtFunctionInclude(
          connection,
          undefined,
          undefined,
          undefined,
          undefined,
          functionIncludeDocuments,
        ).readMetadata(
          { functionGroupName: 'ZFG', includeName: 'LZFGF01' },
          accept === undefined ? {} : { accept },
        ),
        'read',
      ),
    fallback: ACCEPT_FUNCTION_INCLUDE,
  },
];

describe("a read member sends the caller's Accept", () => {
  for (const member of members) {
    it(`${member.name}: the caller's accept goes out as given`, async () => {
      const { connection, accepts } = recording();
      await member.read(connection, CALLER);
      expect(accepts).toEqual([CALLER]);
    });

    it(`${member.name}: the library's type when the caller gives none`, async () => {
      const { connection, accepts } = recording();
      await member.read(connection);
      expect(accepts).toEqual([member.fallback]);
    });
  }
});
