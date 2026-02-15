/**
 * Test configuration helper
 * Provides SAP configuration from environment variables
 */

import type { SapConfig } from '@mcp-abap-adt/connection';

/**
 * Get SAP configuration from environment variables
 * Used in tests to create connections
 */
export function getConfig(): SapConfig {
  const rawUrl = process.env.SAP_URL;
  const url = rawUrl ? rawUrl.split('#')[0].trim() : rawUrl;
  const rawClient = process.env.SAP_CLIENT;
  const client = rawClient ? rawClient.split('#')[0].trim() : rawClient;
  const rawAuthType = process.env.SAP_AUTH_TYPE;
  const authType = rawAuthType
    ? rawAuthType.split('#')[0].trim().toLowerCase()
    : '';

  if (!url || !/^https?:\/\//.test(url)) {
    throw new Error(`Missing or invalid SAP_URL: ${url}`);
  }

  // Keep tests compatible with both modes:
  // - explicit SAP_AUTH_TYPE (basic|jwt|xsuaa)
  // - implicit JWT mode when token is provided without SAP_AUTH_TYPE
  const hasJwtToken = Boolean(process.env.SAP_JWT_TOKEN);
  const effectiveAuthType: 'basic' | 'jwt' =
    authType === 'jwt' || authType === 'xsuaa'
      ? 'jwt'
      : authType === 'basic'
        ? 'basic'
        : hasJwtToken
          ? 'jwt'
          : 'basic';

  const config: SapConfig = {
    url,
    authType: effectiveAuthType,
  };

  if (client) {
    config.client = client;
  }

  if (effectiveAuthType === 'jwt') {
    const jwtToken = process.env.SAP_JWT_TOKEN;
    if (!jwtToken) {
      throw new Error('Missing SAP_JWT_TOKEN for JWT authentication');
    }
    config.jwtToken = jwtToken;

    const refreshToken = process.env.SAP_REFRESH_TOKEN;
    if (refreshToken) {
      config.refreshToken = refreshToken;
    }

    const uaaUrl = process.env.SAP_UAA_URL || process.env.UAA_URL;
    const uaaClientId =
      process.env.SAP_UAA_CLIENT_ID || process.env.UAA_CLIENT_ID;
    const uaaClientSecret =
      process.env.SAP_UAA_CLIENT_SECRET || process.env.UAA_CLIENT_SECRET;

    if (uaaUrl) config.uaaUrl = uaaUrl;
    if (uaaClientId) config.uaaClientId = uaaClientId;
    if (uaaClientSecret) config.uaaClientSecret = uaaClientSecret;
  } else {
    const username = process.env.SAP_USERNAME;
    const password = process.env.SAP_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'Missing SAP_USERNAME or SAP_PASSWORD for basic authentication',
      );
    }
    config.username = username;
    config.password = password;
  }

  return config;
}
