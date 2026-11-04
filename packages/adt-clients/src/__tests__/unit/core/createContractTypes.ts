/**
 * Contracts the compiler checks; `test:check` builds this file, so a
 * regression fails it.
 *
 * - The function-module validation requires a description: the endpoint
 *   answers 400 without one (measured).
 * - A class create takes no `abstract` and a program create no
 *   `programType`: SAP ignores both on create (measured on premise).
 */

import type { AdtClass } from '../../../core/class/AdtClass';
import type { AdtFunctionModule } from '../../../core/functionModule/AdtFunctionModule';
import type { AdtProgram } from '../../../core/program/AdtProgram';

type Assert<T extends true> = T;

type ValidateConfig = Parameters<AdtFunctionModule['validate']>[0];

/** Without a description: refused by the type. */
export type _DescriptionRequired = Assert<
  {
    functionGroupName: string;
    functionModuleName: string;
  } extends ValidateConfig
    ? false
    : true
>;

/** With one: accepted. */
export type _WithDescriptionAccepted = Assert<
  {
    functionGroupName: string;
    functionModuleName: string;
    description: string;
  } extends ValidateConfig
    ? true
    : false
>;

type ClassCreateConfig = Parameters<AdtClass['create']>[0];
type ProgramCreateConfig = Parameters<AdtProgram['create']>[0];

/** A class create with `abstract`: refused by the type. */
export type _ClassCreateTakesNoAbstract = Assert<
  {
    className: string;
    packageName: string;
    abstract: boolean;
  } extends ClassCreateConfig
    ? false
    : true
>;

/** A program create with a program type: refused by the type. */
export type _ProgramCreateTakesNoType = Assert<
  {
    programName: string;
    packageName: string;
    programType: string;
  } extends ProgramCreateConfig
    ? false
    : true
>;

/** Both still take a plain config. */
export type _PlainCreatesAccepted = Assert<
  [
    { className: string; packageName: string } extends ClassCreateConfig
      ? true
      : false,
    { programName: string; packageName: string } extends ProgramCreateConfig
      ? true
      : false,
  ] extends [true, true]
    ? true
    : false
>;
