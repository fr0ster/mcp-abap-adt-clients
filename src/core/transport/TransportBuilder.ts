/**
 * TransportBuilder - Fluent API for transport operations with Promise chaining
 *
 * Supports:
 * - Method chaining: builder.setDescription().then(b => b.create())...
 * - Error handling: .catch() for error callbacks
 * - Cleanup: .finally() for guaranteed execution
 * - Result storage: all results stored in logger/state
 * - Chain interruption: chain stops on first error (standard Promise behavior)
 *
 * @example
 * ```typescript
 * const builder = new TransportBuilder(connection, logger, {
 *   description: 'Test transport request'
 * });
 *
 * await builder
 *   .setType('workbench')
 *   .setOwner('USERNAME')
 *   .create()
 *   .catch(error => {
 *     logger.error('Operation failed:', error);
 *   });
 * ```
 */

import { AbapConnection } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';
import { createTransport } from './create';
import { getTransport } from './read';
import { CreateTransportParams } from './types';

export interface TransportBuilderLogger {
  debug?: (message: string, ...args: any[]) => void;
  info?: (message: string, ...args: any[]) => void;
  warn?: (message: string, ...args: any[]) => void;
  error?: (message: string, ...args: any[]) => void;
}

export interface TransportBuilderConfig {
  description: string;
  transportType?: 'workbench' | 'customizing';
  targetSystem?: string;
  owner?: string;
}

export interface TransportBuilderState {
  createResult?: AxiosResponse;
  readResult?: AxiosResponse;
  transportNumber?: string;
  taskNumber?: string;
  errors: Array<{ method: string; error: Error; timestamp: Date }>;
}

export class TransportBuilder {
  private connection: AbapConnection;
  private logger: TransportBuilderLogger;
  private config: TransportBuilderConfig;
  private state: TransportBuilderState;

  constructor(
    connection: AbapConnection,
    logger: TransportBuilderLogger,
    config: TransportBuilderConfig
  ) {
    this.connection = connection;
    this.logger = logger;
    this.config = { ...config };
    this.state = {
      errors: []
    };
  }

  // Builder methods - return this for chaining
  setDescription(description: string): this {
    this.config.description = description;
    this.logger.debug?.('Description set:', description);
    return this;
  }

  setType(transportType: 'workbench' | 'customizing'): this {
    this.config.transportType = transportType;
    this.logger.debug?.('Transport type set:', transportType);
    return this;
  }

  setTargetSystem(targetSystem: string): this {
    this.config.targetSystem = targetSystem;
    this.logger.debug?.('Target system set:', targetSystem);
    return this;
  }

  setOwner(owner: string): this {
    this.config.owner = owner;
    this.logger.debug?.('Owner set:', owner);
    return this;
  }

  // Operation methods - return Promise<this> for Promise chaining
  async create(): Promise<this> {
    try {
      this.logger.info?.('Creating transport request:', this.config.description);
      const params: CreateTransportParams = {
        description: this.config.description,
        transport_type: this.config.transportType || 'workbench',
        target_system: this.config.targetSystem,
        owner: this.config.owner
      };
      const result = await createTransport(this.connection, params);
      this.state.createResult = result;

      // Extract transport number from response if available
      if (result.data && typeof result.data === 'object') {
        this.state.transportNumber = result.data.transport_number;
        this.state.taskNumber = result.data.task_number;
      }

      this.logger.info?.('Transport request created successfully:', result.status);
      if (this.state.transportNumber) {
        this.logger.info?.('Transport number:', this.state.transportNumber);
      }
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'create',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Create failed:', error);
      throw error;
    }
  }

  async read(transportNumber: string): Promise<this> {
    try {
      this.logger.info?.('Reading transport request:', transportNumber);
      const result = await getTransport(this.connection, transportNumber);
      this.state.readResult = result;
      this.logger.info?.('Transport request read successfully:', result.status);
      return this;
    } catch (error: any) {
      this.state.errors.push({
        method: 'read',
        error: error instanceof Error ? error : new Error(String(error)),
        timestamp: new Date()
      });
      this.logger.error?.('Read failed:', error);
      throw error;
    }
  }

  // Getters for accessing results
  getState(): Readonly<TransportBuilderState> {
    return { ...this.state };
  }

  getTransportNumber(): string | undefined {
    return this.state.transportNumber;
  }

  getTaskNumber(): string | undefined {
    return this.state.taskNumber;
  }

  getCreateResult(): AxiosResponse | undefined {
    return this.state.createResult;
  }

  getReadResult(): AxiosResponse | undefined {
    return this.state.readResult;
  }

  getErrors(): ReadonlyArray<{ method: string; error: Error; timestamp: Date }> {
    return [...this.state.errors];
  }

  getResults(): {
    create?: AxiosResponse;
    read?: AxiosResponse;
    transportNumber?: string;
    taskNumber?: string;
    errors: Array<{ method: string; error: Error; timestamp: Date }>;
  } {
    return {
      create: this.state.createResult,
      read: this.state.readResult,
      transportNumber: this.state.transportNumber,
      taskNumber: this.state.taskNumber,
      errors: [...this.state.errors]
    };
  }
}

