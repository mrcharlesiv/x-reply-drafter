/**
 * Simple auth middleware — extension sends userId in x-user-id header.
 * The userId is a locally-generated UUID stored in extension storage.
 */

import { Context, Next } from 'hono';

export async function authMiddleware(c: Context, next: Next) {
  const userId = c.req.header('x-user-id');
  if (!userId || userId.length < 8) {
    return c.json({ error: 'Missing or invalid x-user-id header' }, 401);
  }
  c.set('userId', userId);
  await next();
}
