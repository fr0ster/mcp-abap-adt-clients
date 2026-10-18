import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_ENHANCEMENT_ELEMENTS,
  ACCEPT_ENHANCEMENT_OPTIONS,
} from '../../constants/contentTypes';
import { CLASS } from '../../endpoints/objects';

export async function getClassEnhancementElements(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = CLASS.enhancementElements(name);
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_ELEMENTS },
  });
}

export async function getClassEnhancementOptions(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = CLASS.enhancementOptions(name);
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_OPTIONS },
  });
}
