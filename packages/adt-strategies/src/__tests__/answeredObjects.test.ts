/**
 * Every reading that takes a type code from an answer looks it up once
 * against the ADT type tables and answers an `IAdtAnsweredObject`: `type` for
 * a code the tables know, `unknownType` — the text exactly as ADT sent it —
 * for any other (review focus 4 of the ADT type codes plan: an unknown code
 * from ADT is not lost).
 *
 * A reading with a recorded answer in the corpus is read from it, and its
 * unknown case is that answer with one code replaced by `PROG/PS`, a code
 * ADT sends (it is in the corpus) that no table holds. The corpus has no
 * recorded search, inactive-objects listing or trace hit list; those three
 * are read from a written answer, said so in their names.
 */
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { answeredObject } from '../results/answeredObject';
import { profilerHitList } from '../results/traces';
import {
  readSearchHits,
  utilInactiveObjects,
  utilNodeContents,
  utilWhereUsedReferences,
} from '../results/utils';
import { answerFor, stepsOf } from './corpus';

const UNKNOWN = 'PROG/PS';

const wire = (data: string) =>
  ({ status: 200, statusText: 'OK', headers: {}, data }) as IAdtWireResponse;

/** A recorded answer with every `from` replaced by `to`. */
function withCode(answer: IAdtWireResponse, from: string, to: string) {
  return wire(String(answer.data).split(from).join(to));
}

describe('answeredObject', () => {
  it('answers a code of the tables as its type', () => {
    expect(answeredObject('CLAS/OC')).toEqual({ type: 'CLAS/OC' });
    expect(answeredObject('AUTH')).toEqual({ type: 'AUTH' });
  });

  it('answers any other text as unknownType, as ADT sent it', () => {
    expect(answeredObject(UNKNOWN)).toEqual({ unknownType: UNKNOWN });
    // No case folding and no prefix match: the lookup is exact.
    expect(answeredObject('clas/oc')).toEqual({ unknownType: 'clas/oc' });
    expect(answeredObject('CLAS')).toEqual({ unknownType: 'CLAS' });
    expect(answeredObject('')).toEqual({ unknownType: '' });
  });
});

describe('utilNodeContents (recorded: read-package-contents-structure, read-object-tree-structure)', () => {
  // The package level lists the child types; each object-tree level after the
  // first lists objects of one type.
  const levels = [
    answerFor('read-package-contents-structure'),
    ...stepsOf('read-object-tree-structure'),
  ];

  it('answers every recorded code as a type', () => {
    const nodes = levels.flatMap((level) => {
      const contents = utilNodeContents(level);
      return [...contents.objects, ...contents.childNodes];
    });
    expect(
      levels.flatMap((level) => utilNodeContents(level).objects).length,
    ).toBeGreaterThan(0);
    expect(
      levels.flatMap((level) => utilNodeContents(level).childNodes).length,
    ).toBeGreaterThan(0);
    for (const node of nodes) {
      expect(node.type).toBeDefined();
      expect(node.unknownType).toBeUndefined();
    }
  });

  it('keeps a code the tables do not know as unknownType, and drops nothing for it', () => {
    for (const level of levels) {
      const before = utilNodeContents(level);
      const after = utilNodeContents(withCode(level, 'TABL/DT', UNKNOWN));
      expect(after.objects).toHaveLength(before.objects.length);
      expect(after.childNodes).toHaveLength(before.childNodes.length);
    }
    const unknown = levels
      .map((level) => utilNodeContents(withCode(level, 'TABL/DT', UNKNOWN)))
      .flatMap((contents) => [...contents.objects, ...contents.childNodes])
      .filter((node) => node.unknownType !== undefined);
    // The tables' child type on two levels, and every table of the last one.
    expect(unknown.length).toBeGreaterThan(0);
    for (const node of unknown) {
      expect(node.unknownType).toBe(UNKNOWN);
      expect(node.type).toBeUndefined();
    }
  });
});

describe('utilWhereUsedReferences (recorded: read-where-used-list-structure)', () => {
  const recorded = answerFor('read-where-used-list-structure');

  it('answers the recorded code as a type, and still skips packages', () => {
    const { references } = utilWhereUsedReferences(recorded);
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.type).toBe('BDEF/BDO');
      expect(reference.unknownType).toBeUndefined();
    }
  });

  it('keeps a code the tables do not know as unknownType', () => {
    const { references } = utilWhereUsedReferences(
      withCode(recorded, 'BDEF/BDO', UNKNOWN),
    );
    expect(references.length).toBeGreaterThan(0);
    for (const reference of references) {
      expect(reference.unknownType).toBe(UNKNOWN);
      expect(reference.type).toBeUndefined();
    }
  });
});

describe('readSearchHits (written answer: no search is recorded)', () => {
  const hits = readSearchHits(
    `<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
      <adtcore:objectReference adtcore:name="ZCL_A" adtcore:type="CLAS/OC"/>
      <adtcore:objectReference adtcore:name="ZREP_S" adtcore:type="${UNKNOWN}"/>
    </adtcore:objectReferences>`,
  );

  it('answers a code of the tables as a type, and keeps the other as unknownType', () => {
    expect(hits).toEqual([
      { name: 'ZCL_A', type: 'CLAS/OC', description: '' },
      { name: 'ZREP_S', unknownType: UNKNOWN, description: '' },
    ]);
  });
});

describe('utilInactiveObjects (written answer: no listing is recorded)', () => {
  it('answers a code of the tables as a type, and keeps the other as unknownType', () => {
    const xml = `<ioc:inactiveObjects xmlns:ioc="http://www.sap.com/abapxml/inactiveCtsObjects" xmlns:adtcore="http://www.sap.com/adt/core">
      <ioc:entry><ioc:object><ioc:ref adtcore:name="ZCL_A" adtcore:type="CLAS/OC"/></ioc:object></ioc:entry>
      <ioc:entry><ioc:object><ioc:ref adtcore:name="ZREP_S" adtcore:type="${UNKNOWN}"/></ioc:object></ioc:entry>
    </ioc:inactiveObjects>`;
    expect(utilInactiveObjects(wire(xml))).toEqual({
      objects: [
        { type: 'CLAS/OC', name: 'ZCL_A' },
        { unknownType: UNKNOWN, name: 'ZREP_S' },
      ],
    });
  });
});

describe('profilerHitList (written answer: no hit list is recorded)', () => {
  it('answers the program a row names with its code looked up', () => {
    const hitList = (type: string) =>
      profilerHitList(
        wire(
          `<?xml version="1.0"?><trc:hitlist xmlns:trc="x" xmlns:adtcore="y"><trc:entry trc:index="1"><trc:callingProgram adtcore:name="ZX" adtcore:type="${type}" adtcore:uri="/sap/bc/adt/x"/></trc:entry></trc:hitlist>`,
        ),
      ).entries[0]?.callingProgram;
    expect(hitList('CLAS/OC')).toMatchObject({ name: 'ZX', type: 'CLAS/OC' });
    expect(hitList(UNKNOWN)).toMatchObject({
      name: 'ZX',
      unknownType: UNKNOWN,
    });
    expect(hitList(UNKNOWN)?.type).toBeUndefined();
  });
});
