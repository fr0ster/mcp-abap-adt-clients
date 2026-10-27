import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_ENHANCEMENT_ELEMENTS,
  ACCEPT_ENHANCEMENT_OPTIONS,
} from '../../constants/contentTypes';
import { PROGRAM, PROGRAM_INCLUDE } from '../../endpoints/objects';

function contextQuery(context?: string): string {
  return context ? `?context=${encodeURIComponent(PROGRAM.uri(context))}` : '';
}

export async function getIncludeEnhancementElements(
  connection: IAbapConnection,
  name: string,
  context?: string,
): Promise<IAdtWireResponse> {
  const url = PROGRAM_INCLUDE.enhancementElements(name) + contextQuery(context);
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_ELEMENTS },
  });
}

export async function getIncludeEnhancementOptions(
  connection: IAbapConnection,
  name: string,
  context?: string,
): Promise<IAdtWireResponse> {
  const url = PROGRAM_INCLUDE.enhancementOptions(name) + contextQuery(context);
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_OPTIONS },
  });
}
