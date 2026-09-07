import { serve } from '@hono/node-server';
import app from './index.js';

// This is going to be your local development server for testing the Hono app in a Node.js environment.

const port = 3000;
console.log(`🏃‍♂️ Yummizi Engine sandbox listening on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port: port
});

// npx tsx src/server.dev.ts