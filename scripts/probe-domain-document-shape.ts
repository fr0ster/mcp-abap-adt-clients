/**
 * What a domain document actually contains, read off domains that exist.
 *
 * **Why read rather than write.** `IDomainConfig` models `doma:typeInformation`
 * and nothing else, so the question is what the other two groups hold and in
 * what shapes. That is a question about documents, and the system is full of
 * documents — every standard domain is a filled-in example. Creating domains to
 * find out would answer a narrower question (what a POST accepts) at the cost
 * of writing objects, and it would only ever show the shapes this file thought
 * to send. Reading shows the shapes SAP itself produces, including the ones
 * nobody here would have guessed.
 *
 * So this reads a list of domains and tallies, per field, how many filled it in
 * and with what. Nothing is created, nothing is deleted, nothing is locked.
 *
 *   npx ts-node scripts/probe-domain-document-shape.ts [DOMAIN ...]
 *
 * With no arguments it reads a spread chosen to exercise all three groups: a
 * flag with fixed values, a language with a conversion exit and a value table,
 * a date, a time, quantities and amounts with decimals, and a couple of long
 * character domains.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import {
  createTestConnection,
  releaseTestConnection,
} from '../src/__tests__/helpers/sessionConfig';
import { createConnectionLogger } from '../src/__tests__/helpers/testLogger';
import { getDomain } from '../src/core/domain/read';

const envPath = process.env.MCP_ENV_PATH || path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const say = (line = ''): void => {
  // biome-ignore lint/suspicious/noConsole: a probe reports to whoever ran it
  console.log(line);
};

/**
 * A spread rather than a sample: each name is here because it is expected to
 * fill in something the others leave empty.
 */
const DEFAULTS = [
  'XFELD', // CHAR(1) with two fixed values, one of them an empty `low`
  'SPRAS', // LANG with a conversion exit and a value table
  'DATUM', // a date — output length differs from the type length
  'UZEIT', // a time
  'MENGV13V3', // a quantity: decimals
  'WERTV8', // an amount: decimals and a sign
  'CHAR40', // plain character
  'MANDT', // client, usually with a value table
  'ACTIV', // a flag with fixed values
  'BOOLE', // another flag
];

/** Every element of `doma:content`, pulled out by name. */
function parse(xml: string): {
  type: Record<string, string>;
  output: Record<string, string>;
  value: { table?: string; appendExists?: string; fixed: string[][] };
} {
  const group = (name: string): string =>
    new RegExp(`<doma:${name}>([\\s\\S]*?)</doma:${name}>`).exec(xml)?.[1] ??
    '';
  const fields = (block: string): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const m of block.matchAll(/<doma:(\w+)>([^<]*)<\/doma:\1>/g))
      out[m[1]] = m[2];
    for (const m of block.matchAll(/<doma:(\w+)\s*\/>/g))
      if (!(m[1] in out)) out[m[1]] = '';
    return out;
  };
  const valueBlock = group('valueInformation');
  return {
    type: fields(group('typeInformation')),
    output: fields(group('outputInformation')),
    value: {
      table: /<doma:valueTableRef[^>]*adtcore:name="([^"]*)"/.exec(
        valueBlock,
      )?.[1],
      appendExists: /<doma:appendExists>([^<]*)</.exec(valueBlock)?.[1],
      fixed: [
        ...valueBlock.matchAll(/<doma:fixValue>([\s\S]*?)<\/doma:fixValue>/g),
      ].map((m) => {
        const f = (t: string): string =>
          new RegExp(`<doma:${t}>([^<]*)</doma:${t}>`).exec(m[1])?.[1] ?? '';
        return [f('position'), f('low'), f('high'), f('text')];
      }),
    },
  };
}

async function main(): Promise<void> {
  const names = process.argv.slice(2).length
    ? process.argv.slice(2).map((n) => n.toUpperCase())
    : DEFAULTS;

  const logger = createConnectionLogger();
  const connection: IAbapConnection = await createTestConnection(logger);

  // Per field: how many domains filled it in, and the distinct values seen.
  const seen = new Map<string, Set<string>>();
  const note = (field: string, value: string): void => {
    if (value === '' || value === '000000') return;
    if (!seen.has(field)) seen.set(field, new Set());
    (seen.get(field) as Set<string>).add(value);
  };

  let read = 0;
  let intervals = 0;
  let withTable = 0;
  let withFixed = 0;

  try {
    say(`probe-domain-document-shape — ${names.length} domain(s)`);
    say();

    for (const name of names) {
      let xml = '';
      try {
        const wire = await getDomain(connection, name);
        xml = String(wire.data ?? '');
        if (xml.trim() === '') {
          say(`${name}: 200 with an empty body — nothing to read`);
          continue;
        }
      } catch (error) {
        const status = (error as { response?: { status?: number } }).response
          ?.status;
        say(`${name}: not read (status ${status ?? '?'})`);
        continue;
      }
      read += 1;
      const d = parse(xml);
      for (const [k, v] of Object.entries(d.type)) note(`type.${k}`, v);
      for (const [k, v] of Object.entries(d.output)) note(`output.${k}`, v);
      if (d.value.table) {
        withTable += 1;
        note('value.valueTableRef', d.value.table);
      }
      if (d.value.fixed.length) withFixed += 1;
      for (const [position, low, high, text] of d.value.fixed) {
        if (high !== '') intervals += 1;
        note('value.fixValue.position', position);
        say(
          `  ${name} fixValue: position=${position} low=${JSON.stringify(low)} high=${JSON.stringify(high)} text=${JSON.stringify(text)}`,
        );
      }
      say(
        `${name}: type=${d.type.datatype}(${d.type.length}` +
          `${d.type.decimals && d.type.decimals !== '000000' ? `,${d.type.decimals}` : ''})` +
          ` outputLength=${d.output.length ?? '(absent)'}` +
          ` style=${d.output.style ?? '(absent)'}` +
          ` conversionExit=${d.output.conversionExit || '(empty)'}` +
          ` signExists=${d.output.signExists ?? '(absent)'}` +
          ` lowercase=${d.output.lowercase ?? '(absent)'}` +
          ` ampm=${d.output.ampmFormat ?? '(absent)'}` +
          ` valueTable=${d.value.table ?? '(none)'}` +
          ` fixValues=${d.value.fixed.length}`,
      );
    }

    say();
    say(`read ${read} of ${names.length}`);
    say(
      `  ${withFixed} carry fixed values, of which ${intervals} fixValue(s) use a \`high\` — an interval`,
    );
    say(`  ${withTable} point at a value table instead`);
    say();
    say('FIELDS THAT WERE EVER FILLED IN — the model has to carry these');
    for (const field of [...seen.keys()].sort()) {
      const values = [...(seen.get(field) as Set<string>)].slice(0, 6);
      say(`  ${field.padEnd(28)} ${values.join(', ')}`);
    }
  } finally {
    await releaseTestConnection(connection);
  }
}

main().catch((error) => {
  say(`probe failed: ${(error as Error).message}`);
  process.exitCode = 1;
});
