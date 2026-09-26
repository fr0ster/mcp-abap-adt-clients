import { parseSearchConfigurations } from '../results/transport';

/**
 * Moved from adt-clients' listTransports.test.ts with the reading it tests:
 * the configurations document read off the atom link, never a guessed shape.
 */
const CONFIGURATIONS_XML =
  '<?xml version="1.0" encoding="utf-8"?>' +
  '<configurations:configurations xmlns:configurations="http://www.sap.com/adt/configurations">' +
  '<configuration:configuration createdBy="CB9980008038" createdAt="2026-08-07T09:50:48Z" ' +
  'changedBy="CB9980008038" changedAt="2026-08-07T09:50:48Z" client="100" ' +
  'xmlns:configuration="http://www.sap.com/adt/configuration">' +
  '<atom:link href="/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B" ' +
  'rel="http://www.sap.com/adt/categories/configurations" ' +
  'type="application/vnd.sap.adt.configuration.v1+xml" etag="20260807095048" ' +
  'xmlns:atom="http://www.w3.org/2005/Atom"/>' +
  '</configuration:configuration>' +
  '</configurations:configurations>';

describe('parseSearchConfigurations reads the href off the link, not the element', () => {
  it('reads uri, etag and the element attributes verbatim', () => {
    const configurations = parseSearchConfigurations(CONFIGURATIONS_XML);

    expect(configurations).toEqual([
      {
        uri: '/sap/bc/adt/cts/transportrequests/searchconfiguration/configurations/7E5B',
        etag: '20260807095048',
        attributes: {
          createdBy: 'CB9980008038',
          createdAt: '2026-08-07T09:50:48Z',
          changedBy: 'CB9980008038',
          changedAt: '2026-08-07T09:50:48Z',
          client: '100',
        },
      },
    ]);
  });

  it('returns none for a system with no saved configuration', () => {
    expect(
      parseSearchConfigurations(
        '<configurations:configurations xmlns:configurations="c"/>',
      ),
    ).toEqual([]);
  });

  it('returns none for an empty body rather than throwing', () => {
    expect(parseSearchConfigurations('')).toEqual([]);
    expect(parseSearchConfigurations(undefined)).toEqual([]);
  });

  it('drops a configuration with no href, since it cannot be addressed', () => {
    const xml =
      '<configurations:configurations xmlns:configurations="c">' +
      '<configuration:configuration client="100" xmlns:configuration="k"/>' +
      '</configurations:configurations>';

    expect(parseSearchConfigurations(xml)).toEqual([]);
  });
});
