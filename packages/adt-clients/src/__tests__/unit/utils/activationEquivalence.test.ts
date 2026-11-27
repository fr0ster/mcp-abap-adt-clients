/**
 * Every recorded activation answer is judged as it was before
 * fr0ster/mcp-abap-adt#360 (fr0ster/mcp-abap-adt-clients#314): the change
 * adds a row for an answer no recorded system gave (no `activationExecuted`,
 * warnings alone), and changes nothing that works.
 *
 * Each recorded answer to `POST /sap/bc/adt/activation` — the corpus's, and
 * the bodies recorded on onprem (SAP_BASIS 816) and cloud for the issue — is
 * replayed through a member's `activate` with adt-strategies'
 * `analyseActivation`, beside three inactive lists: an empty one, one naming
 * the activated object, and a refused read. What it answers (success or
 * failure, the message, `stillInactive`, the message types) and whether the
 * list was read are compared with `activationEquivalence.before.json`,
 * written by this file on the code before the change
 * (`ACTIVATION_EQUIVALENCE_WRITE=1`).
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { analyseActivation } from '@mcp-abap-adt/adt-strategies';
import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';
import { AdtClient } from '../../../clients/AdtClient';
import { headersOf } from '../../helpers/adtHeaders';
import { readExchange } from '../../helpers/recordedConformance';
import { CriticalSectionConnection } from '../../helpers/recordingConnection';
import { createLibraryLogger } from '../../helpers/testLogger';

const ANSWERS = join(__dirname, '../../../../corpus/adt/answers');
const RECORDED_I360 = join(__dirname, 'fixtures/activation-i360-recorded.json');
const BEFORE = join(__dirname, 'activationEquivalence.before.json');
const INACTIVE = '/sap/bc/adt/activation/inactiveobjects';
const SINGLE_ACTIVATION = '/sap/bc/adt/activation?';

interface IRecordedAnswer {
  readonly name: string;
  readonly status: number;
  readonly body: string;
}

/** The corpus's recorded answers to a single-object `POST /activation`. */
function corpusAnswers(): IRecordedAnswer[] {
  return readdirSync(ANSWERS)
    .filter((file) => file.endsWith('-activation.json'))
    .sort()
    .flatMap((file) => {
      const sidecar: unknown = JSON.parse(
        readFileSync(join(ANSWERS, file), 'utf-8'),
      );
      const url =
        typeof sidecar === 'object' &&
        sidecar !== null &&
        'request' in sidecar &&
        typeof sidecar.request === 'object' &&
        sidecar.request !== null &&
        'url' in sidecar.request
          ? sidecar.request.url
          : undefined;
      if (typeof url !== 'string' || !url.startsWith(SINGLE_ACTIVATION)) {
        return [];
      }
      const { status, body } = readExchange(ANSWERS, file);
      return [{ name: file.replace(/\.json$/, ''), status, body }];
    });
}

/** The bodies recorded for the issue, on onprem 816 and cloud. */
function i360Answers(): IRecordedAnswer[] {
  const parsed: unknown = JSON.parse(readFileSync(RECORDED_I360, 'utf-8'));
  const answers =
    typeof parsed === 'object' && parsed !== null && 'answers' in parsed
      ? parsed.answers
      : undefined;
  if (!Array.isArray(answers)) throw new Error(`${RECORDED_I360}: no answers`);
  return answers.map((answer: unknown) => {
    if (
      typeof answer !== 'object' ||
      answer === null ||
      !('name' in answer) ||
      !('body' in answer) ||
      typeof answer.name !== 'string' ||
      typeof answer.body !== 'string'
    ) {
      throw new Error(`${RECORDED_I360}: an answer without name or body`);
    }
    return { name: answer.name, status: 200, body: answer.body };
  });
}

/** A refusal the way a transport throws a non-2xx. */
function refused(status: number, data: string): Error {
  const response: IAdtWireResponse = {
    status,
    statusText: 'Refused',
    headers: {},
    data,
  };
  return Object.assign(new Error(`Request failed with status code ${status}`), {
    response,
  });
}

const LISTS = {
  empty: readExchange(
    ANSWERS,
    'activation-reactivate-active-s4-2025--04-inactiveobjects.json',
  ).body,
  naming: readExchange(
    ANSWERS,
    'activation-group-alone-s4-2025--05-inactiveobjects.json',
  ).body,
  refused: refused(500, ''),
} as const;

/** What one replay answered, in the fields compared. */
interface IJudged {
  readonly ok: boolean;
  readonly listRead: boolean;
  readonly message?: string;
  readonly stillInactive?: readonly string[];
  readonly messageTypes?: readonly string[];
}

async function judge(
  answer: IRecordedAnswer,
  list: keyof typeof LISTS,
): Promise<IJudged> {
  const connection = new CriticalSectionConnection((options) => {
    if (options.url === INACTIVE) {
      const listed = LISTS[list];
      if (listed instanceof Error) throw listed;
      return listed;
    }
    if (answer.status !== 200) throw refused(answer.status, answer.body);
    return answer.body;
  });
  const client = new AdtClient(connection, createLibraryLogger());
  const group = client.getFunctionGroup();
  const answered = await group.activate(
    { functionGroupName: 'ZACT751P9325' },
    { headers: headersOf(group, 'activate'), analyse: analyseActivation },
  );
  const listRead = connection.sent.some((r) => r.url === INACTIVE);
  if (answered.ok) return { ok: true, listRead };
  const failure = answered.getError();
  if (!('stillInactive' in failure))
    throw new Error('expected the activation failure');
  return {
    ok: false,
    listRead,
    message: failure.message,
    stillInactive: failure.stillInactive.map((o) => o.uri),
    messageTypes: (failure.messages ?? []).map((m) => m.type),
  };
}

const RECORDED = [...corpusAnswers(), ...i360Answers()];
const CASES = RECORDED.flatMap((answer) =>
  (Object.keys(LISTS) as (keyof typeof LISTS)[]).map(
    (list) => [`${answer.name} / list ${list}`, answer, list] as const,
  ),
);

describe('every recorded activation answer is judged as before #360', () => {
  it('replays the corpus and the bodies recorded for the issue', () => {
    expect(corpusAnswers().length).toBe(14);
    expect(i360Answers().length).toBe(6);
  });

  if (process.env.ACTIVATION_EQUIVALENCE_WRITE === '1') {
    it('writes the verdicts of the code it runs on', async () => {
      const judged: Record<string, IJudged> = {};
      for (const [name, answer, list] of CASES) {
        judged[name] = await judge(answer, list);
      }
      writeFileSync(BEFORE, `${JSON.stringify(judged, null, 2)}\n`);
    });
    return;
  }

  const before: Record<string, IJudged> = JSON.parse(
    readFileSync(BEFORE, 'utf-8'),
  );

  it('covers every case the file was written for, and no other', () => {
    expect(CASES.map(([name]) => name).sort()).toEqual(
      Object.keys(before).sort(),
    );
  });

  it.each(CASES)('%s', async (name, answer, list) => {
    expect(await judge(answer, list)).toEqual(before[name]);
  });
});
