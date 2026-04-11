import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  IApplicationLog,
  IGetApplicationLogObjectOptions,
  IGetApplicationLogSourceOptions,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import {
  getApplicationLogObject,
  getApplicationLogSource,
  validateApplicationLogName,
} from './read';

export class ApplicationLog implements IApplicationLog {
  readonly kind = 'applicationLog' as const;

  constructor(
    private readonly connection: IAbapConnection,
    private readonly logger: ILogger,
  ) {}

  async getObject(
    objectName: string,
    options?: IGetApplicationLogObjectOptions,
  ): Promise<AxiosResponse> {
    return getApplicationLogObject(this.connection, objectName, options);
  }

  async getSource(
    objectName: string,
    options?: IGetApplicationLogSourceOptions,
  ): Promise<AxiosResponse> {
    return getApplicationLogSource(this.connection, objectName, options);
  }

  async validateName(objectName: string): Promise<AxiosResponse> {
    return validateApplicationLogName(this.connection, objectName);
  }
}
