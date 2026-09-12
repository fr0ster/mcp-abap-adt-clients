/**
 * Update a class — **this is what `updateClassWithCheck` used to do for you.**
 *
 * Until 19.0.0 that member ran a check, judged the report, and wrote only if it
 * approved; `updateTestClasses` did the same for an include. Both are gone, and
 * both are below: the steps are identical, and the judgement is the one thing
 * that moved, because a check that finds a warning is not the same decision for
 * a backup tool and for an editor.
 *
 * **The write carries the whole source.** `update` replaces what the object
 * holds — it does not merge, and nothing is read on your behalf to keep what
 * you leave out. Sending one method body replaces the class with that method
 * body.
 */

import type { AdtClient } from '../src/clients/AdtClient';

export async function updateAClass(
  client: AdtClient,
  className: string,
  edit: (source: string) => string,
): Promise<void> {
  const cls = client.getClass();

  // 1. Read what it holds. This is the base you edit — skip it and you are
  //    writing a class you never looked at.
  const current = await cls.read({ className }, 'active');
  if (!current.ok) throw new Error(current.getError().message);
  const source = String(current.getResult().value ?? '');

  // 2. Your edit, on the whole source.
  const edited = edit(source);

  // 3. The check the old `updateClassWithCheck` ran here — and judged. It
  //    answers its report now, whatever the findings; what a warning means for
  //    whether you write is yours. Skip this whole block if you do not want a
  //    check, which is a choice the old member did not offer.
  const report = await cls.check({ className, sourceCode: edited }, 'inactive');
  if (!report.ok) throw new Error(report.getError().message);
  if (
    /<\w*:?checkMessage[^>]*type="E"/.test(
      String(report.getResult().value ?? ''),
    )
  ) {
    throw new Error(`check found an error in ${className}; not writing`);
  }

  // 4. Lock. The handle is yours to carry and yours to give back.
  const locked = await cls.lock({ className });
  if (!locked.ok) throw new Error(locked.getError().message);
  const lockHandle = locked.getResult().value;

  try {
    // 5. Write. Whether `edited` is a valid, complete class is your system's
    //    ruling, not this package's — it inspects nothing and says so on the
    //    write, in its own words.
    const written = await cls.update(
      { className },
      { sourceCode: edited, lockHandle },
    );
    if (!written.ok) throw new Error(written.getError().message);
  } finally {
    // 6. Unlock, refused write or not. A handle left held blocks the next
    //    caller with a 403 and nothing visible holding it.
    await cls.unlock({ className }, lockHandle);
  }

  // 7. Activate. ADT answers `200` with a checklist even when it did not
  //    activate; see judge-a-refusal.ts for reading that.
  const activated = await cls.activate({ className });
  if (!activated.ok) throw new Error(activated.getError().message);
}
