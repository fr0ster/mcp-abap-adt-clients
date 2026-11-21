/**
 * What the abapGit client tests share: a connection that records every request
 * and answers it as the test says, the client built over it, and sanitised
 * abapGit documents with canaries where a credential could be echoed.
 */

import type {
  IAbapConnection,
  IAbapRequestOptions,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import type { ILogger } from '@mcp-abap-adt/interfaces-utils';
import { AdtAbapGitClient } from '../../../../clients/AdtAbapGitClient';
import { abapGitDocuments } from '../../../../clients/abapGit/types';

/** What the connection does with a request: answer it, or throw. */
export type Script = (request: IAbapRequestOptions) => IAdtWireResponse;

export const ok = (data: unknown = '', status = 200): IAdtWireResponse => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
});

/** Records every request; answers by its script (a `200` with no body by default). */
export class ScriptedConnection implements IAbapConnection {
  readonly sent: IAbapRequestOptions[] = [];

  constructor(private readonly script: Script = () => ok()) {}

  async connect(): Promise<void> {}

  async getBaseUrl(): Promise<string> {
    return '';
  }

  getSessionId(): string | null {
    return null;
  }

  setSessionType(): void {}

  async makeAdtRequest<T = unknown, D = unknown>(
    options: IAbapRequestOptions,
  ): Promise<IAdtWireResponse<T, D>> {
    this.sent.push(options);
    // `T` is the caller's to name; the scripted answer is no value of every `T`.
    return this.script(options) as IAdtWireResponse<T, D>;
  }
}

/** A logger that keeps every line it is handed, message and meta alike. */
export function recordingLogger(): { logger: ILogger; lines: string[] } {
  const lines: string[] = [];
  const keep =
    (level: string) =>
    (message: string, meta?: unknown): void => {
      lines.push(`${level} ${message} ${JSON.stringify(meta ?? null)}`);
    };
  return {
    lines,
    logger: {
      info: keep('info'),
      warn: keep('warn'),
      error: keep('error'),
      debug: keep('debug'),
    },
  };
}

export function gitClient(
  connection: IAbapConnection,
  logger?: ILogger,
): AdtAbapGitClient {
  return new AdtAbapGitClient(connection, {
    results: abapGitDocuments,
    ...(logger === undefined ? {} : { logger }),
  });
}

/** Values a credential could take; none may reach anything but the request. */
export const CANARIES = {
  user: 'canary-user-7q3z',
  token: 'ghp_CanaryToken0123456789abcdef',
  password: 'canary-password-xy',
  // base64 of `canary-password-xy`, as a `Password` header carries it.
  base64Password: 'Y2FuYXJ5LXBhc3N3b3JkLXh5',
} as const;

const C = `${CANARIES.user} ${CANARIES.token} ${CANARIES.base64Password}`;

/** The credential the tests pass: its user and password are canaries. */
export const CREDENTIALS = {
  user: CANARIES.user,
  password: CANARIES.password,
} as const;

/** An abapGit exception with canaries in every place the facts drop. */
export function exception(
  options: { t100?: boolean; httpStatus?: string } = {},
): string {
  return (
    '<?xml version="1.0" encoding="utf-8"?><exc:exception xmlns:exc="http://www.sap.com/abapxml/types/communicationframework">' +
    '<namespace id="org.abapgit.adt"/>' +
    `<type id="ExceptionResourceFailure ${CANARIES.user}"/>` +
    `<message lang="EN">Authentication failed for ${C}</message>` +
    `<localizedMessage lang="EN">Authentication failed for ${C}</localizedMessage>` +
    '<properties>' +
    (options.t100 === false
      ? ''
      : '<entry key="T100KEY-ID">ABAPGIT_MSG</entry><entry key="T100KEY-NO">017</entry>') +
    `<entry key="T100KEY-V1">${CANARIES.user}</entry>` +
    `<entry key="T100KEY-V2">${CANARIES.token}</entry>` +
    `<entry key="T100KEY-V3">${CANARIES.base64Password}</entry>` +
    `<entry key="LONGTEXT">The remote answered for ${C}</entry>` +
    (options.httpStatus === undefined
      ? ''
      : `<entry key="http_status">${options.httpStatus}</entry>`) +
    '</properties></exc:exception>'
  );
}

/** R2/R4/R8: object results, SAP's message text holding the canaries. */
export const objectResults =
  '<?xml version="1.0" encoding="utf-8"?><abapObjects:abapObjects xmlns:abapObjects="http://www.sap.com/adt/abapgit/abapObjects">' +
  '<abapObjects:abapObject><abapObjects:type>CLAS</abapObjects:type><abapObjects:name>ZCL_DEMO</abapObjects:name>' +
  '<abapObjects:package>ZPKG</abapObjects:package><abapObjects:status>E</abapObjects:status>' +
  `<abapObjects:msgType>E</abapObjects:msgType><abapObjects:msgText>Syntax error ${C}</abapObjects:msgText></abapObjects:abapObject>` +
  '</abapObjects:abapObjects>';

/** R1 on the cloud: one repository, its run status and its log link. */
export const repos =
  '<?xml version="1.0" encoding="utf-8"?><abapgitrepo:repositories xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories" xmlns:atom="http://www.w3.org/2005/Atom">' +
  '<abapgitrepo:repository>' +
  '<abapgitrepo:key>000001</abapgitrepo:key>' +
  '<abapgitrepo:package>ZPKG</abapgitrepo:package>' +
  '<abapgitrepo:url>https://git.example.invalid/team/repo.git</abapgitrepo:url>' +
  '<abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
  `<abapgitrepo:createdBy>${CANARIES.user}</abapgitrepo:createdBy>` +
  '<abapgitrepo:status>E</abapgitrepo:status><abapgitrepo:statusText>Pull finished with errors</abapgitrepo:statusText>' +
  '<atom:link href="/sap/bc/adt/abapgit/repos/000001/log/L1" rel="http://www.sap.com/adt/abapgit/relations/log" type="log_link"/>' +
  '</abapgitrepo:repository></abapgitrepo:repositories>';

/** R6: what a pull would overwrite, its action descriptions holding canaries. */
export const modifiedObjects =
  '<?xml version="1.0" encoding="utf-8"?><agitpullmodifiedobjects:abapgitpullmodifiedobjects xmlns:agitpullmodifiedobjects="http://www.sap.com/adt/abapgit/agitpullmodifiedobjects" xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<agitpullmodifiedobjects:overwriteObjects>' +
  `<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS/OC" adtcore:name="ZCL_DEMO" adtcore:packageName="ZPKG" agitpullmodifiedobjects:action="2" agitpullmodifiedobjects:actionDescription="Overwrite ${C}"/>` +
  '</agitpullmodifiedobjects:overwriteObjects>' +
  '<agitpullmodifiedobjects:packageWarningObjects>' +
  '<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/programs/programs/zdemo" adtcore:type="PROG/P" adtcore:name="ZDEMO" adtcore:packageName="ZOTHER" agitpullmodifiedobjects:action="3" agitpullmodifiedobjects:actionDescription="Package differs"/>' +
  '</agitpullmodifiedobjects:packageWarningObjects>' +
  '</agitpullmodifiedobjects:abapgitpullmodifiedobjects>';

/** R9: one unstaged object with a file; the comment's text holds canaries. */
export const staging =
  '<?xml version="1.0" encoding="utf-8"?><abapgitstaging:abapgitstaging xmlns:abapgitstaging="http://www.sap.com/adt/abapgit/staging" xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<abapgitstaging:unstaged_objects>' +
  '<abapgitstaging:abapgitobject abapgitstaging:wbkey="CLASZCL_DEMO" abapgitstaging:version="active" adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS/OC" adtcore:name="ZCL_DEMO" adtcore:packageName="ZPKG">' +
  '<abapgitstaging:abapgitfile abapgitstaging:name="zcl_demo.clas.abap" abapgitstaging:path="/src/" abapgitstaging:localState="M" abapgitstaging:remoteState=""/>' +
  '</abapgitstaging:abapgitobject>' +
  '</abapgitstaging:unstaged_objects>' +
  '<abapgitstaging:staged_objects/><abapgitstaging:ignored_objects/>' +
  `<abapgitstaging:abapgit_comment abapgitstaging:comment="Commit ${C}">` +
  '<abapgitstaging:author abapgitstaging:name="Ada Author" abapgitstaging:email="ada@example.invalid"/>' +
  '<abapgitstaging:committer abapgitstaging:name="Carl Committer" abapgitstaging:email="carl@example.invalid"/>' +
  '</abapgitstaging:abapgit_comment>' +
  '</abapgitstaging:abapgitstaging>';

/** R13/R14: an external repository's branch; its display name holds canaries. */
export const externalRepo =
  '<?xml version="1.0" encoding="utf-8"?><abapgitexternalrepo:externalRepoInfo xmlns:abapgitexternalrepo="http://www.sap.com/adt/abapgit/externalRepo">' +
  '<abapgitexternalrepo:accessMode>PRIVATE</abapgitexternalrepo:accessMode>' +
  '<abapgitexternalrepo:branch>' +
  '<abapgitexternalrepo:sha1>0123456789abcdef0123456789abcdef01234567</abapgitexternalrepo:sha1>' +
  '<abapgitexternalrepo:name>refs/heads/main</abapgitexternalrepo:name>' +
  '<abapgitexternalrepo:type>HD</abapgitexternalrepo:type>' +
  '<abapgitexternalrepo:isHead>X</abapgitexternalrepo:isHead>' +
  `<abapgitexternalrepo:displayName>main ${C}</abapgitexternalrepo:displayName>` +
  '<abapgitexternalrepo:folderLogic>FULL</abapgitexternalrepo:folderLogic>' +
  '</abapgitexternalrepo:branch>' +
  '</abapgitexternalrepo:externalRepoInfo>';

/** Every canary, as text a serialised value would hold. */
export function holdsCanary(value: unknown): string[] {
  const text = JSON.stringify(value, (_key, v) =>
    v instanceof Error ? { ...v, message: v.message, stack: v.stack } : v,
  );
  return Object.values(CANARIES).filter((canary) =>
    (text ?? '').includes(canary),
  );
}
