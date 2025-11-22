import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { makeAdtRequestWithSession } from '../../utils/sessionUtils';
import { BehaviorDefinitionValidationParams } from './types';

/**
 * Validate behavior definition parameters before creation
 * 
 * Endpoint: POST /sap/bc/adt/bo/behaviordefinitions/validation
 * 
 * @param connection - ABAP connection instance
 * @param params - Validation parameters
 * @param sessionId - Session ID for request tracking
 * @returns Axios response with validation result
 * 
 * @example
 * ```typescript
 * const result = await validate(connection, {
 *   objname: 'Z_MY_BDEF',
 *   rootEntity: 'Z_MY_ENTITY',
 *   description: 'Test Behavior Definition',
 *   package: 'Z_PACKAGE',
 *   implementationType: 'Managed'
 * }, sessionId);
 * 
 * // Check validation result
 * const severity = result.data.match(/<SEVERITY>([^<]+)<\/SEVERITY>/)?.[1];
 * if (severity === 'OK') {
 *   console.log('Validation successful');
 * }
 * ```
 */
export async function validate(
    connection: AbapConnection,
    params: BehaviorDefinitionValidationParams,
    sessionId: string
): Promise<AxiosResponse> {
    try {
        const queryParams = new URLSearchParams({
            objname: params.objname,
            rootEntity: params.rootEntity,
            description: params.description,
            package: params.package,
            implementationType: params.implementationType
        });

        const url = `/sap/bc/adt/bo/behaviordefinitions/validation?${queryParams.toString()}`;

        const response = await makeAdtRequestWithSession(
            connection,
            sessionId,
            'POST',
            url,
            undefined,
            {
                'Accept': 'application/vnd.sap.as+xml'
            }
        );

        return response;
    } catch (error: any) {
        throw new Error(
            `Failed to validate behavior definition ${params.objname}: ${error.message}`
        );
    }
}
