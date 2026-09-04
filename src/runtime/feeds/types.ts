/**
 * Feeds Domain Data Types.
 *
 * These shapes left `@mcp-abap-adt/interfaces` in 31.0.0 with the other result
 * shapes: `IFeedRepository<TFeeds, TVariants, TEntries, TSystemMessages,
 * TGatewayErrors, TGatewayErrorDetail>` says each member answers *something*,
 * and what that something looks like is this implementation's to name.
 *
 * They are measured shapes, not designed ones — read off the Atom feeds
 * `/sap/bc/adt/feeds` answers.
 */

/**
 * ABAP timestamp string in format YYYYMMDDHHMMSS.
 * Represents an ABAP timestamp in feed query/results payloads.
 * Omitted query values are excluded from serialization.
 */
export type IAbapTimestamp = string;

// Types defined in @mcp-abap-adt/interfaces
export type {
  IFeedQueryOptions,
  IFeedRepository,
} from '@mcp-abap-adt/interfaces';

export interface IFeedEntry {
  id: string;
  title: string;
  updated: IAbapTimestamp;
  link: string;
  content: string;
  author?: string;
  category?: string;
}

export interface IFeedDescriptor {
  id: string;
  title: string;
  url: string;
  category?: string;
}

export interface IFeedVariant {
  id: string;
  title: string;
  url: string;
}

// --- System message types ---

export interface ISystemMessageEntry {
  id: string;
  title: string;
  text: string;
  severity: string;
  validFrom: IAbapTimestamp;
  validTo: IAbapTimestamp;
  createdBy: string;
}

// --- Gateway error types ---

export interface IGatewayErrorEntry {
  type: string;
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: IAbapTimestamp;
  username: string;
  client: string;
  requestKind: string;
}

export interface IGatewayErrorDetail extends IGatewayErrorEntry {
  serviceInfo: {
    namespace: string;
    serviceName: string;
    serviceVersion: string;
    groupId: string;
    serviceRepository: string;
    destination: string;
  };
  errorContext: {
    errorInfo: string;
    resolution: Record<string, string>;
    exceptions: IGatewayException[];
  };
  sourceCode: {
    lines: ISourceCodeLine[];
    errorLine: number;
  };
  callStack: ICallStackEntry[];
}

export interface IGatewayException {
  type: string;
  text: string;
  raiseLocation: string;
  attributes?: Record<string, string>;
}

export interface ICallStackEntry {
  number: number;
  event: string;
  program: string;
  name: string;
  line: number;
}

export interface ISourceCodeLine {
  number: number;
  content: string;
  isError: boolean;
}
