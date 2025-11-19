import { AbapConnection } from '@mcp-abap-adt/connection';
import { validateObjectName, ValidationResult } from '../core/shared/validation';

export class ValidationClient {
  constructor(private connection: AbapConnection) {}

  async validateObject(
    objectType: string,
    objectName: string,
    additionalParams?: Record<string, string>
  ): Promise<ValidationResult> {
    return validateObjectName(this.connection, objectType, objectName, additionalParams);
  }
}

