/**
 * The three factories that answered their concrete class until #109 —
 * `getUtils`, `getFeatureToggle` and `getServiceBinding` — answer a composition of contracts now. That is only
 * honest while the composition holds every public member of the class: a
 * member outside it would be on the object and unreachable through the type,
 * the very gap the concrete return was kept for.
 *
 * So this fails compiling when a class gains a member its composition lacks,
 * naming the member. Never imported at runtime; `npm run test:check` is the
 * test.
 */

import type {
  IFeatureToggleContract,
  IServiceBindingContract,
  IUtilsContract,
} from '../../../clients/AdtClient';
import type { AdtFeatureToggle } from '../../../core/featureToggle';
import type { featureToggleDocuments } from '../../../core/featureToggle/types';
import type { AdtServiceBinding } from '../../../core/service/AdtService';
import type { serviceDocuments } from '../../../core/service/types';
import type { AdtUtils } from '../../../core/shared/AdtUtils';
import type { utilDocuments } from '../../../core/shared/utilResultSet';

type Assert<T extends true> = T;

/**
 * The public methods of `C` that `T` does not declare; `never` when none.
 * Methods, not every key: a data member like `objectType` is the handler's
 * label, not something a caller invokes, and no factory's contract carries it.
 */
type Methods<C> = {
  [K in keyof C]: C[K] extends (...args: never[]) => unknown ? K : never;
}[keyof C];
type Uncovered<C, T> = Exclude<Methods<C>, keyof T>;

export type _UtilsCovered = Assert<
  [Uncovered<AdtUtils, IUtilsContract<typeof utilDocuments>>] extends [never]
    ? true
    : false
>;

export type _FeatureToggleCovered = Assert<
  [
    Uncovered<
      AdtFeatureToggle,
      IFeatureToggleContract<typeof featureToggleDocuments>
    >,
  ] extends [never]
    ? true
    : false
>;

export type _ServiceBindingCovered = Assert<
  [
    Uncovered<
      AdtServiceBinding,
      IServiceBindingContract<typeof serviceDocuments>
    >,
  ] extends [never]
    ? true
    : false
>;
