import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_ENHANCEMENT_ELEMENTS,
  ACCEPT_ENHANCEMENT_OPTIONS,
} from '../../constants/contentTypes';
import { PROGRAM } from '../../endpoints/objects';
import { makeAdtRequestWithAcceptNegotiation } from '../../utils/acceptNegotiation';

export async function getProgramEnhancementElements(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = PROGRAM.enhancementElements(name);
  return makeAdtRequestWithAcceptNegotiation(connection, {
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_ELEMENTS },
  });
}

export async function getProgramEnhancementOptions(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = PROGRAM.enhancementOptions(name);
  return makeAdtRequestWithAcceptNegotiation(connection, {
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_OPTIONS },
  });
}
