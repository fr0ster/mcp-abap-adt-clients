import type { IAbapGitRepo } from '../../index';

/**
 * A downstream consumer of `IAbapGitRepo.status` as it was published: a
 * `string`, `''` when SAP sent none. Compiled with `abapGitReadings.test.ts`
 * (which imports it), so making `status` optional, or `string | undefined`,
 * fails that suite's compilation. Absence is `abapGitRepoRunStates`' to say.
 */
export function statusOfFirst(repos: IAbapGitRepo[]): string {
  const first = repos[0];
  if (first === undefined) return '';
  const status: string = first.status;
  const text: string = first.statusText;
  return text.length > 0 ? status : status;
}
