/**
 * Type group name validation: one `POST` to the validation collection.
 *
 * `objtype` is `TYPE/DG` exactly: `typedg`, `type` and `TYPEDG` are refused
 * `400` (measured on S/4HANA 2025 and ABAP Cloud). A valid name answers an
 * empty `200`; a taken or too long one `400 InvalidTypeGroupName`.
 */
import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_VALIDATION } from '../../constants/contentTypes';
import { TYPE_CODE } from '../../constants/typeCodes';
import { TYPE_GROUP } from '../../endpoints/objects';

export async function validateTypeGroupName(
  connection: IAbapConnection,
  typeGroupName: string,
  packageName?: string,
  description?: string,
): Promise<IAdtWireResponse> {
  const query = new URLSearchParams({
    objtype: TYPE_CODE.typeGroup,
    objname: typeGroupName,
  });
  if (packageName) query.append('packagename', packageName);
  if (description) query.append('description', description);
  return connection.makeAdtRequest({
    url: `${TYPE_GROUP.validation}?${query.toString()}`,
    method: 'POST',
    timeout: 0,
    headers: { Accept: ACCEPT_VALIDATION },
  });
}
