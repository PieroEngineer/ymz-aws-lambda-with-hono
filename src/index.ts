import { Hono } from "hono";
import { cors } from "hono/cors"; // 🔌 1. Import the native CORS middleware
import { handle } from "hono/aws-lambda"; // 🔌 Official Hono adapter for AWS serverless payloads
import { requestsRouter } from "./routes/requests.js"; // 📦 Import your requests submodule router
import { paymentsRouter } from "./routes/payments.js";
import { restaurantsRouter } from "./routes/restaurants.js"; // 🔌 Import the new file
import { usersRouter } from "./routes/users.js";
import { contactsRouter } from "./routes/contacts.js";

// Initialize the root Hono platform application
const app = new Hono();

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

/**
 * 🚇 UNIFIED SUB-ROUTER REGISTRATION
 * Funnels all traffic coming to '/requests/*' straight into our modular requests router.
 * This includes /requests/create and /requests/:requestId/cancel
 */
app.route("/payments", paymentsRouter);
app.route("/requests", requestsRouter);
app.route("/restaurants", restaurantsRouter); // 🏪 Funnels all /restaurants/* traffic here
app.route("/users", usersRouter); // 🙋 Funnels all /users/* traffic straight into the new module
app.route("/contacts", contactsRouter);

/**
 * 🎯 BASE HEALTH CHECK ROUTE
 * Useful to verify your API Gateway proxy is successfully reaching the Lambda.
 */
app.get("/", (c) => {
  return c.json({
    status: "healthy",
    service: "Yummizi Engine",
    timestamp: new Date().toISOString()
  });
});

/**
 * 🚀 PRODUCTION HANDLER EXPORT (AWS Lambda & LocalStack)
 * The handle() wrapper automatically translates API Gateway events (v1 and v2) 
 * into standard Hono requests and responses perfectly.
 */
export const handler = handle(app);

export default app;