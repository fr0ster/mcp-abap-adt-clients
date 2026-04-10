export interface IGatewayErrorEntry {
  type: string;
  shortText: string;
  transactionId: string;
  package: string;
  applicationComponent: string;
  dateTime: string;
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
