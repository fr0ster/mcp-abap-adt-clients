import { XMLParser } from 'fast-xml-parser';

const versionParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true,
});

const asArray = <T>(value: T | T[] | undefined): T[] =>
  value === undefined ? [] : Array.isArray(value) ? value : [value];

/**
 * What a deletion check answers: `del:checkResponse`.
 *
 * Its own type, and its own strategy slot in every result set, because it is a
 * different document from the one `check` reads. A check run answers
 * `chkl:messages` from `POST /checkruns`; a deletion check answers
 * `del:checkResponse` from `POST /deletion/check`, carrying `del:isDeletable`,
 * the reference counts and the transport that holds the object.
 *
 * They shared a slot for one commit, and the consequence is the reason this
 * exists: a consumer who injected a parser for their check runs would have had
 * it handed the deletion document — wrong answer at best, a throw at worst.
 */
export type DeletionCheckResult = string;
