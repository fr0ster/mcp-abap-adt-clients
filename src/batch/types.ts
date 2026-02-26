export interface IBatchRequestPart {
  method: string;
  url: string;
  headers: Record<string, string>;
  data?: string;
  params?: Record<string, string>;
}

export interface IBatchPayload {
  boundary: string;
  body: string;
}

export interface IBatchResponsePart {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: string;
}
