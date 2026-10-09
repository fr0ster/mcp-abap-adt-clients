/**
 * Which findings of an ATC worklist lie outside one include.
 *
 * A finding's `location` is an ADT address, sometimes with a source tail
 * (`/source/main`), a query (`?context=…`) and a fragment (`#start=…`). It sits
 * inside the include when its path is the include's address or continues under
 * it. Both sides are compared decoded and lower-cased: SAP escapes a namespace
 * as `%2f` where this client writes `%2F`, and a name is case-insensitive.
 * The full address is compared, not the name: a class include is told from
 * another of the same class only by its kind.
 */
function normalisedPath(address: string): string {
  const path = address.split(/[?#]/, 1)[0];
  return decodeURIComponent(path).toLowerCase().replace(/\/+$/, '');
}

export function findingsOutside(
  worklist: string,
  includeUri: string,
): string[] {
  const include = normalisedPath(includeUri);
  return [...worklist.matchAll(/atcfinding:location="([^"]*)"/g)]
    .map((m) => m[1])
    .filter((location) => {
      const path = normalisedPath(location);
      return path !== include && !path.startsWith(`${include}/`);
    });
}
