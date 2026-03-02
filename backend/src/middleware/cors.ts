import { Context, Next } from 'hono';

export async function corsMiddleware(c: Context, next: Next) {
  // Allow chrome-extension origins and localhost for dev
  const origin = c.req.header('origin') || '';
  const allowed = origin.startsWith('chrome-extension://') ||
                  origin.includes('localhost') ||
                  origin.includes('vercel.app');

  if (allowed) {
    c.header('Access-Control-Allow-Origin', origin);
  }

  c.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  c.header('Access-Control-Allow-Headers', 'Content-Type, x-user-id');
  c.header('Access-Control-Max-Age', '86400');

  if (c.req.method === 'OPTIONS') {
    return new Response(null, { status: 204 });
  }

  await next();
}
