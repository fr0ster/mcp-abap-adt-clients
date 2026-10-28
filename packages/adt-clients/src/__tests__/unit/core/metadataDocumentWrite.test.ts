/**
 * `updateMetadata` of a class, an interface, a program, a function module, a
 * DDL source, an access control, a metadata extension, a behavior definition,
 * a service definition, a scalar function, a transformation, a table, a
 * structure and an include: one PUT of the caller's document, as it is, to the object's
 * own resource, under the caller's lock handle and with the caller's headers.
 *
 * Measured on S/4HANA 2025 and ABAP cloud (the program on premise only), every
 * one 200, with the media types the pairs below carry.
 */
import type { IAdtHeaders } from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClientOnPrem } from '../../../clients/AdtClientVariants';
import { headersFor } from '../../helpers/adtHeaders';
import { createLibraryLogger } from '../../helpers/testLogger';

interface ISent {
  url: string;
  method: string;
  data: unknown;
  headers: Record<string, string>;
}

function recordingClient(): { client: AdtClientOnPrem; sent: ISent[] } {
  const sent: ISent[] = [];
  const connection = {
    makeAdtRequest: async (request: ISent) => {
      sent.push(request);
      return { status: 200, statusText: 'OK', headers: {}, data: '' };
    },
  } as unknown as IAbapConnection;
  return {
    client: new AdtClientOnPrem(connection, createLibraryLogger()),
    sent,
  };
}

/** Line ends, a BOM, non-ASCII and trailing space: nothing may be touched. */
const DOCUMENT =
  '﻿<?xml version="1.0" encoding="utf-8"?>\r\n<adtcore:x adtcore:description="Überprüfung &amp; Ä"/>\n  ';

interface ICase {
  member: string;
  url: string;
  write: (
    client: AdtClientOnPrem,
    headers: IAdtHeaders,
    transportRequest: string | undefined,
  ) => Promise<unknown>;
}

const options = (headers: IAdtHeaders) => ({
  headers,
  lockHandle: 'LOCK/+=1',
  source: DOCUMENT,
});

const CASES: ICase[] = [
  {
    member: 'AdtClass.updateMetadata',
    url: '/sap/bc/adt/oo/classes/zcl_meta',
    write: (client, headers, transportRequest) =>
      client
        .getClass()
        .updateMetadata(
          { className: 'ZCL_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtInterface.updateMetadata',
    url: '/sap/bc/adt/oo/interfaces/zif_meta',
    write: (client, headers, transportRequest) =>
      client
        .getInterface()
        .updateMetadata(
          { interfaceName: 'ZIF_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtProgram.updateMetadata',
    url: '/sap/bc/adt/programs/programs/zmeta',
    write: (client, headers, transportRequest) =>
      client
        .getProgram()
        .updateMetadata(
          { programName: 'ZMETA', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtFunctionModule.updateMetadata',
    url: '/sap/bc/adt/functions/groups/zfg_meta/fmodules/z_fm_meta',
    write: (client, headers, transportRequest) =>
      client.getFunctionModule().updateMetadata(
        {
          functionGroupName: 'ZFG_META',
          functionModuleName: 'Z_FM_META',
          transportRequest,
        },
        options(headers),
      ),
  },
  {
    member: 'AdtDdl.updateMetadata',
    url: '/sap/bc/adt/ddic/ddl/sources/zi_meta',
    write: (client, headers, transportRequest) =>
      client
        .getDdl()
        .updateMetadata(
          { ddlName: 'ZI_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtAccessControl.updateMetadata',
    url: '/sap/bc/adt/acm/dcl/sources/zdcl_meta',
    write: (client, headers, transportRequest) =>
      client
        .getAccessControl()
        .updateMetadata(
          { accessControlName: 'ZDCL_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtMetadataExtension.updateMetadata',
    url: '/sap/bc/adt/ddic/ddlx/sources/zddlx_meta',
    write: (client, headers, transportRequest) =>
      client
        .getMetadataExtension()
        .updateMetadata(
          { name: 'ZDDLX_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtBehaviorDefinition.updateMetadata',
    url: '/sap/bc/adt/bo/behaviordefinitions/zbdef_meta',
    write: (client, headers, transportRequest) =>
      client
        .getBehaviorDefinition()
        .updateMetadata(
          { name: 'ZBDEF_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtServiceDefinition.updateMetadata',
    url: '/sap/bc/adt/ddic/srvd/sources/zsrvd_meta',
    write: (client, headers, transportRequest) =>
      client
        .getServiceDefinition()
        .updateMetadata(
          { serviceDefinitionName: 'ZSRVD_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtScalarFunction.updateMetadata',
    url: '/sap/bc/adt/ddic/dsfd/sources/zdsfd_meta',
    write: (client, headers, transportRequest) =>
      client
        .getScalarFunction()
        .updateMetadata(
          { scalarFunctionName: 'ZDSFD_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtTransformation.updateMetadata',
    url: '/sap/bc/adt/xslt/transformations/zxslt_meta',
    write: (client, headers, transportRequest) =>
      client
        .getTransformation()
        .updateMetadata(
          { transformationName: 'ZXSLT_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtTable.updateMetadata',
    url: '/sap/bc/adt/ddic/tables/ztab_meta',
    write: (client, headers, transportRequest) =>
      client
        .getTable()
        .updateMetadata(
          { tableName: 'ZTAB_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtStructure.updateMetadata',
    url: '/sap/bc/adt/ddic/structures/zstru_meta',
    write: (client, headers, transportRequest) =>
      client
        .getStructure()
        .updateMetadata(
          { structureName: 'ZSTRU_META', transportRequest },
          options(headers),
        ),
  },
  {
    member: 'AdtInclude.updateMetadata',
    url: '/sap/bc/adt/programs/includes/zinc_meta',
    write: (client, headers, transportRequest) =>
      client
        .getInclude()
        .updateMetadata(
          { includeName: 'ZINC_META', transportRequest },
          options(headers),
        ),
  },
];

describe('updateMetadata writes the caller’s document as it is', () => {
  for (const { member, url, write } of CASES) {
    describe(member, () => {
      const headers = headersFor(member);

      it('PUTs once to the object, with the handle and the request', async () => {
        const { client, sent } = recordingClient();
        await write(client, headers, 'DEVK900001');

        expect(sent).toHaveLength(1);
        expect(sent[0]?.method).toBe('PUT');
        expect(sent[0]?.url).toBe(
          `${url}?lockHandle=LOCK%2F%2B%3D1&corrNr=DEVK900001`,
        );
      });

      it('sends no corrNr when the config names no request', async () => {
        const { client, sent } = recordingClient();
        await write(client, headers, undefined);

        expect(sent.map((r) => r.url)).toEqual([
          `${url}?lockHandle=LOCK%2F%2B%3D1`,
        ]);
      });

      it('sends the body byte for byte and the headers as passed', async () => {
        const { client, sent } = recordingClient();
        await write(client, headers, undefined);

        expect(sent[0]?.data).toBe(DOCUMENT);
        expect(sent[0]?.headers).toStrictEqual({
          Accept: headers.accept,
          'Content-Type': headers.contentType,
        });
      });
    });
  }
});
