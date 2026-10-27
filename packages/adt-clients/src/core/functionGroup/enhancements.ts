import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import {
  ACCEPT_ENHANCEMENT_ELEMENTS,
  ACCEPT_ENHANCEMENT_OPTIONS,
} from '../../constants/contentTypes';
import { FUNCTION_GROUP } from '../../endpoints/objects';

export async function getFunctionGroupEnhancementElements(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = FUNCTION_GROUP.enhancementElements(name);
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_ELEMENTS },
  });
}

export async function getFunctionGroupEnhancementOptions(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  const url = FUNCTION_GROUP.enhancementOptions(name);
  return connection.makeAdtRequest({
    url,
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_ENHANCEMENT_OPTIONS },
  });
}
