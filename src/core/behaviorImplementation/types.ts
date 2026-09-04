/**
 * BehaviorImplementation module type definitions.
 *
 * There is no result set of its own here. A behavior implementation **is** a
 * class — `BDEF/BDO`'s implementation is an ABAP class carrying a
 * `FOR BEHAVIOR OF` clause — and every request this module makes is a class
 * request: the create, the lock, the check, the activation and the delete are
 * `AdtClass`'s, and the reads are the class's own resources. So it takes
 * `IClassResults`, and a consumer who has already chosen how to read classes
 * has chosen how to read these too.
 */

// Types defined in @mcp-abap-adt/interfaces
export type {
  IBehaviorImplementationConfig,
  ICreateBehaviorImplementationParams,
} from '@mcp-abap-adt/interfaces';
export {
  classDocuments,
  type IClassResults,
} from '../class/types';
