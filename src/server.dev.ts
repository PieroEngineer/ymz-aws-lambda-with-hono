import { serve } from '@hono/node-server';
import app from './index.js';
import { cors } from 'hono/cors';

// This is going to be your local development server for testing the Hono app in a Node.js environment.

const port = 3000;
console.log(`🏃‍♂️ Yummizi Engine sandbox listening on http://localhost:${port}`);

// Environment-aware origin verification
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  process.env.FRONTEND_URL || "" // Dynamically set in SAM template
];


// 🔓 2. Enable CORS globally before your routes
// This allows your web app running on ANY local port to talk to your API 
app.use(
  "/*",
  cors({
    origin: (origin) => {
      if (!origin) return ALLOWED_ORIGINS[0]; // Allow non-browser callers (Postman, mobile native)
      if (origin.includes("localhost") || ALLOWED_ORIGINS.includes(origin)) {
        return origin;
      }
      return null;
    },
    allowHeaders: ["Content-Type", "Authorization"],
    // YES: Always include PATCH for RESTful partial updates (e.g., updating partial user profiles)
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], 
    exposeHeaders: ["Content-Length"],
    maxAge: 86400, // 24 hours (Reduces preflight OPTIONS requests)
    credentials: true,
  })
);

serve({
  fetch: app.fetch,
  port: port
});

// npx tsx src/server.dev.ts