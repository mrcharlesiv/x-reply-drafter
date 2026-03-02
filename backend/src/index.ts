import { Hono } from 'hono';
import { corsMiddleware } from './middleware/cors.js';
import { authMiddleware } from './middleware/auth.js';
import draftRoutes from './routes/draft.js';
import promptRoutes from './routes/prompts.js';
import postRoutes from './routes/posts.js';
import settingsRoutes from './routes/settings.js';
import analyticsRoutes from './routes/analytics.js';

const app = new Hono();

// Global middleware
app.use('*', corsMiddleware);
app.use('/api/*', authMiddleware);

// Health check
app.get('/', (c) => c.json({ status: 'ok', version: '2.0.0' }));

// Routes
app.route('/api/draft', draftRoutes);
app.route('/api/prompts', promptRoutes);
app.route('/api/posts', postRoutes);
app.route('/api/settings', settingsRoutes);
app.route('/api/analytics', analyticsRoutes);

export default app;
