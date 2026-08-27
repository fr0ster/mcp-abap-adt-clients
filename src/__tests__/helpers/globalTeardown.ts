/**
 * Gives back the one session the run worked on.
 *
 * `globalSetup` opens it and keeps it — every test file joins that session
 * rather than asking the server for its own. Something has to release it, and
 * this is the only place that knows the run is over.
 *
 * Without this it would sit until the trial's idle timeout, which the server
 * reports as `inactivityTimeout: 1800` — half an hour of one of the two
 * concurrent sessions a user gets, held by nobody.
 */

const { loadTestEnv } = require('./test-helper');

import { forgetSessionMaterial, readSessionMaterial } from './sharedSession';

/**
 * The one place this file writes to stdout.
 *
 * Same reasoning as globalSetup: this runs outside any test context, with no
 * logger to inject, and when it has something to say about a session left open
 * then saying it IS the job.
 */
function say(message: string): void {
  // biome-ignore lint/suspicious/noConsole: test teardown, no logger to inject
  console.log(message);
}

export default async function globalTeardown() {
  loadTestEnv();

  const material = readSessionMaterial();
  if (!material) return;

  try {
    // Built here rather than carried from globalSetup: jest loads setup and
    // teardown as separate modules, and a connection object does not cross
    // between them any more than it crosses between test files. The session
    // does — which is the whole point — so a connector that adopts it can say
    // goodbye on its behalf.
    const { createTestConnection } = require('./sessionConfig');
    const connection = await createTestConnection();
    await connection.disconnect();
    say('[globalTeardown] shared session released');
  } catch (error) {
    // Never throws. A teardown that fails would replace the run's own verdict
    // with a complaint about cleanup, and the session it failed to release is
    // freed by the idle timeout regardless.
    say(
      `[globalTeardown] could not release the shared session: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    forgetSessionMaterial();
  }
}
