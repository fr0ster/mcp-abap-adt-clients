import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * The recorded answers, loaded as the wire responses they were.
 *
 * A strategy is a function of an answer, so testing one against a fixture is
 * the whole test: no SAP, no mock, no invented document.
 */
const CORPUS = join(__dirname, '../../../adt-clients/corpus/adt');

/** The folders a case may be recorded in: the answers and the debugger's. */
const FOLDERS = ['answers', 'debugger'].map((folder) => join(CORPUS, folder));

/** The folder that holds a case's steps, and its files. */
function caseFolder(caseName: string): { dir: string; files: string[] } {
  for (const dir of FOLDERS) {
    const files = readdirSync(dir).filter((f) => f.startsWith(`${caseName}--`));
    if (files.length > 0) return { dir, files };
  }
  return { dir: CORPUS, files: [] };
}

interface ISidecar {
  case: string;
  stepTag: string;
  response: {
    status: number;
    headers?: Record<string, string>;
    bodyFile?: string;
  };
}

/** Every step of one recorded case, in order. */
export function stepsOf(caseName: string): IAdtWireResponse[] {
  const { dir, files } = caseFolder(caseName);
  const sidecars = files.filter((f) => f.endsWith('.json')).sort();

  if (sidecars.length === 0) {
    throw new Error(
      `no recorded case "${caseName}" in ${CORPUS} — the corpus is the fixture, so a missing case is a missing test`,
    );
  }

  return sidecars.map((file) => {
    const meta = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as ISidecar;
    const body = meta.response.bodyFile
      ? readFileSync(join(dir, meta.response.bodyFile), 'utf-8')
      : '';
    return {
      data: body,
      status: meta.response.status,
      headers: meta.response.headers ?? {},
    } as IAdtWireResponse;
  });
}

/** The one step a single-step case has. */
export const answerFor = (caseName: string): IAdtWireResponse =>
  stepsOf(caseName)[0];

/** One step of a recorded case, by the tag it was recorded under. */
export function stepTagged(caseName: string, tag: string): IAdtWireResponse {
  const { dir, files } = caseFolder(caseName);
  const file = files.find((f) => f.endsWith(`-${tag}.json`));
  if (!file) {
    throw new Error(`no step "${tag}" in the recorded case "${caseName}"`);
  }
  const meta = JSON.parse(readFileSync(join(dir, file), 'utf-8')) as ISidecar;
  const body = meta.response.bodyFile
    ? readFileSync(join(dir, meta.response.bodyFile), 'utf-8')
    : '';
  return {
    data: body,
    status: meta.response.status,
    headers: meta.response.headers ?? {},
  } as IAdtWireResponse;
}
