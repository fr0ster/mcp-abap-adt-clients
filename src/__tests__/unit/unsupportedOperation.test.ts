import { throwUnsupportedOperation } from '../../core/shared/unsupported';

describe('throwUnsupportedOperation', () => {
  it('throws AdtOperationError with UNSUPPORTED_OPERATION', () => {
    expect.assertions(2);
    try {
      throwUnsupportedOperation('activate', 'message class ZT');
    } catch (e: any) {
      expect(e.code).toBe('ADT_UNSUPPORTED_OPERATION');
      expect(String(e.message)).toContain('activate');
    }
  });
});
