import { AdtOperationError } from '@mcp-abap-adt/interfaces';
import {
  parseVersionsFeed,
  throwUnsupportedVersions,
  throwVersionsError,
} from '../../core/shared/versions';

const FEED = `<?xml version="1.0" encoding="utf-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core"><atom:title>Version List of ZAC_SHR_BTABL (TABL)</atom:title><atom:entry><atom:author><atom:name>CB9980008038</atom:name></atom:author><atom:content type="text/plain" src="/sap/bc/adt/ddic/tables/zac_shr_btabl/source/main/versions/19700101101123/00000/content"/><atom:id>00000</atom:id><atom:updated>2026-06-14T16:25:57Z</atom:updated></atom:entry></atom:feed>`;

const EMPTY = `<?xml version="1.0"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom"><atom:title>Version List of X</atom:title></atom:feed>`;

// Real program (REPS) feed: one version carries a transport (two links), two do not.
const FEED_WITH_TRANSPORT = `<?xml version="1.0" encoding="UTF-8"?><atom:feed xmlns:atom="http://www.w3.org/2005/Atom" xmlns:adtcore="http://www.sap.com/adt/core"><atom:title>Version List of ZDMS_UPLOAD_FILES (REPS)</atom:title><atom:entry><atom:author><atom:name>EXT_KKOROTCH</atom:name></atom:author><atom:content type="text/plain" src="/sap/bc/adt/programs/programs/zdms_upload_files/source/main/versions/20260528180205/00002/content"/><atom:id>00002</atom:id><atom:link adtcore:name="DS4K901917" href="/sap/bc/adt/vit/wb/object_type/%20%20%20%20rq/object_name/DS4K901917" rel="http://www.sap.com/adt/relations/transport/request" type="application/vnd.sap.sapgui" title="EDI-94 Reports adjustments for RISE migration"/><atom:link adtcore:name="DS4K901917" href="/sap/bc/adt/cts/transportrequests/DS4K901917" rel="http://www.sap.com/adt/relations/transport/request" type="application/vnd.sap.adt.transportrequests.v1+xml" title="EDI-94 Reports adjustments for RISE migration"/><atom:title>EDI-94 Reports adjustments for RISE migration</atom:title><atom:updated>2026-05-28T18:02:05Z</atom:updated></atom:entry><atom:entry><atom:author><atom:name>EXT_KKOROTCH</atom:name></atom:author><atom:content type="text/plain" src="/sap/bc/adt/programs/programs/zdms_upload_files/source/main/versions/20260528180205/00000/content"/><atom:id>00000</atom:id><atom:updated>2026-05-22T14:41:24Z</atom:updated></atom:entry><atom:entry><atom:author><atom:name>EXT_KKOROTCH</atom:name></atom:author><atom:content type="text/plain" src="/sap/bc/adt/programs/programs/zdms_upload_files/source/main/versions/20260528180205/00001/content"/><atom:id>00001</atom:id><atom:updated>2026-05-21T15:25:24Z</atom:updated></atom:entry></atom:feed>`;

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

  it('extracts transportRequest/transportDescription from the per-entry link (only where present)', () => {
    const v = parseVersionsFeed(FEED_WITH_TRANSPORT);
    expect(v).toHaveLength(3);

    // 00002 carries a transport (two links, sapgui + adt, same name → first wins)
    const e2 = v.find((x) => x.versionId === '00002')!;
    expect(e2.transportRequest).toBe('DS4K901917');
    expect(e2.transportDescription).toBe(
      'EDI-94 Reports adjustments for RISE migration',
    );

    // 00000 / 00001 have no transport link → both fields undefined
    for (const id of ['00000', '00001']) {
      const e = v.find((x) => x.versionId === id)!;
      expect(e.transportRequest).toBeUndefined();
      expect(e.transportDescription).toBeUndefined();
    }
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
