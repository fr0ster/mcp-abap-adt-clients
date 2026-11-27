/**
 * A facts slot types its new member's result, on both constructor paths, and
 * the analyser is handed the facts, never the document. Both test configs
 * compile this file; imported from the built declarations. Nothing here runs.
 */

import {
  type AbapGitDefaultFacts,
  type AbapGitValuesOf,
  AdtAbapGitClient,
  abapGitDocuments,
  abapGitFactsDefaults,
} from '@mcp-abap-adt/adt-clients/abapgit';
import type {
  IAbapGitFileFacts,
  IAbapGitStagingFacts,
} from '@mcp-abap-adt/adt-strategies';
import {
  ADT_NO_FAILURE,
  type IAbapGitFactsResponse,
  type IAbapGitStructuredError,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';

declare const connection: IAbapConnection;

const results = {
  ...abapGitDocuments,
  staging: (answer: IAbapGitFactsResponse<IAbapGitStagingFacts>) =>
    answer.facts.unstaged.map((object) => object.name),
};
const created = AdtAbapGitClient.create(connection, { results });
const constructed = new AdtAbapGitClient<AbapGitValuesOf<typeof results>>(
  connection,
  { results: { ...abapGitFactsDefaults, ...results } },
);

export async function newCalls(): Promise<void> {
  for (const git of [created, constructed]) {
    const staged = await git.getStaging({ key: 'K' });
    const names: string[] = staged.ok ? staged.getResult().value : [];
    const file = await git.getFile(
      { key: 'K', filename: 'f', version: 'remote' },
      { credentials: { user: 'u', password: 'p' } },
    );
    const facts: AbapGitDefaultFacts<'file'> | undefined = file.ok
      ? file.getResult().value
      : undefined;
    const content: IAbapGitFileFacts['content'] | undefined =
      facts?.facts.content;
    const linked = await git.link(
      { package: 'P', url: 'u', branchName: 'main' },
      { headers: { accept: 'a', contentType: 'c' }, credentials: null },
    );
    const error: IAbapGitStructuredError | undefined = linked.ok
      ? undefined
      : linked.getError();
    await git.checkRepo(
      { key: 'K' },
      {
        analyse: (verdict, answer) => {
          const status: number | undefined = answer?.status;
          void status;
          return verdict === ADT_NO_FAILURE ? verdict : verdict;
        },
      },
    );
    void [names, content, error];
  }
}
