import { AdtOperationError } from '@mcp-abap-adt/interfaces';
import {
  parseVersionsFeed,
  throwUnsupportedVersions,
  throwVersionsError,
} from '../../core/shared/versions';

const FEED = `<?xml version="1.0" encoding="utf-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core"><atom:title>Version List of ZAC_SHR_BTABL (TABL)</atom:title><atom:entry><atom:author><atom:name>CB9980008038</atom:name></atom:author><atom:content type="text/plain" src="/sap/bc/adt/ddic/tables/zac_shr_btabl/source/main/versions/19700101101123/00000/content"/><atom:id>00000</atom:id><atom:updated>2026-06-14T16:25:57Z</atom:updated></atom:entry></atom:feed>`;

const EMPTY = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of X</atom:title></atom:feed>`;

describe('parseVersionsFeed', () => {
  it('parses a single-entry feed', () => {
    const v = parseVersionsFeed(FEED);
    expect(v).toHaveLength(1);
    expect(v[0]).toEqual({
      versionId: '00000',
      author: 'CB9980008038',
      updatedAt: '2026-06-14T16:25:57Z',
      title: 'Version List of ZAC_SHR_BTABL (TABL)',
      contentUri:
        '/sap/bc/adt/ddic/tables/zac_shr_btabl/source/main/versions/19700101101123/00000/content',
    });
  });

  it('returns [] for a feed with no entries', () => {
    expect(parseVersionsFeed(EMPTY)).toEqual([]);
  });
});

describe('throwUnsupportedVersions', () => {
  it('throws AdtOperationError with UNSUPPORTED_OPERATION', () => {
    expect(() => throwUnsupportedVersions('ZPACK')).toThrow();
    try {
      throwUnsupportedVersions('ZPACK');
    } catch (e: any) {
      expect(e.code).toBe('ADT_UNSUPPORTED_OPERATION');
    }
  });
});

describe('throwVersionsError', () => {
  it('maps 404/406 to UNSUPPORTED_OPERATION', () => {
    expect.assertions(2);
    for (const status of [404, 406]) {
      try {
        throwVersionsError({ response: { status } }, 'ZT');
      } catch (e: any) {
        expect(e.code).toBe('ADT_UNSUPPORTED_OPERATION');
      }
    }
  });

  it('wraps any other failure in AdtOperationError (status + originalError, no raw axios)', () => {
    expect.assertions(4);
    const original = { response: { status: 500 }, message: 'boom' };
    try {
      throwVersionsError(original, 'ZT');
    } catch (e: any) {
      expect(e).toBeInstanceOf(AdtOperationError);
      expect(e.code).toBeUndefined();
      expect(e.status).toBe(500);
      expect(e.originalError).toBe(original);
    }
  });
});
