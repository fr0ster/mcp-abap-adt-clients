/**
 * A new-form slot takes a facts reader: an `IResultStrategy` — a reader of the
 * wire document — does not fit it, so no raw document can reach a new form's
 * result. Both test configs compile this file. Nothing here runs.
 */

import { rawDocument } from '@mcp-abap-adt/adt-clients';
import {
  AdtAbapGitClient,
  abapGitDocuments,
} from '@mcp-abap-adt/adt-clients/abapgit';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

declare const connection: IAbapConnection;

// @ts-expect-error -- a raw reader is no facts reader
export const refused = AdtAbapGitClient.create(connection, {
  results: { ...abapGitDocuments, reposFacts: rawDocument },
});

export const alsoRefused = new AdtAbapGitClient(connection, {
  // @ts-expect-error -- nor through the constructor
  results: { ...abapGitDocuments, staging: rawDocument },
});
