import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import {
  cloudTableSettings,
  readTableSettings,
  tableSettings,
} from '../results/tableSettings';
import { stepsOf } from './corpus';

/**
 * The table settings reading over the recorded reads (adt-clients
 * `corpus/adt/answers/read-table-settings-*`, 2026-11-19): every setting the
 * write replaces, the translation's four attributes, the description and the
 * ETag — and a throw naming an element a read lacks.
 */
function recorded(caseName: string): IAdtWireResponse {
  const [only] = stepsOf(caseName);
  if (!only) throw new Error(`no recorded ${caseName}`);
  return only;
}

describe('tableSettings', () => {
  it('reads every setting of the on-premise read, its translation whole, and its ETag', () => {
    const answer = recorded('read-table-settings-s4-2025');
    expect(tableSettings(answer)).toEqual({
      name: 'SFLIGHT',
      description: 'Flight',
      version: 'active',
      etag: answer.headers?.etag,
      settings: {
        dataClassCategory: 'APPL1',
        sizeCategory: '0',
        buffering: { allowed: 'N', type: '', areaKeyFields: 0 },
        storageType: 'C',
        sharingType: '',
        loadUnit: '',
        translation: {
          value: '',
          isVisible: false,
          isEditable: false,
          granularity: '2',
        },
        loggingEnabled: false,
      },
    });
    expect(answer.headers?.etag).toContain('table.settings.v2+xml');
  });

  it("reads the cloud's isWritableByAMDP, and no ETag where the answer kept none", () => {
    const read = tableSettings(recorded('read-table-settings-abap-cloud'));
    expect(read.settings.isWritableByAMDP).toBe(false);
    expect(read.settings.translation).toEqual({
      value: '',
      isVisible: false,
      isEditable: false,
      granularity: '2',
    });
    expect(read.etag).toBeUndefined();
  });

  it.each([
    ['<ts:storageType>C</ts:storageType>', 'ts:storageType is missing'],
    [' ts:isVisible="false"', 'ts:translation/@isVisible is missing'],
    ['<ts:sharingType/>', 'ts:sharingType is missing'],
  ])('throws, naming it, when the read lacks %s', (part, named) => {
    const xml = String(recorded('read-table-settings-s4-2025').data);
    expect(xml).toContain(part);
    expect(() => readTableSettings(xml.replace(part, ''))).toThrow(named);
  });

  // A count past Number.MAX_SAFE_INTEGER reads as another number, and a
  // write would send that one back: refused, as adt-clients 48.0.0's own
  // reading of the patch refused it (C7, 49.0.0: the strategy is the read).
  it.each(['9'.repeat(400), '9007199254740993'])(
    'refuses an area-key count that is no safe integer (%#)',
    (digits) => {
      const xml = String(recorded('read-table-settings-s4-2025').data);
      const part = '<ts:areaKeyFields>0</ts:areaKeyFields>';
      expect(xml).toContain(part);
      expect(() =>
        readTableSettings(
          xml.replace(part, `<ts:areaKeyFields>${digits}</ts:areaKeyFields>`),
        ),
      ).toThrow('not a count');
    },
  );

  it('refuses a document that is not ts:tableSettings', () => {
    expect(() => readTableSettings('<other/>')).toThrow(
      'no ts:tableSettings document',
    );
  });

  it('decodes character references and entities, and keeps spaces, in attributes and text', () => {
    const xml = String(recorded('read-table-settings-s4-2025').data)
      .replace(
        'adtcore:description="Flight"',
        'adtcore:description=" Caf&#xE9; &amp; &#233;t&#xe9; "',
      )
      .replace('ts:value=""', 'ts:value="  a &lt;b&gt; "')
      .replace(
        '<ts:loadUnit/>',
        '<ts:loadUnit> Caf&#xE9; &amp; x </ts:loadUnit>',
      );
    const read = readTableSettings(xml);
    expect(read.description).toBe(' Caf\u00e9 & \u00e9t\u00e9 ');
    expect(read.settings.translation.value).toBe('  a <b> ');
    expect(read.settings.loadUnit).toBe(' Caf\u00e9 & x ');
  });
});

describe('the ETag header', () => {
  it.each(['etag', 'ETag', 'Etag'])('is read whatever its case (%s)', (key) => {
    const answer = recorded('read-table-settings-s4-2025');
    expect(tableSettings({ ...answer, headers: { [key]: '"E-1"' } }).etag).toBe(
      '"E-1"',
    );
  });
});

describe('cloudTableSettings', () => {
  it('reads the cloud flag as a boolean', () => {
    const read = cloudTableSettings(recorded('read-table-settings-abap-cloud'));
    const flag: boolean = read.settings.isWritableByAMDP;
    expect(flag).toBe(false);
  });

  it('throws for a cloud read without ts:isWritableByAMDP, naming it', () => {
    const answer = recorded('read-table-settings-abap-cloud');
    const without = {
      ...answer,
      data: String(answer.data).replace(
        '<ts:isWritableByAMDP>false</ts:isWritableByAMDP>',
        '',
      ),
    };
    expect(() => cloudTableSettings(without)).toThrow(
      'ts:isWritableByAMDP is missing',
    );
  });
});
