/**
 * D2 of #304, measured (#333 live run): SAP's own onprem trace views, as
 * recorded. A program reference with no ABAP source behind it — the
 * "Runtime analysis" root, an object's creation, a call from the kernel —
 * comes as an element with no `adtcore:name`, `adtcore:uri` or
 * `adtcore:type` (only `adtcore:context`, sometimes empty): those fields are
 * not always sent, so they are optional, and their absence reads as absent.
 * The fields kept required are the ones every recorded row carries; each case
 * below names its evidence.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  profilerDbAccesses,
  profilerHitList,
  profilerStatements,
} from '../results/traces';

const recorded = (view: string): IAdtWireResponse => ({
  status: 200,
  statusText: 'OK',
  headers: {},
  data: readFileSync(
    join(__dirname, 'fixtures/traces', `onprem-${view}.xml`),
    'utf8',
  ),
});

describe('the recorded onprem trace views read without a throw', () => {
  it('the hit list: 11 rows, a reference without a name or uri read as absent', () => {
    const { entries } = profilerHitList(recorded('hitlist'));
    expect(entries).toHaveLength(11);
    const root = entries.find((e) =>
      e.description?.startsWith('Runtime analysis'),
    );
    expect(root?.callingProgram?.name).toBeUndefined();
    expect(root?.callingProgram?.uri).toBeUndefined();
    expect(root?.calledProgram?.name).toBeUndefined();
    // A reference that names a program still carries both.
    const named = entries.find((e) => e.calledProgram?.name !== undefined);
    expect(named?.calledProgram?.uri).toMatch(/^\/sap\/bc\/adt\//);
  });

  it('the statements: 15 rows, each calling program named', () => {
    // The statements' empty references are their called programs (14 of
    // 15), which this reading does not read; every calling program names one.
    const { statements } = profilerStatements(recorded('statements'));
    expect(statements).toHaveLength(15);
    expect(
      statements.every(
        (s) =>
          s.callingProgram?.name !== undefined &&
          s.callingProgram.uri !== undefined,
      ),
    ).toBe(true);
  });

  it('the DB accesses: 2 rows', () => {
    expect(profilerDbAccesses(recorded('dbAccesses')).accesses).toHaveLength(2);
  });
});

describe('the fields kept required are on every recorded row', () => {
  it('hitlist.index: 11 of 11', () => {
    const entries = profilerHitList(recorded('hitlist')).entries;
    expect(entries.every((e) => typeof e.index === 'number')).toBe(true);
  });
  it('statement.id and statement.index: 15 of 15', () => {
    const rows = profilerStatements(recorded('statements')).statements;
    expect(rows.every((s) => s.id !== '' && typeof s.index === 'number')).toBe(
      true,
    );
  });
  it('timing.time and timing.percentage: every grossTime and traceEventNetTime', () => {
    const rows = [
      ...profilerHitList(recorded('hitlist')).entries.map((e) => e.grossTime),
      ...profilerStatements(recorded('statements')).statements.flatMap((s) => [
        s.grossTime,
        s.traceEventNetTime,
      ]),
    ].filter((t) => t !== undefined);
    expect(rows.length).toBeGreaterThan(0);
    expect(
      rows.every(
        (t) => typeof t.time === 'number' && typeof t.percentage === 'number',
      ),
    ).toBe(true);
  });
  it('dbAccess.index: 2 of 2', () => {
    const rows = profilerDbAccesses(recorded('dbAccesses')).accesses;
    expect(rows.every((r) => typeof r.index === 'number')).toBe(true);
  });
});
