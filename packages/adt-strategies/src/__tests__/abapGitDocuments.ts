import type { IAdtWireResponse } from '@mcp-abap-adt/interfaces-adt-connection';

/**
 * abapGit documents for the readings and the facts reducer.
 *
 * Sanitised: every name, key, URL and person is invented. The shapes follow
 * the simple transformations that write them (Code, read 2026-11-21): R1
 * `ABAPGIT_ST_REPOS_V2` (cloud) and `ZABAPGIT_ST_REPOS` (onprem, no `status`,
 * no `statusText`, no `folderLogic`, and a pull link without `type`); R2/R4/R8
 * `ABAPGIT_ST_REPO_POST_RES_V2`; R6 `ABAPGIT_ST_PULL_MODIFIED_OBJS`; R9
 * `ABAPGIT_ST_REPO_STAGE` with `ABAPGIT_ST_REPO_STAGE_OBJECT`; R13/R14
 * `ABAPGIT_ST_REPO_INFO_EXT_RS_V2` (its `folderLogic` sits in the branch);
 * the exception document is `CL_ADT_EXCEPTION_UTILITY->create_exc_response`.
 * The tag lists of R1 on both systems were measured (2026-11-21); the R1
 * documents below carry exactly those elements.
 */

export const answer = (data: string, status = 200): IAdtWireResponse => ({
  data,
  status,
  statusText: 'OK',
  headers: {},
});

/** Values a credential could take; they must survive no reduction. */
export const CANARIES = {
  user: 'canary-user-7q3z',
  token: 'ghp_CanaryToken0123456789abcdef',
  // base64 of `canary-password-xy`, as a `Password` header carries it.
  base64Password: 'Y2FuYXJ5LXBhc3N3b3JkLXh5',
} as const;

const C = `${CANARIES.user} ${CANARIES.token} ${CANARIES.base64Password}`;

const ATOM = 'xmlns:atom="http://www.w3.org/2005/Atom"';
const REL = 'http://www.sap.com/adt/abapgit/relations';

export const cloudRepos = (
  status: string | null,
  logKey: string | null,
  options: { statusLink?: boolean; logLink?: boolean } = {},
): string => {
  const statusLink = options.statusLink ?? logKey !== null;
  const logLink = options.logLink ?? logKey !== null;
  return (
    `<?xml version="1.0" encoding="utf-8"?><abapgitrepo:repositories xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories" ${ATOM}>` +
    '<atom:link href="/sap/bc/adt/abapgit/repos" rel="self" type="repos_link"/>' +
    '<abapgitrepo:repository>' +
    '<abapgitrepo:key>000001</abapgitrepo:key>' +
    '<abapgitrepo:package>ZPKG_CLOUD</abapgitrepo:package>' +
    '<abapgitrepo:folderLogic>PREFIX</abapgitrepo:folderLogic>' +
    '<abapgitrepo:url>https://git.example.invalid/team/repo.git</abapgitrepo:url>' +
    '<abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
    '<abapgitrepo:createdBy>DEVELOPER</abapgitrepo:createdBy>' +
    '<abapgitrepo:createdEmail>developer@example.invalid</abapgitrepo:createdEmail>' +
    '<abapgitrepo:createdAt>20261121101500</abapgitrepo:createdAt>' +
    '<abapgitrepo:deserializedBy>PULLER</abapgitrepo:deserializedBy>' +
    '<abapgitrepo:deserializedEmail>puller@example.invalid</abapgitrepo:deserializedEmail>' +
    '<abapgitrepo:deserializedAt>20261121111500</abapgitrepo:deserializedAt>' +
    (status === null
      ? ''
      : `<abapgitrepo:status>${status}</abapgitrepo:status><abapgitrepo:statusText>Pull finished with errors</abapgitrepo:statusText>`) +
    `<atom:link href="/sap/bc/adt/abapgit/repos/000001/pull/v2" rel="${REL}/pull/v2" type="pull_link_v2"/>` +
    `<atom:link href="/sap/bc/adt/abapgit/repos/000001/pull" rel="${REL}/pull" type="pull_link"/>` +
    `<atom:link href="/sap/bc/adt/abapgit/repos/000001/stage" rel="${REL}/stage" type="stage_link"/>` +
    (statusLink && logKey !== null
      ? `<atom:link href="/sap/bc/adt/abapgit/repos/000001/status/${logKey}" rel="${REL}/status" type="status_link"/>`
      : '') +
    (logLink && logKey !== null
      ? `<atom:link href="/sap/bc/adt/abapgit/repos/000001/log/${logKey}" rel="${REL}/log" type="log_link"/>`
      : '') +
    '</abapgitrepo:repository></abapgitrepo:repositories>'
  );
};

/** Onprem R1: no status, no status text, no folder logic, no log link. */
export const onpremRepos =
  `<?xml version="1.0" encoding="utf-8"?><abapgitrepo:repositories xmlns:abapgitrepo="http://www.sap.com/adt/abapgit/repositories" ${ATOM}>` +
  '<abapgitrepo:repository>' +
  '<abapgitrepo:key>000042</abapgitrepo:key>' +
  '<abapgitrepo:package>ZPKG_ONPREM</abapgitrepo:package>' +
  '<abapgitrepo:url>https://git.example.invalid/team/onprem.git</abapgitrepo:url>' +
  '<abapgitrepo:branchName>refs/heads/main</abapgitrepo:branchName>' +
  '<abapgitrepo:createdBy>DEVELOPER</abapgitrepo:createdBy>' +
  '<abapgitrepo:createdAt>20261120090000</abapgitrepo:createdAt>' +
  '<abapgitrepo:deserializedBy>PULLER</abapgitrepo:deserializedBy>' +
  '<abapgitrepo:deserializedAt>20261120093000</abapgitrepo:deserializedAt>' +
  `<atom:link href="/sap/bc/adt/abapgit/repos/000042/pull" rel="${REL}/pull"/>` +
  `<atom:link href="/sap/bc/adt/abapgit/repos/000042/stage" rel="${REL}/stage" type="stage_link"/>` +
  '</abapgitrepo:repository></abapgitrepo:repositories>';

/** R2/R4/R8: object results, with SAP's message text where a canary sits. */
export const objectResults =
  '<?xml version="1.0" encoding="utf-8"?><abapObjects:abapObjects xmlns:abapObjects="http://www.sap.com/adt/abapgit/abapObjects">' +
  '<abapObjects:abapObject><abapObjects:type>CLAS</abapObjects:type><abapObjects:name>ZCL_DEMO</abapObjects:name>' +
  '<abapObjects:package>ZPKG</abapObjects:package><abapObjects:status>E</abapObjects:status>' +
  `<abapObjects:msgType>E</abapObjects:msgType><abapObjects:msgText>Syntax error ${C}</abapObjects:msgText></abapObjects:abapObject>` +
  '<abapObjects:abapObject><abapObjects:type>INTF</abapObjects:type><abapObjects:name>ZIF_DEMO</abapObjects:name>' +
  '<abapObjects:package>ZPKG</abapObjects:package><abapObjects:status>S</abapObjects:status>' +
  '<abapObjects:msgType>S</abapObjects:msgType><abapObjects:msgText>Imported</abapObjects:msgText></abapObjects:abapObject>' +
  '</abapObjects:abapObjects>';

/** R6: what a pull would overwrite. */
export const modifiedObjects =
  '<?xml version="1.0" encoding="utf-8"?><agitpullmodifiedobjects:abapgitpullmodifiedobjects xmlns:agitpullmodifiedobjects="http://www.sap.com/adt/abapgit/agitpullmodifiedobjects" xmlns:adtcore="http://www.sap.com/adt/core">' +
  '<agitpullmodifiedobjects:overwriteObjects>' +
  `<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS/OC" adtcore:name="ZCL_DEMO" adtcore:packageName="ZPKG" agitpullmodifiedobjects:action="2" agitpullmodifiedobjects:actionDescription="Overwrite ${C}"/>` +
  '<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/oo/interfaces/zif_demo" adtcore:type="INTF/OI" adtcore:name="ZIF_DEMO" adtcore:packageName="ZPKG" agitpullmodifiedobjects:action="1"/>' +
  '</agitpullmodifiedobjects:overwriteObjects>' +
  '<agitpullmodifiedobjects:packageWarningObjects>' +
  '<agitpullmodifiedobjects:abapgitobjects adtcore:uri="/sap/bc/adt/programs/programs/zdemo" adtcore:type="PROG/P" adtcore:name="ZDEMO" adtcore:packageName="ZOTHER" agitpullmodifiedobjects:action="3" agitpullmodifiedobjects:actionDescription="Package differs"/>' +
  '</agitpullmodifiedobjects:packageWarningObjects>' +
  '</agitpullmodifiedobjects:abapgitpullmodifiedobjects>';

/** R9: the staging, with links, a transport and the comment's text holding canaries. */
export const staging =
  `<?xml version="1.0" encoding="utf-8"?><abapgitstaging:abapgitstaging xmlns:abapgitstaging="http://www.sap.com/adt/abapgit/staging" xmlns:adtcore="http://www.sap.com/adt/core" ${ATOM}>` +
  '<abapgitstaging:unstaged_objects>' +
  '<abapgitstaging:abapgitobject abapgitstaging:wbkey="CLASZCL_DEMO" abapgitstaging:version="active" adtcore:uri="/sap/bc/adt/oo/classes/zcl_demo" adtcore:type="CLAS/OC" adtcore:name="ZCL_DEMO" adtcore:packageName="ZPKG">' +
  '<abapgitstaging:transport><abapgitstaging:number>DEVK900001</abapgitstaging:number>' +
  `<atom:link href="/sap/bc/adt/cts/transportrequests/DEVK900001?${CANARIES.token}" rel="http://www.sap.com/cts/relations/transport" type="transport_link"/></abapgitstaging:transport>` +
  '<abapgitstaging:abapgitfile abapgitstaging:name="zcl_demo.clas.abap" abapgitstaging:path="/src/" abapgitstaging:localState="M" abapgitstaging:remoteState="">' +
  `<atom:link href="/sap/bc/adt/abapgit/repos/000001/files?filename=zcl_demo.clas.abap&amp;u=${CANARIES.user}" rel="${REL}/file/local" type="file_link"/>` +
  '</abapgitstaging:abapgitfile>' +
  '<abapgitstaging:abapgitfile abapgitstaging:name="zcl_demo.clas.xml" abapgitstaging:path="/src/" abapgitstaging:localState="A" abapgitstaging:remoteState="D"/>' +
  '<atom:link href="/sap/bc/adt/oo/classes/zcl_demo" rel="http://www.sap.com/adt/relations/objects" type="object_link"/>' +
  '</abapgitstaging:abapgitobject>' +
  '</abapgitstaging:unstaged_objects>' +
  '<abapgitstaging:staged_objects>' +
  '<abapgitstaging:abapgitobject abapgitstaging:wbkey="INTFZIF_DEMO" abapgitstaging:version="active" adtcore:uri="/sap/bc/adt/oo/interfaces/zif_demo" adtcore:type="INTF/OI" adtcore:name="ZIF_DEMO" adtcore:packageName="ZPKG">' +
  '<abapgitstaging:abapgitfile abapgitstaging:name="zif_demo.intf.abap" abapgitstaging:path="/src/" abapgitstaging:localState="M" abapgitstaging:remoteState="M"/>' +
  '</abapgitstaging:abapgitobject>' +
  '</abapgitstaging:staged_objects>' +
  '<abapgitstaging:ignored_objects/>' +
  `<abapgitstaging:abapgit_comment abapgitstaging:comment="Commit ${C}">` +
  '<abapgitstaging:author abapgitstaging:name="Ada Author" abapgitstaging:email="ada@example.invalid"/>' +
  '<abapgitstaging:committer abapgitstaging:name="Carl Committer" abapgitstaging:email="carl@example.invalid"/>' +
  '</abapgitstaging:abapgit_comment>' +
  `<atom:link href="/sap/bc/adt/abapgit/repos/000001/push" rel="${REL}/push" type="push_link"/>` +
  '</abapgitstaging:abapgitstaging>';

/**
 * R13/R14: an external repository's branches. `sha` is where the plan's spec
 * places cloud's hash (`ABAPGIT_ST_REPO_INFO_EXT_RS_V2`); both spellings are
 * read, so each has a document.
 */
export const externalRepo = (
  hash: 'sha1' | 'sha',
  options: { folderLogic?: boolean } = {},
): string =>
  `<?xml version="1.0" encoding="utf-8"?><abapgitexternalrepo:externalRepoInfo xmlns:abapgitexternalrepo="http://www.sap.com/adt/abapgit/externalRepo" ${ATOM}>` +
  '<abapgitexternalrepo:accessMode>PRIVATE</abapgitexternalrepo:accessMode>' +
  '<abapgitexternalrepo:branch>' +
  `<abapgitexternalrepo:${hash}>0123456789abcdef0123456789abcdef01234567</abapgitexternalrepo:${hash}>` +
  '<abapgitexternalrepo:name>refs/heads/main</abapgitexternalrepo:name>' +
  '<abapgitexternalrepo:type>HD</abapgitexternalrepo:type>' +
  '<abapgitexternalrepo:isHead>X</abapgitexternalrepo:isHead>' +
  `<abapgitexternalrepo:displayName>main ${C}</abapgitexternalrepo:displayName>` +
  (options.folderLogic
    ? '<abapgitexternalrepo:folderLogic>FULL</abapgitexternalrepo:folderLogic>'
    : '') +
  `<atom:link href="https://git.example.invalid/${CANARIES.user}:${CANARIES.token}@repo" rel="${REL}/branch" type="branch_link"/>` +
  '</abapgitexternalrepo:branch>' +
  '<abapgitexternalrepo:branch>' +
  `<abapgitexternalrepo:${hash}>fedcba9876543210fedcba9876543210fedcba98</abapgitexternalrepo:${hash}>` +
  '<abapgitexternalrepo:name>refs/heads/dev</abapgitexternalrepo:name>' +
  '<abapgitexternalrepo:type>HD</abapgitexternalrepo:type>' +
  '<abapgitexternalrepo:isHead/>' +
  '<abapgitexternalrepo:displayName>dev</abapgitexternalrepo:displayName>' +
  (options.folderLogic
    ? '<abapgitexternalrepo:folderLogic>FULL</abapgitexternalrepo:folderLogic>'
    : '') +
  '</abapgitexternalrepo:branch>' +
  '</abapgitexternalrepo:externalRepoInfo>';

/**
 * An abapGit exception, as `create_exc_response` writes it: the T100 key, the
 * message variables, a long text and, for R11's auth failure, `http_status`.
 */
export const exception = (
  options: { t100?: boolean; httpStatus?: string } = {},
): string =>
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
  `<entry key="T100KEY-V4">${C}</entry>` +
  `<entry key="LONGTEXT">The remote answered for ${C}</entry>` +
  (options.httpStatus === undefined
    ? ''
    : `<entry key="http_status">${options.httpStatus}</entry>`) +
  '</properties></exc:exception>';
