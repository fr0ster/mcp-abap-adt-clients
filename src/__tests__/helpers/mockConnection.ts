/**
 * Mock AbapConnection for unit tests
 */

import { AbapConnection, SapConfig, AbapRequestOptions } from '@mcp-abap-adt/connection';
import { AxiosResponse } from 'axios';

export interface MockConnection extends AbapConnection {
  // Add mock-specific methods
  mockResponse: (response: Partial<AxiosResponse>) => void;
  mockError: (error: Error) => void;
  getLastRequest: () => AbapRequestOptions | undefined;
  getAllRequests: () => AbapRequestOptions[];
  reset: () => void;
}

/**
 * Create a mock AbapConnection for testing
 */
export function createMockConnection(config?: Partial<SapConfig>): MockConnection {
  const requests: AbapRequestOptions[] = [];
  let mockResponseData: Partial<AxiosResponse> | null = null;
  let mockErrorData: Error | null = null;

  const defaultConfig: SapConfig = {
    url: 'https://mock.example.com',
    authType: 'basic',
    username: 'TEST_USER',
    password: 'test_password',
    ...config,
  };

  const mockConnection: MockConnection = {
    getConfig: jest.fn(() => defaultConfig),

    getBaseUrl: jest.fn(async () => defaultConfig.url),

    getAuthHeaders: jest.fn(async () => ({
      Authorization: 'Basic VEVTVF9VU0VSOg==',
    })),

    makeAdtRequest: jest.fn(async (options: AbapRequestOptions) => {
      requests.push(options);

      if (mockErrorData) {
        throw mockErrorData;
      }

      const response: AxiosResponse = {
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {} as any,
        data: '',
        ...mockResponseData,
      };

      return response;
    }),

    reset: jest.fn(() => {
      requests.length = 0;
      mockResponseData = null;
      mockErrorData = null;
    }),

    // Mock-specific methods
    mockResponse: (response: Partial<AxiosResponse>) => {
      mockResponseData = response;
      mockErrorData = null;
    },

    mockError: (error: Error) => {
      mockErrorData = error;
      mockResponseData = null;
    },

    getLastRequest: () => {
      return requests[requests.length - 1];
    },

    getAllRequests: () => {
      return [...requests];
    },
  };

  return mockConnection;
}

/**
 * Helper to create mock AxiosError
 */
export function createMockAxiosError(
  status: number,
  message: string,
  data?: any
): Error {
  const error = new Error(message) as any;
  error.response = {
    status,
    statusText: message,
    data,
    headers: {},
    config: {},
  };
  error.isAxiosError = true;
  return error;
}

/**
 * Helper assertions for mock connection
 */
export const mockAssertions = {
  /**
   * Assert that request was made to specific URL
   */
  toHaveRequestedUrl: (connection: MockConnection, expectedUrl: string | RegExp) => {
    const lastRequest = connection.getLastRequest();
    if (!lastRequest) {
      throw new Error('No requests were made');
    }

    const actualUrl = lastRequest.url;
    if (typeof expectedUrl === 'string') {
      expect(actualUrl).toContain(expectedUrl);
    } else {
      expect(actualUrl).toMatch(expectedUrl);
    }
  },

  /**
   * Assert that request was made with specific method
   */
  toHaveRequestedWithMethod: (connection: MockConnection, method: string) => {
    const lastRequest = connection.getLastRequest();
    expect(lastRequest?.method?.toUpperCase()).toBe(method.toUpperCase());
  },

  /**
   * Assert that request included specific header
   */
  toHaveRequestedWithHeader: (
    connection: MockConnection,
    headerName: string,
    headerValue?: string | RegExp
  ) => {
    const lastRequest = connection.getLastRequest();
    const headers = lastRequest?.headers || {};
    const actualValue = headers[headerName];

    expect(actualValue).toBeDefined();

    if (headerValue) {
      if (typeof headerValue === 'string') {
        expect(actualValue).toBe(headerValue);
      } else {
        expect(actualValue).toMatch(headerValue);
      }
    }
  },

  /**
   * Assert that request included data/body
   */
  toHaveRequestedWithData: (connection: MockConnection, expected: any) => {
    const lastRequest = connection.getLastRequest();
    expect(lastRequest?.data).toEqual(expected);
  },
};
