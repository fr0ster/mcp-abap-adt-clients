/**
 * Metadata Extension (DDLX) operations - exports
 */

import type { IAdtObject } from '@mcp-abap-adt/interfaces';
import type {
  IMetadataExtensionConfig,
  IMetadataExtensionState,
} from './types';

export { AdtMetadataExtension } from './AdtMetadataExtension';
export { MetadataExtensionBuilder } from './MetadataExtensionBuilder';
export * from './types';

// Type alias for AdtMetadataExtension
export type AdtMetadataExtensionType = IAdtObject<
  IMetadataExtensionConfig,
  IMetadataExtensionState
>;
