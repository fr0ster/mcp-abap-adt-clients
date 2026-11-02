import type {
  IAbapConnection,
  IAdtWireResponse,
} from '@mcp-abap-adt/interfaces-adt-connection';
import { ACCEPT_INCLUDE_MAIN_PROGRAMS } from '../../constants/contentTypes';
import { PROGRAM_INCLUDE } from '../../endpoints/objects';

/**
 * The programs that include `name`: `GET …/programs/includes/{name}/mainprograms`.
 *
 * Measured on premise (2026-11-02): `200` with
 * `application/vnd.sap.adt.programs.includes.mainprograms+xml`, an
 * `adtcore:objectReferences` holding one `adtcore:objectReference` (uri, type,
 * name) per main program — a program (`PROG/P`), or for a function group's
 * include its group (`FUGR/F`: `LSVIMTOP` answers `SVIM`) — empty for an
 * include no program includes directly; `404` for a name that is no include.
 * Not listed by discovery as a template of its own.
 */
export async function getIncludeMainPrograms(
  connection: IAbapConnection,
  name: string,
): Promise<IAdtWireResponse> {
  return connection.makeAdtRequest({
    url: PROGRAM_INCLUDE.mainPrograms(name),
    method: 'GET',
    timeout: 0,
    headers: { Accept: ACCEPT_INCLUDE_MAIN_PROGRAMS },
  });
}
