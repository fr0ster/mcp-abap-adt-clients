import type {
  IAdtResponse as AxiosResponse,
  IAbapConnection,
  ILogger,
} from '@mcp-abap-adt/interfaces';
import type { IRuntimeAnalysisObject } from '../types';
import {
  getApplicationLogObject,
  getApplicationLogSource,
  type IGetApplicationLogObjectOptions,
  type IGetApplicationLogSourceOptions,
  validateApplicationLogName,
} from './read';

export class ApplicationLog implements IRuntimeAnalysisObject {
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
