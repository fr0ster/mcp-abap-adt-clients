/**
 * Metadata Extension (DDLX) operations
 * 
 * Low-level functions for working with SAP metadata extensions
 */

export * from './types';
export { validateMetadataExtension } from './validation';
export { createMetadataExtension } from './create';

export { lockMetadataExtension } from './lock';
export { unlockMetadataExtension } from './unlock';

export { readMetadataExtension, readMetadataExtensionSource } from './read';

export { updateMetadataExtension } from './update';

export { checkMetadataExtension } from './check';

export { activateMetadataExtension } from './activate';

export { deleteMetadataExtension } from './delete';

export { MetadataExtensionBuilder } from './MetadataExtensionBuilder';
