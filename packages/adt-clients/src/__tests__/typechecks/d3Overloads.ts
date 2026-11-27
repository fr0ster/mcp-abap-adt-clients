/**
 * D3 of #304: every member is the interfaces' overload pair — a generic one
 * that requires `analyse` and answers its failure beside the library's own
 * (`E | IAdtError`, C3), then a plain one answering `IAdtError`. One member
 * per family (its lock), and the members of other shapes; a call with
 * `analyse` and no type argument infers `E` from it.
 *
 * Type-level only, compiled by `npm run test:check`; nothing here runs.
 */
import type {
  IAdtError,
  IAdtHeaders,
  IAdtResponse,
  IAnalyse,
} from '@mcp-abap-adt/interfaces-adt';
import type { IAbapConnection } from '@mcp-abap-adt/interfaces-adt-connection';
import type { AdtClient } from '../../clients/AdtClient';
import type { AdtRuntimeClient } from '../../clients/AdtRuntimeClient';
import { getSystemInformation } from '../../utils/systemInfo';

interface IMyFailure extends IAdtError {
  readonly mine: true;
}

type Equal<A, B> =
  (<X>() => X extends A ? 1 : 2) extends <X>() => X extends B ? 1 : 2
    ? true
    : false;
type ErrorOf<R> = R extends IAdtResponse<unknown, infer F> ? F : never;

declare const client: AdtClient;
declare const runtime: AdtRuntimeClient;
declare const connection: IAbapConnection;
declare const headers: IAdtHeaders;
declare const analyse: IAnalyse<IMyFailure>;

/** The generic overload's answer: `analyse`'s failure beside the library's own. */
function expectGeneric<R>(
  _answer: R &
    (Equal<ErrorOf<R>, IMyFailure | IAdtError> extends true ? unknown : never),
): void {}
/** The plain overload's answer: the library's own failure alone. */
function expectPlain<R>(
  _answer: R & (Equal<ErrorOf<R>, IAdtError> extends true ? unknown : never),
): void {}

export async function overloadPairs(): Promise<void> {
  {
    // getClass().lock
    const h = client.getClass();
    const c = { className: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getInterface().lock
    const h = client.getInterface();
    const c = { interfaceName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getProgram().lock
    const h = client.getProgram();
    const c = { programName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getFunctionGroup().lock
    const h = client.getFunctionGroup();
    const c = { functionGroupName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getFunctionModule().lock
    const h = client.getFunctionModule();
    const c = { functionGroupName: 'ZFG', functionModuleName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getInclude().lock
    const h = client.getInclude();
    const c = { includeName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getDdl().lock
    const h = client.getDdl();
    const c = { ddlName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getDomain().lock
    const h = client.getDomain();
    const c = { domainName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getDataElement().lock
    const h = client.getDataElement();
    const c = { dataElementName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getStructure().lock
    const h = client.getStructure();
    const c = { structureName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getTable().lock
    const h = client.getTable();
    const c = { tableName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getTableType().lock
    const h = client.getTableType();
    const c = { tableTypeName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getServiceDefinition().lock
    const h = client.getServiceDefinition();
    const c = { serviceDefinitionName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getBehaviorDefinition().lock
    const h = client.getBehaviorDefinition();
    const c = { name: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getMetadataExtension().lock
    const h = client.getMetadataExtension();
    const c = { name: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getTransformation().lock
    const h = client.getTransformation();
    const c = { transformationName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getAccessControl().lock
    const h = client.getAccessControl();
    const c = { accessControlName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getMessageClass().lock
    const h = client.getMessageClass();
    const c = { name: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // getPackage().lock
    const h = client.getPackage();
    const c = { packageName: 'ZOBJ' };
    expectGeneric(await h.lock<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.lock<IMyFailure>(c);
    expectPlain(await h.lock(c));
  }
  {
    // Inferred from `analyse`, no type argument.
    const h = client.getClass();
    expectGeneric(await h.lock({ className: 'ZOBJ' }, { analyse }));
  }
  {
    const h = client.getUtils();
    const q = { query: 'Z*' };
    expectGeneric(await h.search<IMyFailure>(q, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.search<IMyFailure>(q);
    expectPlain(await h.search(q));
  }
  {
    // A parented read: its parent's name before the options.
    const h = client.getUtils();
    expectGeneric(
      await h.readObjectSource('CLAS/OC', 'ZOBJ', undefined, 'active', {
        analyse,
      }),
    );
    expectGeneric(
      await h.readObjectMetadata('FUGR/FF', 'ZFM', 'ZFG', { analyse }),
    );
    // @ts-expect-error -- a generic call names its analyse
    await h.readObjectSource<'CLAS/OC', IMyFailure>('CLAS/OC', 'ZOBJ');
    expectPlain(await h.readObjectSource('CLAS/OC', 'ZOBJ'));
    expectPlain(await h.readObjectMetadata('FUGR/FF', 'ZFM', 'ZFG'));
  }
  {
    const h = runtime.getAtc();
    expectGeneric(await h.createWorklist<IMyFailure>('V', { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.createWorklist<IMyFailure>('V', {});
    expectPlain(await h.createWorklist('V'));
  }
  {
    const c = connection;
    expectGeneric(await getSystemInformation<IMyFailure>(c, { analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await getSystemInformation<IMyFailure>(c);
    expectPlain(await getSystemInformation(c));
  }
  {
    const h = client.getMessageClassMessage();
    const o = {
      headers,
      classDocument: '<doc/>',
      classLockHandle: 'CH',
      messageLockHandle: 'MH',
    };
    const c = { className: 'ZMC', msgno: '001', msgtext: 'text' };
    expectGeneric(await h.update<IMyFailure>(c, { ...o, analyse }));
    // @ts-expect-error -- a generic call names its analyse
    await h.update<IMyFailure>(c, o);
    expectPlain(await h.update(c, o));
  }
}
