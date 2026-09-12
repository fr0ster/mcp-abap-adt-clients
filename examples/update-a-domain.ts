/**
 * Update a domain — **this is what `updateDomain` used to do for you.**
 *
 * Until 19.0.0 one call did all of it: GET the current document, patch the
 * fields named in the config into it, PUT the result. You passed a description
 * and the rest of the domain survived because the package had read it.
 *
 * That read is gone. Everything below is the body of the old method, moved to
 * where the decisions were always being made on your behalf — which fields are
 * yours to change, what to do when the read comes back empty, whether the
 * document you send is complete. Nothing here is new work; it is the same work,
 * visible.
 *
 * Six types are like this: domain, package, dataElement, tableType, transport
 * and functionGroup. The shape is identical for all six.
 */

import type { AdtClient } from '../src/clients/AdtClient';

/** The fields the old `updateDomain` accepted and patched in for you. */
export interface IDomainEdits {
  description?: string;
  datatype?: string;
  length?: number;
  decimals?: number;
}

/**
 * The patch half of the old method, verbatim in spirit: replace what was named,
 * leave the rest of the document exactly as the server wrote it.
 *
 * Building a document from scratch instead would drop what this package does
 * not model — `abapLanguageVersion` and its neighbours — which is why the
 * server's own body is the base.
 */
export function patchDomain(document: string, edits: IDomainEdits): string {
  let xml = document;
  if (edits.description !== undefined) {
    xml = xml.replace(
      /adtcore:description="[^"]*"/,
      `adtcore:description="${edits.description}"`,
    );
  }
  if (edits.datatype !== undefined) {
    xml = xml.replace(
      /<doma:datatype>[^<]*<\/doma:datatype>/,
      `<doma:datatype>${edits.datatype}</doma:datatype>`,
    );
  }
  if (edits.length !== undefined) {
    xml = xml.replace(
      /<doma:length>[^<]*<\/doma:length>/,
      `<doma:length>${edits.length}</doma:length>`,
    );
  }
  if (edits.decimals !== undefined) {
    xml = xml.replace(
      /<doma:decimals>[^<]*<\/doma:decimals>/,
      `<doma:decimals>${edits.decimals}</doma:decimals>`,
    );
  }
  return xml;
}

export async function updateADomain(
  client: AdtClient,
  domainName: string,
  edits: IDomainEdits,
): Promise<void> {
  const domain = client.getDomain();

  // 1. The read the method used to make. `readMetadata`, not `read`: a domain
  //    has no source, its document is the object.
  //
  //    A not-yet-ready object answers `200` with an empty body, never a 404, so
  //    this can succeed and carry nothing. What that means for your write is
  //    your call — the package used to raise `XmlPatchError` here and no longer
  //    does, because "the object is absent" and "the object is empty" are the
  //    same answer and it could not tell them apart.
  const current = await domain.readMetadata({ domainName });
  if (!current.ok) throw new Error(current.getError().message);
  const document = String(current.getResult().value ?? '');

  // 2. The patch the method used to apply.
  const edited = patchDomain(document, edits);

  // 3. The lock window the method used to open and close around the write.
  const locked = await domain.lock({ domainName });
  if (!locked.ok) throw new Error(locked.getError().message);
  const lockHandle = locked.getResult().value;

  try {
    // 4. The write. Whether `edited` is complete is your system's ruling: this
    //    package inspects nothing, and the server says so in its own words.
    const written = await domain.updateMetadata(
      { domainName, document: edited },
      { lockHandle },
    );
    if (!written.ok) throw new Error(written.getError().message);
  } finally {
    await domain.unlock({ domainName }, lockHandle);
  }
}
