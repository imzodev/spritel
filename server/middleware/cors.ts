/**
 * CORS middleware for Bun server
 */
export function cors(headers: Headers): Record<string, string> {
  const origin = headers.get('origin') ?? '*';
  const allowOrigin = origin !== null && origin !== '' ? origin : '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Expose-Headers': 'Set-Cookie'
  };
}
