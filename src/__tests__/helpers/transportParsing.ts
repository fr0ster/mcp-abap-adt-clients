/**
 * The transport result set with the parsing readings named explicitly.
 *
 * Until the defaults became `rawDocument`, these readings were what
 * `transportDocuments` shipped, and the tests below asserted the parsed shape
 * through the default. The library now interprets nothing on its own, so a
 * test of the parsed shape constructs the implementation with the parser it
 * means to test, from @mcp-abap-adt/adt-strategies where the readings live.
 */
import {
  transportCreated,
  transportObjectEntries,
  transportSearchConfigurations,
  transportTree,
} from '@mcp-abap-adt/adt-strategies';
import { transportDocuments } from '../../core/transport/types';

export const transportParsing: Omit<
  typeof transportDocuments,
  'created' | 'createdTask' | 'list' | 'searchConfigurations' | 'objects'
> & {
  created: typeof transportCreated;
  createdTask: typeof transportCreated;
  list: typeof transportTree;
  searchConfigurations: typeof transportSearchConfigurations;
  objects: typeof transportObjectEntries;
} = {
  ...transportDocuments,
  created: transportCreated,
  createdTask: transportCreated,
  list: transportTree,
  searchConfigurations: transportSearchConfigurations,
  objects: transportObjectEntries,
};
