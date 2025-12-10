/**
 * Metadata Extension (DDLX) operations - exports
 */

import { IAdtObject } from '@mcp-abap-adt/interfaces';
import { IMetadataExtensionConfig, IMetadataExtensionState } from './types';

export * from './types';
export { MetadataExtensionBuilder } from './MetadataExtensionBuilder';
export { AdtMetadataExtension } from './AdtMetadataExtension';

// Type alias for AdtMetadataExtension
export type AdtMetadataExtensionType = IAdtObject<IMetadataExtensionConfig, IMetadataExtensionState>;
