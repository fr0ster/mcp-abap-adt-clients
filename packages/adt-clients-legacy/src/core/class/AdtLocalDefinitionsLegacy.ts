/**
 * AdtLocalDefinitionsLegacy - the class's `definitions` include handler for legacy SAP
 * systems (SAP_BASIS 7.40, measured on 7.40 SP04)
 *
 * Overrides:
 * - readTransport() — refused without a request, as the container class's is.
 */

import {
  AdtLocalDefinitions,
  type AdtPerformedBy,
  CLASS,
  type ClassValues,
  type classDocuments,
  type ResultValuesOf,
} from '@mcp-abap-adt/adt-clients';
import type {
  AdtObjectIdentity,
  IAdtError,
  IAdtOperationOptions,
  IAdtResponse,
  IAnalyse,
  IClassConfig,
} from '@mcp-abap-adt/interfaces-adt';
import { noTransportResource } from '../shared/refusalLegacy';

export class AdtLocalDefinitionsLegacy<
  T extends ClassValues = ResultValuesOf<typeof classDocuments>,
> extends AdtLocalDefinitions<T, 'basis740'> {
  /**
   * Refused without a request: the inherited member asks for the container
   * class's `GET <class URI>/transport`, which answers `404` on 7.40 SP04
   * (record B4-cycles-20261026-2019, step c6-readTransport, the same request
   * `AdtClassLegacy.readTransport` refuses).
   */
  override readTransport<E extends IAdtError>(
    this: this & AdtPerformedBy<'localDefinitions', 'transport'>,
    config: AdtObjectIdentity<IClassConfig, 'className'>,
    _options: ({ withLongPolling?: boolean } & IAdtOperationOptions<E>) & {
      analyse: IAnalyse<E>;
    },
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>>;
  override readTransport(
    this: this & AdtPerformedBy<'localDefinitions', 'transport'>,
    config: AdtObjectIdentity<IClassConfig, 'className'>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<IAdtError>,
  ): Promise<IAdtResponse<T['transport'], IAdtError>>;
  override async readTransport<E extends IAdtError = IAdtError>(
    this: this & AdtPerformedBy<'localDefinitions', 'transport'>,
    config: AdtObjectIdentity<IClassConfig, 'className'>,
    _options?: { withLongPolling?: boolean } & IAdtOperationOptions<E>,
  ): Promise<IAdtResponse<T['transport'], E | IAdtError>> {
    return noTransportResource<T['transport'], E>(
      CLASS.uri(config.className as string),
    );
  }
}
