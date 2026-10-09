/**
 * Debugger and memory-snapshot contracts, kept on this research branch.
 *
 * @mcp-abap-adt/interfaces 30.0.0 (#64) withdrew them as not ready to
 * publish: 39 of IDebugger's 42 members answered IAdtWireResponse, i.e. no
 * one had yet measured what their endpoints return. They return to the
 * contract package once measured. Copied from interfaces at fda23b67 (the parent of ec99f09).
 */
export * from './IDebugger';
export * from './IMemorySnapshots';
export * from './types';
