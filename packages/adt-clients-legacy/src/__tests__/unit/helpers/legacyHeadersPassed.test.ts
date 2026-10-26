/**
 * Every call of a member that takes `options.headers`, in a legacy file whose
 * tests reach SAP (integration, admin, helpers), passes `headers` itself — the
 * root package's rule (`headersPassed.test.ts` there), run with its scan over
 * this package's tests. Library code is both packages' `src` outside their
 * tests: the root's, which this package's tests compile from, and this one's.
 */
import { join } from 'node:path';
import {
  callsWithoutHeaders,
  filesUnder,
  type IHeadersScan,
} from '../../../../../adt-clients/src/__tests__/unit/helpers/headersPassedScan';

const TESTS = join(__dirname, '..', '..');
const PACKAGE = join(TESTS, '..', '..');
const ROOT_PACKAGE = join(PACKAGE, '..', 'adt-clients');
const SCAN: IHeadersScan = {
  tests: TESTS,
  tsconfig: join(PACKAGE, 'tsconfig.test.json'),
  library: [join(PACKAGE, 'src'), join(ROOT_PACKAGE, 'src')],
  testDirs: [TESTS, join(ROOT_PACKAGE, 'src', '__tests__')],
};

describe('header members are called with headers', () => {
  it('in every legacy integration, admin and helper file', () => {
    const files = ['integration', 'admin', 'helpers'].flatMap((dir) =>
      filesUnder(join(TESTS, dir)),
    );
    expect(files).toContain(join(TESTS, 'helpers', 'legacyEnv.ts'));
    expect(callsWithoutHeaders(SCAN, files)).toEqual([]);
  });
});
