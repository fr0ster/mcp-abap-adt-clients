import type {
  IAbapConnection,
  IAdtResponse,
  IApplicationLog,
  IGetApplicationLogObjectOptions,
  IGetApplicationLogSourceOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import { answering } from '../../utils/adtResponse';
import { rawDocument } from '../../utils/resultStrategy';
import {
  getApplicationLogObject,
  getApplicationLogSource,
  validateApplicationLogName,
} from './read';

export class ApplicationLog implements IApplicationLog<string, string, string> {
  readonly kind = 'applicationLog' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getObject(
    objectName: string,
    options?: IGetApplicationLogObjectOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getApplicationLogObject(this.connection, objectName, options),
      rawDocument,
    );
  }

  async getSource(
    objectName: string,
    options?: IGetApplicationLogSourceOptions,
  ): Promise<IAdtResponse<string>> {
    return answering(
      () => getApplicationLogSource(this.connection, objectName, options),
      rawDocument,
    );
  }

  async validateName(objectName: string): Promise<IAdtResponse<string>> {
    return answering(
      () => validateApplicationLogName(this.connection, objectName),
      rawDocument,
    );
  }
}
