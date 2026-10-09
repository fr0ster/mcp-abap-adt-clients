/**
 * The address the matrix reads for a registry record and the arguments the
 * objects file gives it.
 *
 * Most records build an address from a name (`uri(...)`). A few declare only a
 * collection — the legacy transport request is one — and are read there, once:
 * no name goes into the address, so there is no case to compare. Asserting that
 * every record had `uri` made the matrix crash on such a record and write no
 * report at all.
 */
export interface IMatrixAddress {
  url: string;
  /** Whether a name is in the address, so its case can be compared. */
  byName: boolean;
}

export function addressFor(
  record: object,
  args: string[],
): IMatrixAddress | undefined {
  const { uri, collection } = record as {
    uri?: unknown;
    collection?: unknown;
  };
  if (typeof uri === 'function') {
    return { url: (uri as (...a: string[]) => string)(...args), byName: true };
  }
  if (typeof collection === 'string') {
    return { url: collection, byName: false };
  }
  return undefined;
}
