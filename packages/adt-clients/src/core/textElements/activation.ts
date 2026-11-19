/**
 * The references that activate an object together with its text elements.
 *
 * A text elements write lands inactive, and an activation naming only the
 * object runs nothing for it; one activation naming both the object and
 * `/sap/bc/adt/textelements/{kind}/{name}` activates both (measured on
 * premise for a program and a function group, on the cloud for a class,
 * 2026-11-19). A function group's text elements are `PROG/PX` under their own
 * URI, which the reference carries (the URI decides; the name may be the
 * group's).
 *
 * Pass them to the utilities' `activateObjects` (or `activateObjectsGroup`)
 * of the variant: a program on premise only (ABAP cloud activates no
 * program), a class and a function group on both.
 */
import type { IAdtGroupActivationReference } from '@mcp-abap-adt/interfaces-adt';
import {
  CLASS,
  FUNCTION_GROUP,
  PROGRAM,
  TEXT_ELEMENTS,
} from '../../endpoints/objects';

/** The object, by kind and name. */
interface ITextElementsOwner<K extends 'program' | 'class' | 'functionGroup'> {
  readonly objectKind: K;
  readonly objectName: string;
}

export function textElementsActivationReferences(
  object: ITextElementsOwner<'program'>,
): IAdtGroupActivationReference<'onprem'>[];
export function textElementsActivationReferences(
  object: ITextElementsOwner<'class' | 'functionGroup'>,
): IAdtGroupActivationReference[];
export function textElementsActivationReferences(
  object: ITextElementsOwner<'program' | 'class' | 'functionGroup'>,
): IAdtGroupActivationReference<'onprem'>[] {
  const name = object.objectName;
  const texts = TEXT_ELEMENTS.uri(object.objectKind, name);
  switch (object.objectKind) {
    case 'program':
      return [
        { name, type: 'PROG/P', uri: PROGRAM.uri(name) },
        { name, type: 'PROG/PX', uri: texts },
      ];
    case 'class':
      return [
        { name, type: 'CLAS/OC', uri: CLASS.uri(name) },
        { name, type: 'CLAS/OCX', uri: texts },
      ];
    case 'functionGroup':
      return [
        { name, type: 'FUGR/F', uri: FUNCTION_GROUP.uri(name) },
        { name, type: 'PROG/PX', uri: texts },
      ];
  }
}
