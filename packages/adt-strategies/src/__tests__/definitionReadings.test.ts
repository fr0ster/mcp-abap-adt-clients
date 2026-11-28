/**
 * The definition readings and the discovery's templates, against the answers
 * recorded on ABAP cloud and on premise (2026-11-28, fr0ster/mcp-abap-adt#404)
 * and the recorded discoveries of the three releases.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { bluesMetadata, jsonDocument } from '../results/definitions';
import { utilDiscoveryTemplates } from '../results/utils';
import { stepTagged } from './corpus';

const wire = (data: string, status = 200): IAdtWireResponse =>
  ({ status, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

const TYPES = [
  ['application-log', 'APLO/TYP'],
  ['application-job-catalog', 'SAJC'],
  ['application-job-template', 'SAJT'],
] as const;
const RELEASES = ['abap-cloud', 's4-2025'] as const;

describe('jsonDocument on the recorded sources', () => {
  it.each(
    TYPES.flatMap(([type]) => RELEASES.map((release) => [type, release])),
  )('%s on %s: an object with formatVersion and header', (type, release) => {
    const source = jsonDocument(
      stepTagged(`read-${type}-definition-${release}`, 'source'),
    );
    expect(source).toEqual(
      expect.objectContaining({
        formatVersion: '1',
        header: expect.any(Object),
      }),
    );
  });

  it('carries what each type defines', () => {
    expect(
      jsonDocument(
        stepTagged('read-application-log-definition-abap-cloud', 'source'),
      ),
    ).toEqual(expect.objectContaining({ subobjects: expect.any(Array) }));
    expect(
      jsonDocument(
        stepTagged(
          'read-application-job-catalog-definition-abap-cloud',
          'source',
        ),
      ),
    ).toEqual(
      expect.objectContaining({
        generalInformation: expect.objectContaining({
          className: expect.any(String),
        }),
      }),
    );
    expect(
      jsonDocument(
        stepTagged(
          'read-application-job-template-definition-abap-cloud',
          'source',
        ),
      ),
    ).toEqual(
      expect.objectContaining({
        generalInformation: expect.objectContaining({
          catalogName: expect.any(String),
        }),
      }),
    );
  });

  it('answers undefined for a body that does not parse', () => {
    expect(jsonDocument(wire('{"formatVersion":'))).toBe(undefined);
    expect(jsonDocument(wire(''))).toBe(undefined);
  });
});

describe('bluesMetadata on the recorded object documents', () => {
  it.each(
    TYPES.flatMap(([type, code]) =>
      RELEASES.map((release) => [type, code, release]),
    ),
  )('%s (%s) on %s: its name, type and package', (type, code, release) => {
    const read = bluesMetadata(
      stepTagged(`read-${type}-definition-${release}`, 'object'),
    );
    expect(read?.type).toBe(code);
    expect(read?.name).toEqual(expect.any(String));
    expect(read?.packageName).toEqual(expect.any(String));
    expect(read?.responsible).toBe('SAPUSER01');
    expect(read?.links.length).toBeGreaterThan(0);
    // Every link has a rel and an href; a type is optional (the SAJC and
    // SAJT "Historic versions" link carries none).
    for (const link of read?.links ?? []) {
      expect(link.rel).toEqual(expect.any(String));
      expect(link.href).toEqual(expect.any(String));
    }
  });

  it('the APLO document on cloud carries no changedAt: it reads absent', () => {
    const read = bluesMetadata(
      stepTagged('read-application-log-definition-abap-cloud', 'object'),
    );
    expect(read?.changedAt).toBe(undefined);
    expect(read?.createdAt).toEqual(expect.any(String));
  });

  it('a document without changedAt and packageRef reads them absent', () => {
    const read = bluesMetadata(
      wire(
        '<blue:blueSource xmlns:blue="http://www.sap.com/wbobj/blue" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="N" adtcore:type="SAJC"/>',
      ),
    );
    expect(read).toEqual({
      name: 'N',
      type: 'SAJC',
      description: undefined,
      language: undefined,
      masterLanguage: undefined,
      masterSystem: undefined,
      abapLanguageVersion: undefined,
      version: undefined,
      createdAt: undefined,
      changedAt: undefined,
      createdBy: undefined,
      changedBy: undefined,
      responsible: undefined,
      packageName: undefined,
      packageDescription: undefined,
      links: [],
    });
  });

  it('answers undefined for another root, an exception or no XML', () => {
    expect(
      bluesMetadata(
        stepTagged('refusal-application-job-catalog-absent-s4-2025', 'object'),
      ),
    ).toBe(undefined);
    expect(bluesMetadata(wire('<other/>'))).toBe(undefined);
    expect(bluesMetadata(wire('{}'))).toBe(undefined);
  });
});

describe('utilDiscoveryTemplates on the recorded discoveries', () => {
  const DOCU = '/sap/bc/adt/docu/abap/langu';
  const of = (release: string) =>
    utilDiscoveryTemplates(
      stepTagged(`system-description-${release}`, 'discovery'),
    );

  it('s4-2025 and abap-cloud announce the query and the position templates', () => {
    for (const release of ['s4-2025', 'abap-cloud']) {
      expect([...(of(release)?.get(DOCU) ?? [])].sort()).toEqual([
        'format',
        'language',
        'query',
        'uri',
        'version',
      ]);
    }
  });

  it('basis-740 announces the position template alone', () => {
    expect([...(of('basis-740')?.get(DOCU) ?? [])].sort()).toEqual([
      'format',
      'language',
      'uri',
    ]);
  });

  it('lists the definition collections on the two modern releases, not on 7.40', () => {
    for (const collection of [
      '/sap/bc/adt/applicationlog/objects',
      '/sap/bc/adt/applicationjob/catalogs',
      '/sap/bc/adt/applicationjob/templates',
    ]) {
      expect(of('s4-2025')?.has(collection)).toBe(true);
      expect(of('abap-cloud')?.has(collection)).toBe(true);
      expect(of('basis-740')?.has(collection)).toBe(false);
    }
  });

  it('answers undefined for a malformed answer or no service document', () => {
    expect(utilDiscoveryTemplates(wire('<app:service'))).toBe(undefined);
    expect(utilDiscoveryTemplates(wire('<other/>'))).toBe(undefined);
    expect(utilDiscoveryTemplates(wire(''))).toBe(undefined);
  });
});
