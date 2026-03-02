// @ts-nocheck
import { Hono } from 'hono';
import { getAnalytics } from '../lib/storage.js';

const analytics = new Hono();

analytics.get('/', async (c) => {
  const userId = c.get('userId') as string;
  return c.json(await getAnalytics(userId));
});

export default analytics;
