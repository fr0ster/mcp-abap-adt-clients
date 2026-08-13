/**
 * The tree is parsed from two real payloads, not from a shape we imagined.
 *
 * Both come from the same trial on 2026-08-12 and differ only because the
 * request differed: `?targets=true` inserts a `tm:target` container. A parser
 * that walks a fixed path passes one of these and silently returns zero
 * requests on the other — which is the failure mode this whole design exists
 * to remove.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTransportTree } from '../../../../core/transport/parseTransportTree';

const fixture = (name: string): string =>
  readFileSync(join(__dirname, '../../../fixtures/transport', name), 'utf8');

describe('parseTransportTree reads both captured shapes', () => {
  it('reads the two-level chain (no targets)', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));

    expect(tree.requests).toHaveLength(7);
    expect(tree.requests[0].containers.map((c) => c.element)).toEqual([
      'workbench',
      'modifiable',
    ]);
  });

  it('reads the three-level chain (targets=true)', () => {
    const tree = parseTransportTree(fixture('transportTree.withTargets.xml'));

    expect(tree.requests).toHaveLength(1);
    expect(tree.requests[0].containers.map((c) => c.element)).toEqual([
      'workbench',
      'target',
      'modifiable',
    ]);
  });

  it('keeps what the containers carry and the request does not', () => {
    const tree = parseTransportTree(fixture('transportTree.withTargets.xml'));
    const target = tree.requests[0].containers.find(
      (c) => c.element === 'target',
    );

    // The request says tm:target="" — the name exists only on the container.
    expect(tree.requests[0].attributes['tm:target']).toBe('');
    expect(target?.attributes['tm:name']).toBe('Local Change Requests');
  });

  it('nests each task under its own request', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));

    expect(tree.requests).toHaveLength(7);
    for (const request of tree.requests) {
      expect(request.tasks).toHaveLength(1);
      expect(request.tasks[0].attributes['tm:parent']).toBe(
        request.attributes['tm:number'],
      );
    }
  });

  it('keeps the root attributes — the only record of whose list this is', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));

    expect(tree.attributes['adtcore:name']).toBe('CB9900000000');
    expect(tree.attributes['adtcore:changedAt']).toBeDefined();
    expect(
      Object.keys(tree.attributes).some((k) => k.startsWith('xmlns')),
    ).toBe(false);
  });

  it('keeps every link and long_desc, because they are not ours to drop', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));
    const links = tree.requests.flatMap((r) => [
      ...r.links,
      ...r.tasks.flatMap((t) => t.links),
    ]);

    // 231 in the fixture; an earlier draft skipped atom:link as noise.
    expect(links).toHaveLength(231);
    expect(
      links.some((l) => String(l.attributes.rel).endsWith('/releasejobs')),
    ).toBe(true);

    // Present and empty on this trial — captured as '', not dropped, and not
    // flattened into undefined, which would mean "no element at all".
    expect(tree.requests[0].longDesc).toBe('');
  });

  it('hands attributes back verbatim, prefix and all', () => {
    const tree = parseTransportTree(fixture('transportTree.noTargets.xml'));
    const keys = Object.keys(tree.requests[0].attributes);

    expect(keys).toContain('tm:number');
    expect(keys).not.toContain('number');
    expect(keys).not.toContain('description');
  });

  it('returns no requests for an empty root, without throwing', () => {
    const tree = parseTransportTree(
      '<?xml version="1.0"?><tm:root xmlns:tm="http://www.sap.com/cts/adt/tm"/>',
    );

    // A shape, not a bare list: attributes is always there, empty here because
    // this root carries nothing but its namespace.
    expect(tree).toEqual({ attributes: {}, requests: [] });
  });

  it('still says whose list it is when the list is empty', () => {
    const tree = parseTransportTree(
      '<?xml version="1.0"?><tm:root xmlns:tm="http://www.sap.com/cts/adt/tm" ' +
        'xmlns:adtcore="http://www.sap.com/adt/core" adtcore:name="CB9900000000"/>',
    );

    expect(tree.requests).toEqual([]);
    expect(tree.attributes['adtcore:name']).toBe('CB9900000000');
  });

  it('throws on a body it does not recognise, carrying the payload', () => {
    expect(() =>
      parseTransportTree('<html><body>Gateway timeout</body></html>'),
    ).toThrow(/tm:root/);
    expect(() => parseTransportTree('')).toThrow();
    expect(() => parseTransportTree(undefined)).toThrow();
  });
});
