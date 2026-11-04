/**
 * Every create this library writes, called with values a test chooses, and
 * what was sent read back.
 *
 * A create interpolates the caller's values into XML attributes. The test
 * reads the body with an XML parser: a value that was not escaped makes the
 * body ill-formed, or reads back as something else.
 */

import type { IAbapRequestOptions } from '@mcp-abap-adt/interfaces-adt-connection';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { create as createAccessControl } from '../../../core/accessControl/create';
import { create as createAppendStructure } from '../../../core/appendStructure/create';
import { create as createBehaviorDefinition } from '../../../core/behaviorDefinition/create';
import { create as createClass } from '../../../core/class/create';
import { create as createDataElement } from '../../../core/dataElement/create';
import { createDdl } from '../../../core/ddl/create';
import { create as createDomain } from '../../../core/domain/create';
import { create as createEnhancement } from '../../../core/enhancement/create';
import { create as createFunctionGroup } from '../../../core/functionGroup/create';
import { create as createFunctionModule } from '../../../core/functionModule/create';
import { create as createInclude } from '../../../core/include/create';
import { create as createInterface } from '../../../core/interface/create';
import { createMessageClass } from '../../../core/messageClass/create';
import { createMetadataExtension } from '../../../core/metadataExtension/create';
import { createPackage } from '../../../core/package/create';
import { create as createProgram } from '../../../core/program/create';
import { create as createScalarFunction } from '../../../core/scalarFunction/create';
import { create as createScalarFunctionImplementation } from '../../../core/scalarFunctionImplementation/create';
import { AdtServiceBinding } from '../../../core/service/AdtService';
import { serviceDocuments } from '../../../core/service/types';
import { create as createServiceDefinition } from '../../../core/serviceDefinition/create';
import { create as createStructure } from '../../../core/structure/create';
import { createTable } from '../../../core/table/create';
import { createTableType } from '../../../core/tabletype/create';
import { create as createTransformation } from '../../../core/transformation/create';
import { TEST_HEADERS } from '../../helpers/adtHeaders';
import { RecordingConnection } from '../../helpers/recordingConnection';

/** The values a test chooses; the rest of each create's arguments are plain. */
export interface CreateValues {
  /** The description. */
  readonly description?: string;
  /** The object's own name. */
  readonly name?: string;
  /** The package. */
  readonly packageName?: string;
  /** What the object refers to: a superclass, a container, a base. */
  readonly reference?: string;
  /** The responsible person. */
  readonly responsible?: string;
  /** The master system. */
  readonly masterSystem?: string;
  /** The original language. */
  readonly masterLanguage?: string;
}

/** What a create wrote: the request as it left. */
export interface SentCreate {
  readonly request: IAbapRequestOptions;
  readonly body: string;
}

/** One create, and which of the values it writes. */
export interface CreateCase {
  readonly label: string;
  /** Writes a description. */
  readonly description: boolean;
  /** Writes a reference to another object besides its package. */
  readonly reference: boolean;
  /** Writes a responsible person and a master system. */
  readonly person: boolean;
  /** Writes `adtcore:masterLanguage`. */
  readonly language: boolean;
  /** Belongs to a function group, not a package: writes no package. */
  readonly noPackage?: true;
  readonly run: (
    connection: RecordingConnection,
    values: CreateValues,
  ) => Promise<unknown>;
}

const n = (v: CreateValues, plain: string): string => v.name ?? plain;
const pkg = (v: CreateValues): string => v.packageName ?? 'ZPKG';
const ref = (v: CreateValues, plain: string): string => v.reference ?? plain;

/** The creates the escaping rule covers. */
export const CREATES: readonly CreateCase[] = [
  {
    label: 'class',
    description: true,
    reference: true,
    person: false,
    language: true,
    run: (c, v) =>
      createClass(c, TEST_HEADERS, {
        class_name: n(v, 'ZCL_X'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        master_system: v.masterSystem,
        masterLanguage: v.masterLanguage,
        superclass: ref(v, 'ZCL_SUPER'),
      }),
  },
  {
    label: 'interface',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createInterface(c, TEST_HEADERS, {
        interfaceName: n(v, 'ZIF_X'),
        packageName: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'program',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createProgram(c, TEST_HEADERS, {
        programName: n(v, 'ZPROG'),
        packageName: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'function group',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createFunctionGroup(c, TEST_HEADERS, {
        functionGroupName: n(v, 'ZFG'),
        packageName: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'function module',
    noPackage: true,
    description: true,
    reference: true,
    person: true,
    language: false,
    run: (c, v) =>
      createFunctionModule(c, TEST_HEADERS, {
        functionModuleName: n(v, 'Z_FM'),
        functionGroupName: ref(v, 'ZFG'),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
      }),
  },
  {
    label: 'domain',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createDomain(c, TEST_HEADERS, {
        domain_name: n(v, 'ZDOM'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'data element',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createDataElement(c, TEST_HEADERS, {
        data_element_name: n(v, 'ZDTEL'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'DDL source',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createDdl(c, TEST_HEADERS, {
        ddl_name: n(v, 'ZDDL'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'structure',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createStructure(c, TEST_HEADERS, {
        structureName: n(v, 'ZSTRU'),
        packageName: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'table',
    description: false,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createTable(c, TEST_HEADERS, {
        table_name: n(v, 'ZTAB'),
        package_name: pkg(v),
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'table type',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createTableType(c, TEST_HEADERS, {
        tabletype_name: n(v, 'ZTTYP'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'behaviour definition',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createBehaviorDefinition(c, TEST_HEADERS, {
        name: n(v, 'ZBDEF'),
        package: pkg(v),
        description: v.description ?? 'd',
        implementationType: 'Managed',
        language: v.masterLanguage,
        masterSystem: v.masterSystem,
        responsible: v.responsible,
      }),
  },
  {
    label: 'metadata extension',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createMetadataExtension(c, TEST_HEADERS, {
        name: n(v, 'ZDDLX'),
        packageName: pkg(v),
        description: v.description ?? 'd',
        masterLanguage: v.masterLanguage,
        masterSystem: v.masterSystem,
        responsible: v.responsible,
      }),
  },
  {
    label: 'service definition',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createServiceDefinition(c, TEST_HEADERS, {
        service_definition_name: n(v, 'ZSRVD'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'service binding',
    description: true,
    reference: true,
    person: true,
    language: true,
    run: (c, v) =>
      new AdtServiceBinding(c, { results: serviceDocuments }).create(
        {
          bindingName: n(v, 'ZSRVB'),
          packageName: pkg(v),
          description: v.description ?? 'd',
          serviceDefinitionName: ref(v, 'ZSRVD'),
          serviceName: 'ZSRV',
          serviceVersion: '0001',
          bindingVariant: 'ODATA_V4_UI',
          masterLanguage: v.masterLanguage,
          masterSystem: v.masterSystem,
          responsible: v.responsible,
        },
        { headers: TEST_HEADERS },
      ),
  },
  {
    label: 'access control',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createAccessControl(c, TEST_HEADERS, {
        access_control_name: n(v, 'ZDCL'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'transformation',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createTransformation(c, TEST_HEADERS, {
        transformation_name: n(v, 'ZXSLT'),
        transformation_type: 'XSLTProgram',
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterSystem: v.masterSystem,
        responsible: v.responsible,
        masterLanguage: v.masterLanguage,
      }),
  },
];

/**
 * The creates that write `adtcore:masterLanguage` and are not in
 * {@link CREATES}, for the language rule.
 */
export const OTHER_LANGUAGE_CREATES: readonly CreateCase[] = [
  {
    label: 'package',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createPackage(c, TEST_HEADERS, {
        package_name: n(v, 'ZPKG_X'),
        super_package: 'ZPKG',
        description: v.description ?? 'd',
        software_component: 'LOCAL',
        record_changes: false,
        master_language: v.masterLanguage,
      }),
  },
  {
    label: 'include',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createInclude(c, TEST_HEADERS, {
        includeName: n(v, 'ZINC'),
        packageName: pkg(v),
        description: v.description ?? 'd',
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'message class',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createMessageClass(c, TEST_HEADERS, {
        name: n(v, 'ZMSG'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        master_language: v.masterLanguage,
      }),
  },
  {
    label: 'enhancement',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createEnhancement(c, TEST_HEADERS, {
        enhancement_name: n(v, 'ZENH'),
        enhancement_type: 'enhsxsb',
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'append structure',
    description: true,
    reference: true,
    person: true,
    language: true,
    run: (c, v) =>
      createAppendStructure(c, TEST_HEADERS, {
        append_structure_name: n(v, 'ZAPPEND'),
        base_object: 'ZBASE',
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'scalar function',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createScalarFunction(c, TEST_HEADERS, {
        scalar_function_name: n(v, 'ZSF'),
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterLanguage: v.masterLanguage,
      }),
  },
  {
    label: 'scalar function implementation',
    description: true,
    reference: false,
    person: true,
    language: true,
    run: (c, v) =>
      createScalarFunctionImplementation(c, TEST_HEADERS, {
        implementation_name: n(v, 'ZSFI'),
        scalar_function_name: 'ZSF',
        package_name: pkg(v),
        description: v.description ?? 'd',
        masterLanguage: v.masterLanguage,
      }),
  },
];

/** Run one create on a fresh recording connection; what it sent. */
export async function sent(
  create: CreateCase,
  values: CreateValues,
): Promise<SentCreate> {
  const connection = new RecordingConnection();
  await create.run(connection, values);
  const request = connection.sent.at(-1);
  if (request === undefined) throw new Error(`${create.label}: nothing sent`);
  const body = typeof request.data === 'string' ? request.data : '';
  return { request, body };
}

/** A request header, by name as sent. */
export function headerOf(
  request: IAbapRequestOptions,
  name: string,
): string | undefined {
  const value = request.headers?.[name];
  return typeof value === 'string' ? value : undefined;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  parseTagValue: false,
  processEntities: true,
});

/** Every attribute value of a document, in document order. */
export function attributeValues(xml: string): string[] {
  const values: string[] = [];
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node !== 'object' || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key.startsWith('@_') && typeof value === 'string') values.push(value);
      else walk(value);
    }
  };
  const parsed: unknown = parser.parse(xml);
  walk(parsed);
  return values;
}

const ENTITIES = ['&amp;', '&lt;', '&gt;', '&quot;', '&apos;'];

/**
 * Whether every attribute value in the text is written as XML requires: no
 * `<` and no `&` that does not begin one of the five entities. The parser's
 * validator lets both through, so the text is read here, character by
 * character.
 */
function attributesEscaped(xml: string): boolean {
  let inTag = false;
  let quote: string | undefined;
  for (let i = 0; i < xml.length; i++) {
    const character = xml[i];
    if (quote !== undefined) {
      if (character === quote) quote = undefined;
      else if (character === '<') return false;
      else if (
        character === '&' &&
        !ENTITIES.some((entity) => xml.startsWith(entity, i))
      )
        return false;
    } else if (inTag) {
      if (character === '"' || character === "'") quote = character;
      else if (character === '>') inTag = false;
    } else if (character === '<') {
      inTag = true;
    }
  }
  return quote === undefined;
}

/** Whether a document is well-formed XML, its attribute values escaped. */
export function wellFormed(xml: string): boolean {
  return XMLValidator.validate(xml) === true && attributesEscaped(xml);
}
