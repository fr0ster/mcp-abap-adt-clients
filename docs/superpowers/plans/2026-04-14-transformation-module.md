# Transformation Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CRUD support for SAP XSLT transformations (Simple Transformation and XSLT Program) following the existing core module pattern.

**Architecture:** Single module `src/core/transformation/` with `TransformationType` parameter distinguishing `SimpleTransformation` from `XSLTProgram`. All operations share the same ADT endpoint `/sap/bc/adt/xslt/transformations`. Follows the exact same architectural pattern as `src/core/accessControl/`.

**Tech Stack:** TypeScript, fast-xml-parser, axios (via IAbapConnection)

**Spec:** `docs/superpowers/specs/2026-04-14-transformation-module-design.md`

---

### Task 1: Add content type constant and checkRun support

**Files:**
- Modify: `src/constants/contentTypes.ts:168` (after Access Controls section)
- Modify: `src/utils/checkRun.ts:79-84` (add transformation case to getObjectUri switch)

- [ ] **Step 1: Add transformation content type constants**

In `src/constants/contentTypes.ts`, after line 168 (`CT_ACCESS_CONTROL`), add:

```typescript
// Transformations (XSLT)
export const ACCEPT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
export const CT_TRANSFORMATION = 'application/vnd.sap.adt.transformations+xml';
```

- [ ] **Step 2: Add transformation to checkRun getObjectUri**

In `src/utils/checkRun.ts`, add a new case before the `default:` case (after line 81):

```typescript
    case 'transformation':
    case 'xslt/vt':
      return `/sap/bc/adt/xslt/transformations/${encodedName}`;
```

- [ ] **Step 3: Verify build passes**

Run: `npm run build:fast`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/constants/contentTypes.ts src/utils/checkRun.ts
git commit -m "feat(transformation): add content type constants and checkRun support"
```

---

### Task 2: Create types

**Files:**
- Create: `src/core/transformation/types.ts`

- [ ] **Step 1: Create types.ts**

```typescript
import type { IAdtObjectState } from '@mcp-abap-adt/interfaces';

export type TransformationType = 'SimpleTransformation' | 'XSLTProgram';

// Low-level function parameters (snake_case)
export interface ICreateTransformationParams {
  transformation_name: string;
  transformation_type: TransformationType;
  description?: string;
  package_name: string;
  transport_request?: string;
  masterSystem?: string;
  responsible?: string;
}

export interface IUpdateTransformationParams {
  transformation_name: string;
  source_code: string;
  transport_request?: string;
}

export interface IDeleteTransformationParams {
  transformation_name: string;
  transport_request?: string;
}

// Builder configuration (camelCase)
export interface ITransformationConfig {
  transformationName: string;
  transformationType: TransformationType;
  packageName?: string;
  transportRequest?: string;
  description?: string;
  sourceCode?: string;
}

// Uses standard IAdtObjectState fields: readResult, metadataResult, transportResult, etc.
// No additional source-specific field needed — read() populates readResult directly.
export interface ITransformationState extends IAdtObjectState {}
```

- [ ] **Step 3: Verify build**

Run: `npm run build:fast`
Expected: No errors (types file compiles standalone)

- [ ] **Step 4: Commit**

```bash
git add src/core/transformation/types.ts
git commit -m "feat(transformation): add type definitions"
```

---

### Task 3: Create low-level CRUD functions

**Files:**
- Create: `src/core/transformation/create.ts`
- Create: `src/core/transformation/read.ts`
- Create: `src/core/transformation/update.ts`
- Create: `src/core/transformation/delete.ts`
- Create: `src/core/transformation/lock.ts`
- Create: `src/core/transformation/unlock.ts`
- Create: `src/core/transformation/activation.ts`
- Create: `src/core/transformation/check.ts`
- Create: `src/core/transformation/validation.ts`

- [ ] **Step 1: Create create.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { CT_TRANSFORMATION } from '../../constants/contentTypes';
import { limitDescription } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { ICreateTransformationParams } from './types';

/**
 * Low-level: Create transformation (POST)
 * Does NOT activate - just creates the object
 */
export async function create(
  connection: IAbapConnection,
  args: ICreateTransformationParams,
): Promise<AxiosResponse> {
  const url = `/sap/bc/adt/xslt/transformations${args.transport_request ? `?corrNr=${args.transport_request}` : ''}`;

  const username = args.responsible || '';
  const masterSystem = args.masterSystem || '';

  const description = limitDescription(
    args.description || args.transformation_name,
  );
  const transformationName = args.transformation_name.toUpperCase();

  const masterSystemAttr = masterSystem
    ? ` adtcore:masterSystem="${masterSystem}"`
    : '';

  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?><trans:transformation xmlns:trans="http://www.sap.com/adt/transformation" xmlns:adtcore="http://www.sap.com/adt/core" adtcore:description="${description}" adtcore:language="EN" adtcore:name="${transformationName}" adtcore:type="XSLT/VT" adtcore:masterLanguage="EN"${masterSystemAttr} adtcore:responsible="${username}" trans:transformationType="${args.transformation_type}">
  <adtcore:packageRef adtcore:name="${args.package_name.toUpperCase()}"/>
</trans:transformation>`;

  const headers = {
    Accept: CT_TRANSFORMATION,
    'Content-Type': CT_TRANSFORMATION,
  };

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });
}
```

- [ ] **Step 2: Create read.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_SOURCE,
  ACCEPT_TRANSPORT,
  CT_TRANSFORMATION,
} from '../../constants/contentTypes';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IReadOptions } from '../shared/types';

/**
 * Get transformation metadata
 */
export async function getTransformation(
  connection: IAbapConnection,
  transformationName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(transformationName.toLowerCase());
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `/sap/bc/adt/xslt/transformations/${encodedName}${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? CT_TRANSFORMATION,
      },
    },
    { logger },
  );
}

/**
 * Get transformation source code
 */
export async function getTransformationSource(
  connection: IAbapConnection,
  transformationName: string,
  version: 'active' | 'inactive' | 'workingArea' = 'inactive',
  options?: IReadOptions,
  logger?: ILogger,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(transformationName.toLowerCase());
  const queryParams: string[] = [];
  if (version) {
    queryParams.push(`version=${version}`);
  }
  if (options?.withLongPolling) {
    queryParams.push('withLongPolling=true');
  }
  const query = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
  const url = `/sap/bc/adt/xslt/transformations/${encodedName}/source/main${query}`;

  return makeAdtRequestWithAcceptNegotiation(
    connection,
    {
      url,
      method: 'GET',
      timeout: getTimeout('default'),
      headers: {
        Accept: options?.accept ?? ACCEPT_SOURCE,
      },
    },
    { logger },
  );
}

/**
 * Get transformation transport info
 */
export async function getTransformationTransport(
  connection: IAbapConnection,
  transformationName: string,
  options?: IReadOptions,
): Promise<AxiosResponse> {
  const encodedName = encodeSapObjectName(transformationName.toLowerCase());
  const query = options?.withLongPolling ? '?withLongPolling=true' : '';
  const url = `/sap/bc/adt/xslt/transformations/${encodedName}/transport${query}`;

  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: getTimeout('default'),
    headers: {
      Accept: options?.accept ?? ACCEPT_TRANSPORT,
    },
  });
}
```

- [ ] **Step 3: Create update.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_SOURCE, CT_SOURCE } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IUpdateTransformationParams } from './types';

/**
 * Update transformation source code
 * Requires object to be locked first (lockHandle must be provided)
 */
export async function updateTransformation(
  connection: IAbapConnection,
  args: IUpdateTransformationParams,
  lockHandle: string,
): Promise<AxiosResponse> {
  const transformationNameEncoded = encodeSapObjectName(
    args.transformation_name.toLowerCase(),
  );

  const corrNrParam = args.transport_request
    ? `&corrNr=${args.transport_request}`
    : '';
  const url = `/sap/bc/adt/xslt/transformations/${transformationNameEncoded}/source/main?lockHandle=${encodeURIComponent(lockHandle)}${corrNrParam}`;

  const headers: Record<string, string> = {
    Accept: ACCEPT_SOURCE,
    'Content-Type': CT_SOURCE,
  };

  return connection.makeAdtRequest({
    url,
    method: 'PUT',
    timeout: getTimeout('default'),
    data: args.source_code,
    headers,
  });
}
```

- [ ] **Step 4: Create delete.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import {
  ACCEPT_DELETION,
  ACCEPT_DELETION_CHECK,
  CT_DELETION,
  CT_DELETION_CHECK,
} from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';
import type { IDeleteTransformationParams } from './types';

/**
 * Low-level: Check if transformation can be deleted
 */
export async function checkDeletion(
  connection: IAbapConnection,
  params: IDeleteTransformationParams,
): Promise<AxiosResponse> {
  const { transformation_name } = params;

  if (!transformation_name) {
    throw new Error('transformation_name is required');
  }

  const encodedName = encodeSapObjectName(transformation_name);
  const objectUri = `/sap/bc/adt/xslt/transformations/${encodedName}`;

  const checkUrl = '/sap/bc/adt/deletion/check';

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:checkRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}"/>
</del:checkRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION_CHECK,
    'Content-Type': CT_DELETION_CHECK,
  };

  return await connection.makeAdtRequest({
    url: checkUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });
}

/**
 * Low-level: Delete transformation
 */
export async function deleteTransformation(
  connection: IAbapConnection,
  params: IDeleteTransformationParams,
): Promise<AxiosResponse> {
  const { transformation_name, transport_request } = params;

  if (!transformation_name) {
    throw new Error('transformation_name is required');
  }

  const encodedName = encodeSapObjectName(transformation_name);
  const objectUri = `/sap/bc/adt/xslt/transformations/${encodedName}`;

  const deletionUrl = '/sap/bc/adt/deletion/delete';

  let transportNumberTag = '';
  if (transport_request?.trim()) {
    transportNumberTag = `<del:transportNumber>${transport_request}</del:transportNumber>`;
  } else {
    transportNumberTag = '<del:transportNumber/>';
  }

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<del:deletionRequest xmlns:del="http://www.sap.com/adt/deletion" xmlns:adtcore="http://www.sap.com/adt/core">
  <del:object adtcore:uri="${objectUri}">
    ${transportNumberTag}
  </del:object>
</del:deletionRequest>`;

  const headers = {
    Accept: ACCEPT_DELETION,
    'Content-Type': CT_DELETION,
  };

  const response = await connection.makeAdtRequest({
    url: deletionUrl,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlPayload,
    headers,
  });

  return {
    ...response,
    data: {
      success: true,
      transformation_name,
      object_uri: objectUri,
      transport_request: transport_request || 'local',
      message: `Transformation ${transformation_name} deleted successfully`,
    },
  } as AxiosResponse;
}
```

- [ ] **Step 5: Create lock.ts**

```typescript
import type { IAbapConnection } from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { ACCEPT_LOCK } from '../../constants/contentTypes';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Lock transformation for modification
 * Returns lock handle that must be used in subsequent requests
 */
export async function lockTransformation(
  connection: IAbapConnection,
  transformationName: string,
): Promise<string> {
  const transformationNameEncoded = encodeSapObjectName(
    transformationName.toLowerCase(),
  );
  const url = `/sap/bc/adt/xslt/transformations/${transformationNameEncoded}?_action=LOCK&accessMode=MODIFY`;

  const headers = {
    Accept: ACCEPT_LOCK,
  };

  const response = await connection.makeAdtRequest({
    method: 'POST',
    url,
    headers,
    timeout: getTimeout('default'),
  });

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  const result = parser.parse(response.data);
  const lockHandle = result['asx:abap']?.['asx:values']?.DATA?.LOCK_HANDLE;

  if (!lockHandle) {
    throw new Error('Failed to extract lock handle from response');
  }

  return lockHandle;
}
```

- [ ] **Step 6: Create unlock.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Unlock transformation
 * Must use same session and lock handle from lock operation
 */
export async function unlockTransformation(
  connection: IAbapConnection,
  transformationName: string,
  lockHandle: string,
): Promise<AxiosResponse> {
  const transformationNameEncoded = encodeSapObjectName(
    transformationName.toLowerCase(),
  );
  const url = `/sap/bc/adt/xslt/transformations/${transformationNameEncoded}?_action=UNLOCK&lockHandle=${encodeURIComponent(lockHandle)}`;

  return connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
  });
}
```

- [ ] **Step 7: Create activation.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { XMLParser } from 'fast-xml-parser';
import { encodeSapObjectName } from '../../utils/internalUtils';
import { getTimeout } from '../../utils/timeouts';

/**
 * Build activation XML payload
 */
function buildActivationXml(transformationName: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<adtcore:objectReferences xmlns:adtcore="http://www.sap.com/adt/core">
  <adtcore:objectReference adtcore:uri="/sap/bc/adt/xslt/transformations/${encodeSapObjectName(transformationName.toLowerCase())}" adtcore:name="${transformationName.toUpperCase()}"/>
</adtcore:objectReferences>`;
}

/**
 * Parse activation response
 */
function parseActivationResponse(response: AxiosResponse): {
  success: boolean;
  message: string;
} {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '',
  });

  try {
    const result = parser.parse(response.data);
    const properties = result['chkl:messages']?.['chkl:properties'];

    if (properties) {
      const activated =
        properties.activationExecuted === 'true' ||
        properties.activationExecuted === true;
      const checked =
        properties.checkExecuted === 'true' ||
        properties.checkExecuted === true;

      return {
        success: activated && checked,
        message: activated
          ? 'Transformation activated successfully'
          : 'Activation failed',
      };
    }

    return { success: false, message: 'Unknown activation status' };
  } catch (error) {
    return {
      success: false,
      message: `Failed to parse activation response: ${error}`,
    };
  }
}

/**
 * Activate transformation
 */
export async function activateTransformation(
  connection: IAbapConnection,
  transformationName: string,
): Promise<AxiosResponse> {
  const url = '/sap/bc/adt/activation?method=activate&preauditRequested=true';
  const xmlBody = buildActivationXml(transformationName);

  const headers = {
    Accept: 'application/xml',
    'Content-Type': 'application/xml',
  };

  const response = await connection.makeAdtRequest({
    url,
    method: 'POST',
    timeout: getTimeout('default'),
    data: xmlBody,
    headers,
  });

  const activationResult = parseActivationResponse(response);
  if (!activationResult.success) {
    throw new Error(
      `Transformation activation failed: ${activationResult.message}`,
    );
  }

  return response;
}
```

- [ ] **Step 8: Create check.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { parseCheckRunResponse, runCheckRun } from '../../utils/checkRun';

/**
 * Check transformation syntax
 */
export async function checkTransformation(
  connection: IAbapConnection,
  transformationName: string,
  version: string = 'inactive',
  sourceCode?: string,
): Promise<AxiosResponse> {
  const response = await runCheckRun(
    connection,
    'transformation',
    transformationName,
    version,
    'abapCheckRun',
    sourceCode,
  );
  const checkResult = parseCheckRunResponse(response);

  if (checkResult.has_errors) {
    const errorMessages = checkResult.errors.map((err) => err.text).join('; ');
    throw new Error(`Transformation check failed: ${errorMessages}`);
  }

  return response;
}
```

- [ ] **Step 9: Create validation.ts**

```typescript
import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
} from '@mcp-abap-adt/interfaces';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { getTimeout } from '../../utils/timeouts';

/**
 * Validate transformation name
 * Returns raw response from ADT - consumer decides how to interpret it
 */
export async function validateTransformationName(
  connection: IAbapConnection,
  transformationName: string,
  packageName?: string,
  description?: string,
): Promise<AxiosResponse> {
  const url = '/sap/bc/adt/xslt/validation';
  const queryParams = new URLSearchParams({
    objname: transformationName,
  });

  if (packageName) {
    queryParams.append('packagename', packageName);
  }

  if (description) {
    queryParams.append('description', description);
  }

  return connection.makeAdtRequest({
    url: `${url}?${queryParams.toString()}`,
    method: 'POST',
    timeout: getTimeout('default'),
    headers: {
      Accept: ACCEPT_VALIDATION,
    },
  });
}
```

- [ ] **Step 10: Verify build**

Run: `npm run build:fast`
Expected: No errors

- [ ] **Step 11: Commit**

```bash
git add src/core/transformation/create.ts src/core/transformation/read.ts src/core/transformation/update.ts src/core/transformation/delete.ts src/core/transformation/lock.ts src/core/transformation/unlock.ts src/core/transformation/activation.ts src/core/transformation/check.ts src/core/transformation/validation.ts
git commit -m "feat(transformation): add low-level CRUD functions"
```

---

### Task 4: Create high-level AdtTransformation class

**Files:**
- Create: `src/core/transformation/AdtTransformation.ts`

- [ ] **Step 1: Create AdtTransformation.ts**

```typescript
/**
 * AdtTransformation - High-level CRUD operations for Transformation (XSLT) objects
 *
 * Supports both SimpleTransformation and XSLTProgram types.
 *
 * Session management:
 * - stateful: only when doing lock/update/unlock operations
 * - stateless: obligatory after unlock
 * - If no lock/unlock, no stateful needed
 * - activate uses same session/cookies (no stateful needed)
 *
 * Operation chains:
 * - Create: validate → create → check → lock → update (source) → read(longPolling) → unlock → check → activate
 * - Update: lock → check(inactive) → update → read(longPolling) → unlock → check → activate
 * - Delete: check(deletion) → delete
 */

import type {
  HttpError,
  IAbapConnection,
  IAdtObject,
  IAdtOperationOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IAdtSystemContext } from '../../clients/AdtClient';
import { safeErrorMessage } from '../../utils/internalUtils';
import type { IReadOptions } from '../shared/types';
import { activateTransformation } from './activation';
import { checkTransformation } from './check';
import { create as createTransformation } from './create';
import { checkDeletion, deleteTransformation } from './delete';
import { lockTransformation } from './lock';
import {
  getTransformation,
  getTransformationSource,
  getTransformationTransport,
} from './read';
import type { ITransformationConfig, ITransformationState } from './types';
import { unlockTransformation } from './unlock';
import { updateTransformation } from './update';
import { validateTransformationName } from './validation';

export class AdtTransformation
  implements IAdtObject<ITransformationConfig, ITransformationState>
{
  private readonly connection: IAbapConnection;
  private readonly logger?: ILogger;
  private readonly systemContext: IAdtSystemContext;
  public readonly objectType: string = 'Transformation';

  constructor(
    connection: IAbapConnection,
    logger?: ILogger,
    systemContext?: IAdtSystemContext,
  ) {
    this.connection = connection;
    this.logger = logger;
    this.systemContext = systemContext ?? {};
  }

  /**
   * Validate transformation configuration before creation
   */
  async validate(
    config: Partial<ITransformationConfig>,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required for validation');
      state.errors.push({ method: 'validate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await validateTransformationName(
        this.connection,
        config.transformationName,
        config.packageName,
        config.description,
      );
      state.validationResponse = response;
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'validate',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('validate', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Create transformation with full operation chain
   */
  async create(
    config: ITransformationConfig,
    options?: IAdtOperationOptions,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'create', error, timestamp: new Date() });
      throw error;
    }
    if (!config.packageName) {
      throw new Error('Package name is required');
    }
    if (!config.description) {
      throw new Error('Description is required');
    }
    if (!config.transformationType) {
      throw new Error('Transformation type is required');
    }

    try {
      this.logger?.info?.('Creating transformation');
      const createResponse = await createTransformation(this.connection, {
        transformation_name: config.transformationName,
        transformation_type: config.transformationType,
        package_name: config.packageName,
        transport_request: config.transportRequest,
        description: config.description,
        masterSystem: this.systemContext.masterSystem,
        responsible: this.systemContext.responsible,
      });
      state.createResult = createResponse;
      this.logger?.info?.('Transformation created');

      return state;
    } catch (error: unknown) {
      this.logger?.error('Create failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Read transformation source code
   */
  async read(
    config: Partial<ITransformationConfig>,
    version?: 'active' | 'inactive',
    options?: IReadOptions,
  ): Promise<ITransformationState | undefined> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'read', error, timestamp: new Date() });
      throw error;
    }

    try {
      const response = await getTransformationSource(
        this.connection,
        config.transformationName,
        version,
        options,
        this.logger,
      );
      state.readResult = response;
      return state;
    } catch (error: unknown) {
      const e = error as HttpError;
      if (e.response?.status === 404) {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Read transformation metadata
   */
  async readMetadata(
    config: Partial<ITransformationConfig>,
    options?: IReadOptions,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({
        method: 'readMetadata',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getTransformation(
        this.connection,
        config.transformationName,
        'inactive',
        options,
        this.logger,
      );
      state.metadataResult = response;
      this.logger?.info?.('Transformation metadata read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readMetadata',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('readMetadata', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Read transport request information for the transformation
   */
  async readTransport(
    config: Partial<ITransformationConfig>,
    options?: { withLongPolling?: boolean },
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({
        method: 'readTransport',
        error,
        timestamp: new Date(),
      });
      throw error;
    }
    try {
      const response = await getTransformationTransport(
        this.connection,
        config.transformationName,
        options?.withLongPolling !== undefined
          ? { withLongPolling: options.withLongPolling }
          : undefined,
      );
      state.transportResult = response;
      this.logger?.info?.('Transformation transport request read successfully');
      return state;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      state.errors.push({
        method: 'readTransport',
        error: err,
        timestamp: new Date(),
      });
      this.logger?.error('readTransport', safeErrorMessage(err));
      throw err;
    }
  }

  /**
   * Update transformation with full operation chain
   * If options.lockHandle is provided, performs only low-level update without lock/check/unlock chain
   */
  async update(
    config: Partial<ITransformationConfig>,
    options?: IAdtOperationOptions,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'update', error, timestamp: new Date() });
      throw error;
    }

    // Low-level mode: if lockHandle is provided, perform only update operation
    if (options?.lockHandle) {
      const codeToUpdate = options?.sourceCode || config.sourceCode;
      if (!codeToUpdate) {
        throw new Error('Source code is required for update');
      }

      this.logger?.info?.(
        'Low-level update: performing update only (lockHandle provided)',
      );
      const updateResponse = await updateTransformation(
        this.connection,
        {
          transformation_name: config.transformationName,
          source_code: codeToUpdate,
          transport_request: config.transportRequest,
        },
        options.lockHandle,
      );
      this.logger?.info?.('Transformation updated (low-level)');
      return {
        updateResult: updateResponse,
        errors: [],
      };
    }

    let lockHandle: string | undefined;

    try {
      // 1. Lock (stateful ONLY before lock)
      this.logger?.info?.('Step 1: Locking transformation');
      this.connection.setSessionType('stateful');
      lockHandle = await lockTransformation(
        this.connection,
        config.transformationName,
      );
      this.connection.setSessionType('stateless');
      this.logger?.info?.('Transformation locked, handle:', lockHandle);

      // 2. Check inactive with code for update
      const codeToCheck = options?.sourceCode || config.sourceCode;
      if (codeToCheck) {
        this.logger?.info?.(
          'Step 2: Checking inactive version with update content',
        );
        await checkTransformation(
          this.connection,
          config.transformationName,
          'inactive',
          codeToCheck,
        );
        this.logger?.info?.('Check inactive with update content passed');
      }

      // 3. Update
      if (codeToCheck && lockHandle) {
        this.logger?.info?.('Step 3: Updating transformation');
        await updateTransformation(
          this.connection,
          {
            transformation_name: config.transformationName,
            source_code: codeToCheck,
            transport_request: config.transportRequest,
          },
          lockHandle,
        );
        this.logger?.info?.('Transformation updated');

        // 3.5. Read with long polling (wait for object to be ready after update)
        this.logger?.info?.('read (wait for object ready after update)');
        try {
          await this.read(
            { transformationName: config.transformationName },
            'active',
            { withLongPolling: true },
          );
          this.logger?.info?.('object is ready after update');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            safeErrorMessage(readError),
          );
        }
      }

      // 4. Unlock (obligatory stateless after unlock)
      if (lockHandle) {
        this.logger?.info?.('Step 4: Unlocking transformation');
        this.connection.setSessionType('stateful');
        await unlockTransformation(
          this.connection,
          config.transformationName,
          lockHandle,
        );
        this.connection.setSessionType('stateless');
        lockHandle = undefined;
        this.logger?.info?.('Transformation unlocked');
      }

      // 5. Final check (no stateful needed)
      this.logger?.info?.('Step 5: Final check');
      await checkTransformation(
        this.connection,
        config.transformationName,
        'inactive',
      );
      this.logger?.info?.('Final check passed');

      // 6. Activate (if requested)
      if (options?.activateOnUpdate) {
        this.logger?.info?.('Step 6: Activating transformation');
        const activateResponse = await activateTransformation(
          this.connection,
          config.transformationName,
        );
        this.logger?.info?.(
          'Transformation activated, status:',
          activateResponse.status,
        );

        // 6.5. Read with long polling (wait for object to be ready after activation)
        this.logger?.info?.('read (wait for object ready after activation)');
        try {
          await this.read(
            { transformationName: config.transformationName },
            'active',
            { withLongPolling: true },
          );
          this.logger?.info?.('object is ready after activation');
        } catch (readError) {
          this.logger?.warn?.(
            'read with long polling failed (object may not be ready yet):',
            safeErrorMessage(readError),
          );
        }

        return {
          activateResult: activateResponse,
          errors: [],
        };
      }

      // Read and return result
      const readResponse = await getTransformationSource(
        this.connection,
        config.transformationName,
      );

      return {
        readResult: readResponse,
        errors: [],
      };
    } catch (error: unknown) {
      // Cleanup on error
      if (lockHandle) {
        try {
          this.logger?.warn?.('Unlocking transformation during error cleanup');
          this.connection.setSessionType('stateful');
          await unlockTransformation(
            this.connection,
            config.transformationName,
            lockHandle,
          );
          this.connection.setSessionType('stateless');
        } catch (unlockError) {
          this.logger?.warn?.(
            'Failed to unlock during cleanup:',
            safeErrorMessage(unlockError),
          );
        }
      } else {
        this.connection.setSessionType('stateless');
      }

      if (options?.deleteOnFailure) {
        try {
          this.logger?.warn?.('Deleting transformation after failure');
          await deleteTransformation(this.connection, {
            transformation_name: config.transformationName,
            transport_request: config.transportRequest,
          });
        } catch (deleteError) {
          this.logger?.warn?.(
            'Failed to delete transformation after failure:',
            safeErrorMessage(deleteError),
          );
        }
      }

      this.logger?.error('Update failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Delete transformation
   */
  async delete(
    config: Partial<ITransformationConfig>,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'delete', error, timestamp: new Date() });
      throw error;
    }

    try {
      this.logger?.info?.('Checking transformation for deletion');
      await checkDeletion(this.connection, {
        transformation_name: config.transformationName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Deletion check passed');

      this.logger?.info?.('Deleting transformation');
      const result = await deleteTransformation(this.connection, {
        transformation_name: config.transformationName,
        transport_request: config.transportRequest,
      });
      this.logger?.info?.('Transformation deleted');

      return {
        deleteResult: result,
        errors: [],
      };
    } catch (error: unknown) {
      this.logger?.error('Delete failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Activate transformation
   */
  async activate(
    config: Partial<ITransformationConfig>,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'activate', error, timestamp: new Date() });
      throw error;
    }

    try {
      const result = await activateTransformation(
        this.connection,
        config.transformationName,
      );
      state.activateResult = result;
      return state;
    } catch (error: unknown) {
      this.logger?.error('Activate failed:', safeErrorMessage(error));
      throw error;
    }
  }

  /**
   * Check transformation
   */
  async check(
    config: Partial<ITransformationConfig>,
    status?: string,
  ): Promise<ITransformationState> {
    const state: ITransformationState = { errors: [] };
    if (!config.transformationName) {
      const error = new Error('Transformation name is required');
      state.errors.push({ method: 'check', error, timestamp: new Date() });
      throw error;
    }

    const version: string = status === 'active' ? 'active' : 'inactive';
    state.checkResult = await checkTransformation(
      this.connection,
      config.transformationName,
      version,
    );
    return state;
  }

  /**
   * Lock transformation for modification
   */
  async lock(config: Partial<ITransformationConfig>): Promise<string> {
    if (!config.transformationName) {
      throw new Error('Transformation name is required');
    }

    this.connection.setSessionType('stateful');
    const lockHandle = await lockTransformation(
      this.connection,
      config.transformationName,
    );
    this.connection.setSessionType('stateless');
    return lockHandle;
  }

  /**
   * Unlock transformation
   */
  async unlock(
    config: Partial<ITransformationConfig>,
    lockHandle: string,
  ): Promise<ITransformationState> {
    if (!config.transformationName) {
      throw new Error('Transformation name is required');
    }

    this.connection.setSessionType('stateful');
    const result = await unlockTransformation(
      this.connection,
      config.transformationName,
      lockHandle,
    );
    this.connection.setSessionType('stateless');
    return {
      unlockResult: result,
      errors: [],
    };
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build:fast`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/core/transformation/AdtTransformation.ts
git commit -m "feat(transformation): add high-level AdtTransformation class"
```

---

### Task 5: Create index and register in AdtClient

**Files:**
- Create: `src/core/transformation/index.ts`
- Modify: `src/clients/AdtClient.ts:21-121` (add import), `src/clients/AdtClient.ts:313` (add factory method)
- Modify: `src/index.ts:221` (add exports)

- [ ] **Step 1: Create index.ts**

```typescript
import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type { ITransformationConfig, ITransformationState } from './types';

export { AdtTransformation } from './AdtTransformation';
export * from './types';

export type AdtTransformationType = IAdtObject<
  ITransformationConfig,
  ITransformationState
>;
```

- [ ] **Step 2: Add import in AdtClient.ts**

After line 121 (`import { AdtView, type IViewConfig, type IViewState } from '../core/view';`), add:

```typescript
import {
  AdtTransformation,
  type ITransformationConfig,
  type ITransformationState,
} from '../core/transformation';
```

- [ ] **Step 3: Add factory method in AdtClient.ts**

After the `getAccessControl()` method (after line 313), add:

```typescript
  /**
   * Get high-level operations for Transformation objects (XSLT)
   * Supports both SimpleTransformation and XSLTProgram types
   * @returns IAdtObject instance for Transformation operations
   */
  getTransformation(): IAdtObject<ITransformationConfig, ITransformationState> {
    return new AdtTransformation(
      this.connection,
      this.logger,
      this.systemContext,
    );
  }
```

- [ ] **Step 4: Add exports in src/index.ts**

After line 221 (`export type { AdtViewType, IViewConfig, IViewState } from './core/view';`), add:

```typescript
export type {
  AdtTransformationType,
  ITransformationConfig,
  ITransformationState,
  TransformationType,
} from './core/transformation';
```

- [ ] **Step 5: Verify build**

Run: `npm run build:fast`
Expected: No errors

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No errors or auto-fixed

- [ ] **Step 7: Commit**

```bash
git add src/core/transformation/index.ts src/clients/AdtClient.ts src/index.ts
git commit -m "feat(transformation): register in AdtClient and export public API"
```

---

### Task 6: Add test configuration

**Files:**
- Modify: `src/__tests__/helpers/test-config.yaml.template` (add transformation sections)

- [ ] **Step 1: Add create_transformation section to test-config.yaml.template**

Add after the `create_access_control` section (after line 1026):

```yaml

# Create Transformation
create_transformation:
  test_cases:
    - name: "adt_simple_transformation"
      enabled: true
      available_in: ["onprem", "cloud"]
      description: "Simple Transformation reserved for AdtTransformation tests"
      params:
        transformation_name: "ZAC_ST01"
        transformation_type: "SimpleTransformation"
        description: "AdtTransformation workflow simple transformation"
        # package_name: uses environment.default_package if omitted
        # transport_request: uses environment.default_transport if omitted
        source_code: |
          <?sap.transform simple?>
          <tt:transform xmlns:tt="http://www.sap.com/transformation-templates">
            <tt:root name="ROOT"/>
            <tt:template>
              <root>
                <tt:value ref="ROOT"/>
              </root>
            </tt:template>
          </tt:transform>
    - name: "adt_xslt_program"
      enabled: true
      available_in: ["onprem", "cloud"]
      description: "XSLT Program reserved for AdtTransformation tests"
      params:
        transformation_name: "ZAC_XSLT01"
        transformation_type: "XSLTProgram"
        description: "AdtTransformation workflow XSLT program"
        # package_name: uses environment.default_package if omitted
        # transport_request: uses environment.default_transport if omitted
        source_code: |
          <xsl:transform xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">
            <xsl:template match="/">
              <output>
                <xsl:copy-of select="."/>
              </output>
            </xsl:template>
          </xsl:transform>
```

- [ ] **Step 2: Add read_transformation section**

Add after the create_transformation section:

```yaml

# Read Transformation
read_transformation:
  test_cases:
    - name: "read_standard_transformation"
      enabled: true
      available_in: ["onprem", "cloud"]
      description: "Read standard SAP transformation"
      params:
        # transformation_name: "ZAC_SHR_ST01"
        # transformation_name_cloud: "ZAC_SHR_ST01"
        # transformation_name_onprem: "ZAC_SHR_ST01"
```

- [ ] **Step 3: Also add to test-config.yaml if it exists**

If `src/__tests__/helpers/test-config.yaml` exists, add the same sections there. If not, skip this step (users will copy from template).

- [ ] **Step 4: Commit**

```bash
git add src/__tests__/helpers/test-config.yaml.template
git commit -m "test(transformation): add test configuration template"
```

---

### Task 7: Write integration tests for SimpleTransformation

**Files:**
- Create: `src/__tests__/integration/core/transformation/Transformation.test.ts`

- [ ] **Step 1: Create test file**

```typescript
/**
 * Integration test for Transformation (XSLT)
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Transformation library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=transformation/Transformation
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  ITransformationConfig,
  ITransformationState,
} from '../../../../core/transformation';
import { getTransformation } from '../../../../core/transformation/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import { TestConfigResolver } from '../../../helpers/TestConfigResolver';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';
import {
  logTestEnd,
  logTestError,
  logTestSkip,
  logTestStart,
  logTestSuccess,
} from '../../../helpers/testProgressLogger';

const {
  getEnabledTestCase,
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Transformation - SimpleTransformation (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let isLegacy = false;
  let tester: BaseTester<ITransformationConfig, ITransformationState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient, isLegacy: legacy } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      isLegacy = legacy;
      hasConfig = true;

      tester = new BaseTester(
        client.getTransformation(),
        'Transformation-ST',
        'create_transformation',
        'adt_simple_transformation',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            transformationName: params.transformation_name,
            transformationType: params.transformation_type || 'SimpleTransformation',
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (transformationName: string) => {
          if (!connection) return { success: true };
          try {
            await getTransformation(connection, transformationName);
            return {
              success: false,
              objectExists: true,
              reason: `SAFETY: Transformation ${transformationName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify transformation existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        const sourceCode =
          testCase?.params?.source_code ||
          config.sourceCode ||
          `<?sap.transform simple?>\n<tt:transform xmlns:tt="http://www.sap.com/transformation-templates">\n  <tt:root name="ROOT"/>\n  <tt:template>\n    <root>\n      <tt:value ref="ROOT"/>\n    </root>\n  </tt:template>\n</tt:transform>`;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            transformationName: config.transformationName,
            transformationType: config.transformationType,
            packageName: config.packageName,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });

  describe('Read standard object', () => {
    it(
      'should read standard SAP transformation',
      async () => {
        const {
          getTestCaseDefinition,
        } = require('../../../helpers/test-helper');
        const testCase = getTestCaseDefinition(
          'read_transformation',
          'read_standard_transformation',
        );

        if (!testCase) {
          logTestStart(testsLogger, 'Transformation - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Transformation - read standard object',
            'Test case not defined in test-config.yaml',
          );
          return;
        }

        const enabledTestCase = getEnabledTestCase(
          'read_transformation',
          'read_standard_transformation',
        );
        if (!enabledTestCase) {
          logTestStart(testsLogger, 'Transformation - read standard object', {
            name: 'read_standard',
            params: {},
          });
          logTestSkip(
            testsLogger,
            'Transformation - read standard object',
            'Test case disabled or not found',
          );
          return;
        }

        let transformationName =
          enabledTestCase.params?.transformation_name_cloud && isCloudSystem
            ? enabledTestCase.params.transformation_name_cloud
            : enabledTestCase.params?.transformation_name_onprem &&
                !isCloudSystem
              ? enabledTestCase.params.transformation_name_onprem
              : enabledTestCase.params?.transformation_name;

        if (!transformationName) {
          const resolver = new TestConfigResolver({
            isCloud: isCloudSystem,
            logger: testsLogger,
          });
          const standardObject = resolver.getStandardObject('transformation');
          if (!standardObject) {
            logTestStart(testsLogger, 'Transformation - read standard object', {
              name: 'read_standard',
              params: {},
            });
            logTestSkip(
              testsLogger,
              'Transformation - read standard object',
              `Standard transformation not configured for ${isCloudSystem ? 'cloud' : isLegacy ? 'legacy' : 'on-premise'} environment`,
            );
            return;
          }
          transformationName = standardObject.name;
        }

        logTestStart(testsLogger, 'Transformation - read standard object', {
          name: 'read_standard',
          params: { transformation_name: transformationName },
        });

        if (!hasConfig) {
          logTestSkip(
            testsLogger,
            'Transformation - read standard object',
            'No SAP configuration',
          );
          return;
        }

        try {
          const resultState = await tester.readTest({
            transformationName: transformationName,
          });
          if (!resultState) {
            logTestSkip(
              testsLogger,
              'Transformation - read standard object',
              `Standard transformation ${transformationName} not found in system`,
            );
            return;
          }
          expect(resultState.readResult).toBeDefined();

          logTestSuccess(testsLogger, 'Transformation - read standard object');
        } catch (error: any) {
          logTestError(
            testsLogger,
            'Transformation - read standard object',
            error,
          );
          throw error;
        } finally {
          logTestEnd(testsLogger, 'Transformation - read standard object');
        }
      },
      getTimeout('test'),
    );
  });
});
```

- [ ] **Step 2: Verify test file compiles**

Run: `npm run test:check:integration`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/core/transformation/Transformation.test.ts
git commit -m "test(transformation): add SimpleTransformation integration tests"
```

---

### Task 8: Write integration tests for XSLTProgram

**Files:**
- Create: `src/__tests__/integration/core/transformation/TransformationXslt.test.ts`

- [ ] **Step 1: Create XSLT test file**

```typescript
/**
 * Integration test for Transformation - XSLTProgram type
 * Tests using AdtClient for unified CRUD operations
 *
 * Enable debug logs:
 *  DEBUG_ADT_TESTS=true   - Integration test execution logs
 *  DEBUG_ADT_LIBS=true    - Transformation library logs
 *  DEBUG_CONNECTORS=true  - Connection logs (@mcp-abap-adt/connection)
 *
 * Run: npm test -- --testPathPatterns=transformation/TransformationXslt
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { createAbapConnection } from '@mcp-abap-adt/connection';
import type { IAbapConnection, ILogger } from '@mcp-abap-adt/interfaces';
import * as dotenv from 'dotenv';
import type { AdtClient } from '../../../../clients/AdtClient';
import type {
  ITransformationConfig,
  ITransformationState,
} from '../../../../core/transformation';
import { getTransformation } from '../../../../core/transformation/read';
import { isCloudEnvironment } from '../../../../utils/systemInfo';
import { BaseTester } from '../../../helpers/BaseTester';
import {
  createTestAdtClient,
  getConfig,
  resolveSystemContext,
} from '../../../helpers/sessionConfig';
import {
  createConnectionLogger,
  createLibraryLogger,
  createTestsLogger,
} from '../../../helpers/testLogger';

const {
  resolvePackageName,
  resolveTransportRequest,
  getTimeout,
} = require('../../../helpers/test-helper');

const envPath =
  process.env.MCP_ENV_PATH || path.resolve(__dirname, '../../../../.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, quiet: true });
}

const connectionLogger: ILogger = createConnectionLogger();
const libraryLogger: ILogger = createLibraryLogger();
const testsLogger: ILogger = createTestsLogger();

describe('Transformation - XSLTProgram (using AdtClient)', () => {
  let connection: IAbapConnection;
  let client: AdtClient;
  let hasConfig = false;
  let isCloudSystem = false;
  let tester: BaseTester<ITransformationConfig, ITransformationState>;

  beforeAll(async () => {
    try {
      const config = getConfig();
      connection = createAbapConnection(config, connectionLogger);
      await (connection as any).connect();
      isCloudSystem = await isCloudEnvironment(connection);
      const systemContext = await resolveSystemContext(
        connection,
        isCloudSystem,
      );
      const { client: resolvedClient } =
        await createTestAdtClient(connection, libraryLogger, systemContext);
      client = resolvedClient;
      hasConfig = true;

      tester = new BaseTester(
        client.getTransformation(),
        'Transformation-XSLT',
        'create_transformation',
        'adt_xslt_program',
        testsLogger,
      );

      tester.setup({
        connection,
        client,
        hasConfig,
        isCloudSystem,
        buildConfig: (testCase: any, resolver?: any) => {
          const params = testCase?.params || {};
          const packageName =
            resolver?.getPackageName?.() ||
            resolvePackageName(params.package_name);
          if (!packageName) throw new Error('package_name not configured');
          const transportRequest =
            resolver?.getTransportRequest?.() ||
            resolveTransportRequest(params.transport_request);
          return {
            transformationName: params.transformation_name,
            transformationType: params.transformation_type || 'XSLTProgram',
            packageName,
            transportRequest,
            description: params.description,
            sourceCode: params.source_code,
          };
        },
        ensureObjectReady: async (transformationName: string) => {
          if (!connection) return { success: true };
          try {
            await getTransformation(connection, transformationName);
            return {
              success: false,
              objectExists: true,
              reason: `SAFETY: Transformation ${transformationName} already exists!`,
            };
          } catch (error: any) {
            if (error.response?.status !== 404) {
              return {
                success: false,
                reason: `Cannot verify transformation existence: ${error.message}`,
              };
            }
          }
          return { success: true };
        },
      });
    } catch (_error) {
      hasConfig = false;
    }
  });

  afterAll(() => tester?.afterAll()());

  describe('Full workflow', () => {
    beforeEach(() => tester?.beforeEach()());
    afterEach(() => tester?.afterEach()());

    it(
      'should execute full XSLT workflow and store all results',
      async () => {
        if (!tester) {
          return;
        }
        if (!hasConfig) {
          await tester.flowTestAuto();
          return;
        }
        const config = tester.getConfig();
        if (!config) {
          await tester.flowTestAuto();
          return;
        }

        const testCase = tester.getTestCaseDefinition();
        const sourceCode =
          testCase?.params?.source_code ||
          config.sourceCode ||
          `<xsl:transform xmlns:xsl="http://www.w3.org/1999/XSL/Transform" version="1.0">\n  <xsl:template match="/">\n    <output>\n      <xsl:copy-of select="."/>\n    </output>\n  </xsl:template>\n</xsl:transform>`;

        await tester.flowTestAuto({
          sourceCode: sourceCode,
          updateConfig: {
            transformationName: config.transformationName,
            transformationType: config.transformationType,
            packageName: config.packageName,
            description: config.description || '',
            sourceCode: sourceCode,
          },
        });
      },
      getTimeout('test'),
    );
  });
});
```

- [ ] **Step 2: Verify test file compiles**

Run: `npm run test:check:integration`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/integration/core/transformation/TransformationXslt.test.ts
git commit -m "test(transformation): add XSLTProgram integration tests"
```

---

### Task 9: Full build and lint verification

**Files:** None (verification only)

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Clean build, no errors

- [ ] **Step 2: Run type-check on tests**

Run: `npm run test:check`
Expected: No type errors

- [ ] **Step 3: Run lint**

Run: `npm run lint:check`
Expected: No lint errors

- [ ] **Step 4: Final commit (if lint auto-fixed anything)**

```bash
git add -A
git commit -m "chore(transformation): lint fixes"
```
