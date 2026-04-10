import type { IAdtResponse } from '@mcp-abap-adt/interfaces';

export interface IFeedQueryOptions {
  user?: string;
  maxResults?: number;
  from?: string; // YYYYMMDDHHMMSS
  to?: string; // YYYYMMDDHHMMSS
}

export interface IFeedEntry {
  id: string;
  title: string;
  updated: string;
  link: string;
  content: string;
  author?: string;
  category?: string;
}

export interface IFeedRepository {
  list(): Promise<IAdtResponse>;
  variants(): Promise<IAdtResponse>;
  dumps(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  systemMessages(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  gatewayErrors(options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
  byUrl(feedUrl: string, options?: IFeedQueryOptions): Promise<IFeedEntry[]>;
}
