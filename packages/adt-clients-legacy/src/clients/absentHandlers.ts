/**
 * The handlers of the 21 types a legacy system (SAP_BASIS 7.40, measured on
 * 7.40 SP04) does not have at all (C5 of #304).
 *
 * The legacy client still hands one out, so a caller of `AdtClient` that is
 * given the legacy client carries on instead of crashing at the factory. Each
 * is a subclass of the modern handler: an instance of it, constructed with the
 * options the modern factory gives, whose every public operation answers the
 * same refusal and sends no request — the endpoint is not served (missing from
 * the system's discovery or, where discovery is silent, answered `404` when
 * measured). The modern class's private helpers stay its own (a subclass
 * cannot redeclare them, TS2415); they are reached only from the operations,
 * which are all overridden. Decision 11, "The exception: legacy endpoints".
 */

import {
  ACCESS_CONTROL,
  type AccessControlValues,
  AdtAccessControl,
  AdtAppendStructure,
  AdtAuthorizationField,
  AdtBehaviorDefinition,
  AdtBehaviorImplementation,
  AdtDataElement,
  AdtDdicTableType,
  AdtDomain,
  AdtEnhancement,
  AdtFeatureToggle,
  AdtMetadataExtension,
  type AdtModernVariant,
  AdtScalarFunction,
  AdtScalarFunctionImplementation,
  AdtServiceBinding,
  AdtServiceDefinition,
  AdtStructure,
  AdtTable,
  AdtTableSettings,
  AdtTextElements,
  AdtTransformation,
  AdtTypeGroup,
  type AppendStructureValues,
  AUTHORIZATION_FIELD,
  type AuthorizationFieldValues,
  BEHAVIOR_DEFINITION,
  type BehaviorDefinitionValues,
  type ClassValues,
  DATA_ELEMENT,
  type DataElementValues,
  DOMAIN,
  type DomainValues,
  ENHANCEMENT,
  type EnhancementValues,
  FEATURE_TOGGLE,
  type FeatureToggleValues,
  failed,
  METADATA_EXTENSION,
  type MetadataExtensionValues,
  SCALAR_FUNCTION,
  SCALAR_FUNCTION_IMPLEMENTATION,
  type ScalarFunctionImplementationValues,
  type ScalarFunctionValues,
  SERVICE_BINDING,
  SERVICE_DEFINITION,
  type ServiceDefinitionValues,
  type ServiceValues,
  STRUCTURE,
  type StructureValues,
  TABLE,
  TABLE_SETTINGS,
  TABLE_TYPE,
  type TableSettingsValues,
  type TableTypeValues,
  type TableValues,
  TEXT_ELEMENTS,
  type TextElementsValues,
  TRANSFORMATION,
  type TransformationValues,
  TYPE_GROUP,
  type TypeGroupValues,
} from '@mcp-abap-adt/adt-clients';
import type { IAdtError, IAdtResponse } from '@mcp-abap-adt/interfaces-adt';
import { AdtObjectErrorCodes } from '@mcp-abap-adt/interfaces-adt';

/** What a type's refusal rests on: a measurement, or absence from discovery. */
export type AbsenceEvidence = 'measured' | 'not-advertised';

/**
 * The kind of the settings handler 7.40 refuses: the base getter's on a
 * client that declares no newer kind (`'basis740'` and both newer kinds),
 * so the refusing handler takes every argument the root's does.
 */
export type LegacySettingsKind = 'basis740' | AdtModernVariant;

/**
 * The refusal every operation of an absent type answers. `evidence` is what
 * it rests on, and the message says which: `'measured'` — 7.40 SP04 answered
 * `404` for the endpoint over RFC; `'not-advertised'` — the endpoint is only
 * absent from 7.40 SP04's discovery, not measured, so the type is refused
 * until a run measures it.
 */
export function absentRefusal(
  objectType: string,
  endpoint: string,
  evidence: AbsenceEvidence,
): IAdtError {
  const why =
    evidence === 'measured'
      ? `a legacy system (7.40 SP04) was measured not to serve ${endpoint}, ` +
        'the endpoint this type needs.'
      : `${endpoint}, the endpoint this type needs, is absent from the ` +
        'discovery of a legacy system (7.40 SP04): not advertised, not ' +
        'measured, so the type is refused until a run measures it.';
  return {
    origin: 'refusal',
    code: AdtObjectErrorCodes.UNSUPPORTED_OPERATION,
    message: `${objectType} is not supported on this SAP system: ${why}`,
  };
}

/** AdtDomain on a legacy system: every operation refuses, nothing is sent. */
export class AdtDomainAbsentLegacy extends AdtDomain<DomainValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('Domain', DOMAIN.collection, 'measured');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtDataElement on a legacy system: every operation refuses, nothing is sent. */
export class AdtDataElementAbsentLegacy extends AdtDataElement<DataElementValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('DataElement', DATA_ELEMENT.collection, 'measured');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtStructure on a legacy system: every operation refuses, nothing is sent. */
export class AdtStructureAbsentLegacy extends AdtStructure<
  StructureValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('Structure', STRUCTURE.collection, 'measured');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtTable on a legacy system: every operation refuses, nothing is sent. */
export class AdtTableAbsentLegacy extends AdtTable<TableValues, 'basis740'> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('Table', TABLE.collection, 'measured');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtTableSettings on a legacy system: every operation refuses, nothing is sent. */
export class AdtTableSettingsAbsentLegacy extends AdtTableSettings<
  TableSettingsValues,
  LegacySettingsKind
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'TableSettings',
      TABLE_SETTINGS.collection,
      'not-advertised',
    );
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtTextElements on a legacy system: every operation refuses, nothing is sent. */
export class AdtTextElementsAbsentLegacy extends AdtTextElements<
  TextElementsValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'TextElements',
      TEXT_ELEMENTS.programs,
      'not-advertised',
    );
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtDdicTableType on a legacy system: every operation refuses, nothing is sent. */
export class AdtDdicTableTypeAbsentLegacy extends AdtDdicTableType<TableTypeValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('TableType', TABLE_TYPE.collection, 'not-advertised');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtAccessControl on a legacy system: every operation refuses, nothing is sent. */
export class AdtAccessControlAbsentLegacy extends AdtAccessControl<
  AccessControlValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'AccessControl',
      ACCESS_CONTROL.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtServiceDefinition on a legacy system: every operation refuses, nothing is sent. */
export class AdtServiceDefinitionAbsentLegacy extends AdtServiceDefinition<
  ServiceDefinitionValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'ServiceDefinition',
      SERVICE_DEFINITION.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtServiceBinding on a legacy system: every operation refuses, nothing is sent. */
export class AdtServiceBindingAbsentLegacy extends AdtServiceBinding<
  ServiceValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'ServiceBinding',
      SERVICE_BINDING.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getServiceBindingTypes(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getServiceGroup(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtBehaviorDefinition on a legacy system: every operation refuses, nothing is sent. */
export class AdtBehaviorDefinitionAbsentLegacy extends AdtBehaviorDefinition<
  BehaviorDefinitionValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'BehaviorDefinition',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtBehaviorImplementation on a legacy system: every operation refuses, nothing is sent. */
export class AdtBehaviorImplementationAbsentLegacy extends AdtBehaviorImplementation<ClassValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'BehaviorImplementation',
      BEHAVIOR_DEFINITION.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readImplementations(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtMetadataExtension on a legacy system: every operation refuses, nothing is sent. */
export class AdtMetadataExtensionAbsentLegacy extends AdtMetadataExtension<
  MetadataExtensionValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'MetadataExtension',
      METADATA_EXTENSION.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtEnhancement on a legacy system: every operation refuses, nothing is sent. */
export class AdtEnhancementAbsentLegacy extends AdtEnhancement<
  EnhancementValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('Enhancement', ENHANCEMENT.root, 'measured');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtAuthorizationField on a legacy system: every operation refuses, nothing is sent. */
export class AdtAuthorizationFieldAbsentLegacy extends AdtAuthorizationField<AuthorizationFieldValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'AuthorizationField',
      AUTHORIZATION_FIELD.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtFeatureToggle on a legacy system: every operation refuses, nothing is sent. */
export class AdtFeatureToggleAbsentLegacy extends AdtFeatureToggle<FeatureToggleValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'FeatureToggle',
      FEATURE_TOGGLE.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async switchOn(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async switchOff(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getRuntimeState(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkState(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtTransformation on a legacy system: every operation refuses, nothing is sent. */
export class AdtTransformationAbsentLegacy extends AdtTransformation<
  TransformationValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'Transformation',
      TRANSFORMATION.collection,
      'measured',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/**
 * AdtTypeGroup on a legacy system: every operation refuses, nothing is sent.
 * 7.40 SP04's discovery lists no type group collection (the corpus's
 * `system-description-basis-740--03-discovery`); not measured.
 */
export class AdtTypeGroupAbsentLegacy extends AdtTypeGroup<
  TypeGroupValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('TypeGroup', TYPE_GROUP.collection, 'not-advertised');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtScalarFunction on a legacy system: every operation refuses, nothing is sent. */
export class AdtScalarFunctionAbsentLegacy extends AdtScalarFunction<
  ScalarFunctionValues,
  'basis740'
> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'ScalarFunction',
      SCALAR_FUNCTION.collection,
      'measured',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtScalarFunctionImplementation on a legacy system: every operation refuses, nothing is sent. */
export class AdtScalarFunctionImplementationAbsentLegacy extends AdtScalarFunctionImplementation<ScalarFunctionImplementationValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal(
      'ScalarFunctionImplementation',
      SCALAR_FUNCTION_IMPLEMENTATION.collection,
      'not-advertised',
    );
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async updateMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}

/** AdtAppendStructure on a legacy system: every operation refuses, nothing is sent. */
export class AdtAppendStructureAbsentLegacy extends AdtAppendStructure<AppendStructureValues> {
  /** The refusal every operation answers. */
  #absence(): IAdtError {
    return absentRefusal('AppendStructure', STRUCTURE.collection, 'measured');
  }

  override async validate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async create(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async read(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readMetadata(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async readTransport(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async update(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async checkDeletion(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async delete(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async activate(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async check(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async lock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async unlock(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersions(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }

  override async getVersionSource(): Promise<IAdtResponse<never>> {
    return failed(this.#absence());
  }
}
