/**
 * AdtFunctionIncludeLegacy - function include handler for legacy SAP systems
 * (BASIS < 7.50).
 *
 * No overrides yet.
 */

import { AdtFunctionInclude } from './AdtFunctionInclude';
import type {
  functionIncludeDocuments,
  IFunctionIncludeResults,
} from './types';

export class AdtFunctionIncludeLegacy<
  R extends IFunctionIncludeResults = typeof functionIncludeDocuments,
> extends AdtFunctionInclude<R> {}
