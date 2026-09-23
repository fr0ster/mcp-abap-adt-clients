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
export type { IBehaviorImplementationConfig } from '@mcp-abap-adt/interfaces-adt';
export {
  classDocuments,
  type IClassResults,
} from '../class/types';

/**
 * The shapes below describe the argument of the request builders in this
 * module, and they used to be declared in `@mcp-abap-adt/interfaces`. Nobody
 * outside this package ever accepted them — no parameter, field or return
 * anywhere else was typed by one — and being nobody's contract is how 85 of
 * their fields came to be ignored by the very code that took them, for
 * releases, unnoticed. They live here now, beside the function that reads
 * them, which is the only place that can keep them honest. See decision 30 in
 * the interfaces repository.
 */

export interface ICreateBehaviorImplementationParams {
  class_name: string;
  description?: string;
  package_name: string;
  transport_request?: string;
  master_system?: string;
  responsible?: string;
  behavior_definition: string;
}
