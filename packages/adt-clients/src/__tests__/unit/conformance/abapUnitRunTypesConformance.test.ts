/**
 * The conformance check's ABAP Unit rules (spec 3.5): `ABAP_UNIT_RUN_TYPES`
 * against each release's recorded `GET /abapunit/metadata`
 * (`corpus/adt/abapunit/<release>/`).
 *
 * Per release that has an answer, the registry must hold every code the
 * metadata lists (`unregistered`), and every key entered on the metadata's
 * evidence must be listed there (`unlisted`). The second half proves the
 * check bites: a minimal registry and answer that pass, and for each rule one
 * change that makes that rule, and only it, fail.
 */

import {
  ABAP_UNIT_RUN_TYPES,
  type AbapUnitRunTypeTable,
} from '@mcp-abap-adt/interfaces-adt';
import {
  checkAbapUnitRunTypes,
  readAbapUnitMetadata,
} from '../../helpers/abapUnitConformance';
import {
  type RecordedRelease,
  recordedAbapUnitMetadata,
} from '../../helpers/recordedConformance';

/** The releases with a recorded answer; SAP_BASIS 7.40 has no such endpoint. */
const ANSWERED: readonly RecordedRelease[] = ['s4-2025', 'abap-cloud'];

function listed(release: RecordedRelease): string[] {
  const codes = recordedAbapUnitMetadata(release);
  if (!codes) throw new Error(`no recorded /abapunit/metadata for ${release}`);
  return codes;
}

describe.each(ANSWERED)(
  '%s: the ABAP Unit run registry against the recorded metadata',
  (release) => {
    it('lists the 23 supported types', () => {
      expect(listed(release)).toHaveLength(23);
    });

    it('finds no conflict', () => {
      expect(
        checkAbapUnitRunTypes(ABAP_UNIT_RUN_TYPES, listed(release)),
      ).toEqual([]);
    });
  },
);

describe('basis-740: no /abapunit/metadata', () => {
  it('has no recorded answer, so no ABAP Unit rule runs for it', () => {
    expect(recordedAbapUnitMetadata('basis-740')).toBeUndefined();
  });
});

describe('a deliberate break fails the check against the recorded answers', () => {
  it('a recorded answer listing a type the registry lacks: unregistered alone', () => {
    expect(
      checkAbapUnitRunTypes(ABAP_UNIT_RUN_TYPES, [
        ...listed('s4-2025'),
        'WAPA/WO',
      ]),
    ).toEqual([{ rule: 'unregistered', code: 'WAPA/WO' }]);
  });

  it('a recorded answer losing a type entered on its evidence: unlisted alone', () => {
    expect(
      checkAbapUnitRunTypes(
        ABAP_UNIT_RUN_TYPES,
        listed('abap-cloud').filter((code) => code !== 'CLAS/OCI'),
      ),
    ).toEqual([{ rule: 'unlisted', code: 'CLAS/OCI' }]);
  });
});

/** A registry of each evidence, and an answer that agrees with it. */
const FIXTURE_REGISTRY = {
  CLAS: { runs: 'ownTests', evidence: 'recorded' },
  'CLAS/OC': { runs: 'ownTests', evidence: 'recorded' },
  'PROG/I': { runs: 'ownTests', evidence: 'metadata' },
  'FUGR/FF': { runs: 'ownTests', evidence: 'metadataRunEmpty' },
} as const satisfies AbapUnitRunTypeTable;

const FIXTURE_LISTED = ['CLAS/OC', 'PROG/I', 'FUGR/FF'];

describe('the check bites: the fixture passes', () => {
  it('a registry and an answer that agree report no conflict', () => {
    expect(checkAbapUnitRunTypes(FIXTURE_REGISTRY, FIXTURE_LISTED)).toEqual([]);
  });

  it('a recorded key the metadata does not list is no conflict', () => {
    // `CLAS` rests on a measured run: the metadata never lists it.
    expect(FIXTURE_LISTED).not.toContain('CLAS');
    expect(checkAbapUnitRunTypes(FIXTURE_REGISTRY, FIXTURE_LISTED)).toEqual([]);
  });
});

describe('the check bites: each rule, alone', () => {
  it('unregistered: the answer lists a code the registry has no key for', () => {
    expect(
      checkAbapUnitRunTypes(FIXTURE_REGISTRY, [...FIXTURE_LISTED, 'DDLS/DF']),
    ).toEqual([{ rule: 'unregistered', code: 'DDLS/DF' }]);
  });

  it("unlisted: a key of evidence 'metadata' the answer does not list", () => {
    expect(
      checkAbapUnitRunTypes(
        FIXTURE_REGISTRY,
        FIXTURE_LISTED.filter((code) => code !== 'PROG/I'),
      ),
    ).toEqual([{ rule: 'unlisted', code: 'PROG/I' }]);
  });

  it("unlisted: a key of evidence 'metadataRunEmpty' the answer does not list", () => {
    expect(
      checkAbapUnitRunTypes(
        FIXTURE_REGISTRY,
        FIXTURE_LISTED.filter((code) => code !== 'FUGR/FF'),
      ),
    ).toEqual([{ rule: 'unlisted', code: 'FUGR/FF' }]);
  });
});

describe('the reader refuses what is not the recorded shape', () => {
  const wrap = (inner: string) =>
    `<?xml version="1.0" encoding="utf-8"?><aunit:metadata xmlns:aunit="http://www.sap.com/adt/aunit">${inner}</aunit:metadata>`;

  it('reads the codes in document order', () => {
    expect(
      readAbapUnitMetadata(
        wrap(
          '<aunit:supportedTypeFeatures globalWorkbenchType="DDLS/DF" ownTests="false" assignedTests="true" coverage="false"/>' +
            '<aunit:supportedTypeFeatures globalWorkbenchType="CLAS/OC" ownTests="true" assignedTests="true" coverage="true"/>',
        ),
      ),
    ).toEqual(['DDLS/DF', 'CLAS/OC']);
  });

  it('an answer with no supportedTypeFeatures', () => {
    expect(() =>
      readAbapUnitMetadata(
        wrap('<aunit:clientSetup maxRiskLevel="harmless"/>'),
      ),
    ).toThrow('abapunit metadata: no supportedTypeFeatures');
  });

  it('an entry without globalWorkbenchType', () => {
    expect(() =>
      readAbapUnitMetadata(
        wrap('<aunit:supportedTypeFeatures ownTests="true"/>'),
      ),
    ).toThrow('without globalWorkbenchType');
  });

  it('a code twice', () => {
    expect(() =>
      readAbapUnitMetadata(
        wrap(
          '<aunit:supportedTypeFeatures globalWorkbenchType="CLAS/OC"/>' +
            '<aunit:supportedTypeFeatures globalWorkbenchType="CLAS/OC"/>',
        ),
      ),
    ).toThrow('abapunit metadata: CLAS/OC twice');
  });

  it('text that is not XML', () => {
    expect(() => readAbapUnitMetadata('not xml <')).toThrow(
      'abapunit metadata is not XML',
    );
  });
});
