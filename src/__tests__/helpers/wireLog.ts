/**
 * What actually went over the wire, in the shape Eclipse's own trace prints.
 *
 * Comparing this library against Eclipse has repeatedly turned on a detail that
 * neither a test verdict nor a step log can show: a header we send and it does
 * not, a status it survives and we treat as fatal, a call it makes between two
 * of ours. Reading those out of a passing run was guesswork until this existed.
 *
 * Off unless `WIRE_LOG` names a file, so ordinary runs are untouched:
 *
 *   WIRE_LOG=/tmp/wire.txt npx jest --runInBand integration/core/package
 *
 * It wraps the transport rather than the connection on purpose. By the time a
 * request reaches `send()` every header is on it — CSRF, cookies, session type,
 * connection id — which is exactly the set worth comparing. Above that they do
 * not exist yet.
 */

import * as fs from 'node:fs';

interface WireRequest {
  method: string;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, unknown>;
  data?: unknown;
}

interface WireResponse {
  status: number;
  statusText?: string;
  headers: unknown;
  data?: unknown;
}

/** Header names whose value is a credential or a token, never written out. */
const REDACT = new Set([
  'authorization',
  'x-csrf-token',
  'cookie',
  'set-cookie',
]);

function headerLines(headers: unknown, indent = '  '): string {
  if (!headers || typeof headers !== 'object') return `${indent}(none)\n`;
  const entries = Object.entries(headers as Record<string, unknown>)
    .map(([k, v]) => [
      k,
      REDACT.has(k.toLowerCase()) ? '<redacted>' : String(v),
    ])
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return `${indent}(none)\n`;
  const width = Math.max(...entries.map(([k]) => k.length));
  return entries
    .map(([k, v]) => `${indent}${k.padEnd(width)} : ${v}\n`)
    .join('');
}

function bodyLine(data: unknown, limit = 1200): string {
  if (data === undefined || data === null || data === '') return '';
  const text = typeof data === 'string' ? data : JSON.stringify(data);
  return `  body: ${text.length > limit ? `${text.slice(0, limit)}… (${text.length} chars)` : text}\n`;
}

/**
 * Wrap a transport so every `send()` is written to `WIRE_LOG`.
 *
 * A Proxy rather than a subclass: the two transports are different classes with
 * different constructors, and both reach private fields, so anything that
 * copies them would have to be written twice and would break on the next field
 * either one gains.
 */
export function withWireLog<T extends object>(transport: T): T {
  const path = process.env.WIRE_LOG;
  if (!path) return transport;

  const write = (chunk: string) => {
    try {
      fs.appendFileSync(path, chunk);
    } catch {
      // A wire log that cannot be written must not take the run down with it.
    }
  };

  write(`\n===== wire log opened ${new Date().toISOString()} =====\n`);

  return new Proxy(transport, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function') return value;
      if (prop !== 'send') return value.bind(target);

      return async (request: WireRequest) => {
        const query = request.params
          ? Object.entries(request.params)
              .map(([k, v]) => `${k}=${String(v)}`)
              .join('&')
          : '';
        const url = query
          ? `${request.url}${request.url.includes('?') ? '&' : '?'}${query}`
          : request.url;

        write(`\n${request.method.toUpperCase()} ${url}\n`);
        write(headerLines(request.headers));
        write(bodyLine(request.data));

        try {
          const response = (await (
            value as (r: WireRequest) => Promise<WireResponse>
          ).call(target, request)) as WireResponse;
          write(
            `  <- ${response.status}${response.statusText ? ` ${response.statusText}` : ''}\n`,
          );
          write(headerLines(response.headers, '     '));
          write(bodyLine(response.data, 1200).replace('  body:', '     body:'));
          return response;
        } catch (error) {
          const status =
            (error as { response?: { status?: number } })?.response?.status ??
            (error as { status?: number })?.status;
          write(`  <- ${status ?? 'threw'} ${(error as Error).message}\n`);
          const response = (
            error as { response?: { headers?: unknown; data?: unknown } }
          )?.response;
          if (response?.headers) write(headerLines(response.headers, '     '));
          // The body of a refusal is the part worth reading — a 400 whose XML
          // names the message is the difference between "it failed" and knowing
          // why. Logged here because axios carries it on the error, not on a
          // response this function ever returns.
          if (response?.data !== undefined) {
            write(
              bodyLine(response.data, 1600).replace('  body:', '     body:'),
            );
          }
          throw error;
        }
      };
    },
  }) as T;
}
