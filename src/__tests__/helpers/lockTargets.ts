/**
 * Lock targets for the lock-registry tests: a domain and a data element that
 * exist, are active, and are gone again when the test is.
 *
 * **A create alone is a shell.** A domain's POST carries the name, the package
 * and the description; `<doma:datatype/>` comes back empty. A data element's is
 * the same with `<dtel:typeKind/>`. The type is written by the update, as the
 * full document, and only then does activation have something to activate.
 * These tests used to stop at the create: every run left ZAC_LOCKREG_DOM,
 * ZAC_LOCKREG_DTEL and ZAC_DOMLOCK_DOM behind as inactive shells, and the
 * cleanup that should have removed them dropped the delete's answer — a
 * refusal comes back as an answer, not a throw, so its `.catch` never fired.
 *
 * Every answer here is read, and a failed cleanup throws.
 */

import { analyseDeletion } from '@mcp-abap-adt/adt-strategies';
import type { AdtClient } from '../../clients/AdtClient';
import type { IDataElementConfig } from '../../core/dataElement';
import type { IDomainConfig } from '../../core/domain';

const {
  dataElementDocumentFor,
  domainDocumentFor,
  mustSucceed,
  readDocumentForUpdate,
  writeAndActivate,
} = require('./test-helper');

type Handler = {
  readMetadata(config: any): Promise<any>;
  delete(config: any, options?: any): Promise<any>;
};

/** Delete, and raise what SAP said when it refused. */
async function deleteOrRaise(
  handler: Handler,
  config: Record<string, unknown>,
  what: string,
): Promise<void> {
  mustSucceed(await handler.delete(config, { analyse: analyseDeletion }), what);
}

/** Remove what a run that died before its cleanup left behind. */
async function removeLeftover(
  handler: Handler,
  config: Record<string, unknown>,
  what: string,
): Promise<void> {
  const existing = await handler.readMetadata(config);
  if (existing.ok) {
    await deleteOrRaise(handler, config, `delete leftover ${what}`);
    return;
  }
  if (existing.getError().response?.status !== 404) {
    mustSucceed(existing, `look for leftover ${what}`);
  }
}

/** A fresh, typed, active domain. */
export async function recreateActiveDomain(
  client: AdtClient,
  config: IDomainConfig,
  params: { datatype?: string; length?: number; decimals?: number },
): Promise<void> {
  const domain = client.getDomain();
  const key = {
    domainName: config.domainName,
    transportRequest: config.transportRequest,
  };
  await removeLeftover(domain, key, config.domainName);
  mustSucceed(await domain.create(config), `create ${config.domainName}`);
  const shell = await readDocumentForUpdate(
    () => domain.readMetadata({ domainName: config.domainName }),
    `read ${config.domainName} after create`,
  );
  mustSucceed(
    await writeAndActivate(
      domain,
      {
        domainName: config.domainName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
      },
      {
        source: domainDocumentFor(shell, {
          description: config.description,
          ...params,
        }),
      },
    ),
    `write and activate ${config.domainName}`,
  );
}

/** A fresh, active data element typed by `domainName`. */
export async function recreateActiveDataElement(
  client: AdtClient,
  config: IDataElementConfig,
  domainName: string,
): Promise<void> {
  const element = client.getDataElement();
  const key = {
    dataElementName: config.dataElementName,
    transportRequest: config.transportRequest,
  };
  await removeLeftover(element, key, config.dataElementName);
  mustSucceed(
    await element.create({
      ...config,
      typeKind: 'domain',
      typeName: domainName,
    } as IDataElementConfig),
    `create ${config.dataElementName}`,
  );
  const shell = await readDocumentForUpdate(
    () => element.readMetadata({ dataElementName: config.dataElementName }),
    `read ${config.dataElementName} after create`,
  );
  mustSucceed(
    await writeAndActivate(
      element,
      {
        dataElementName: config.dataElementName,
        packageName: config.packageName,
        transportRequest: config.transportRequest,
      },
      {
        source: dataElementDocumentFor(shell, {
          description: config.description,
          type_kind: 'domain',
          domain_name: domainName,
        }),
      },
    ),
    `write and activate ${config.dataElementName}`,
  );
}

export async function deleteDomain(
  client: AdtClient,
  config: IDomainConfig,
): Promise<void> {
  await deleteOrRaise(
    client.getDomain(),
    {
      domainName: config.domainName,
      transportRequest: config.transportRequest,
    },
    `cleanup delete ${config.domainName}`,
  );
}

export async function deleteDataElement(
  client: AdtClient,
  config: IDataElementConfig,
): Promise<void> {
  await deleteOrRaise(
    client.getDataElement(),
    {
      dataElementName: config.dataElementName,
      transportRequest: config.transportRequest,
    },
    `cleanup delete ${config.dataElementName}`,
  );
}
