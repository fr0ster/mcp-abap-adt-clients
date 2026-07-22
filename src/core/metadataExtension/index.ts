/**
 * Metadata Extension (DDLX) operations - exports
 */

import type { IAdtSourceObject } from '@mcp-abap-adt/interfaces';
import type {
  IMetadataExtensionConfig,
  IMetadataExtensionState,
} from './types';

export { AdtMetadataExtension } from './AdtMetadataExtension';
export * from './types';

// Type alias for AdtMetadataExtension
export type AdtMetadataExtensionType = IAdtSourceObject<
  IMetadataExtensionConfig,
  IMetadataExtensionState
>;
