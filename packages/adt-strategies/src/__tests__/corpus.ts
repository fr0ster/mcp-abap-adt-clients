import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces';

/**
 * The recorded answers, loaded as the wire responses they were.
 *
 * A strategy is a function of an answer, so testing one against a fixture is
 * the whole test: no SAP, no mock, no invented document.
 */
const CORPUS = join(__dirname, '../../../../corpus/adt');

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
  const sidecars = readdirSync(CORPUS)
    .filter((f) => f.startsWith(`${caseName}--`) && f.endsWith('.json'))
    .sort();

  if (sidecars.length === 0) {
    throw new Error(
      `no recorded case "${caseName}" in ${CORPUS} — the corpus is the fixture, so a missing case is a missing test`,
    );
  }

  return sidecars.map((file) => {
    const meta = JSON.parse(
      readFileSync(join(CORPUS, file), 'utf-8'),
    ) as ISidecar;
    const body = meta.response.bodyFile
      ? readFileSync(join(CORPUS, meta.response.bodyFile), 'utf-8')
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
