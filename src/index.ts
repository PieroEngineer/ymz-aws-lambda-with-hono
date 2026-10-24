import { Hono } from "hono";
import { handle } from "hono/aws-lambda"; // 🔌 Official Hono adapter for AWS serverless payloads
import { requestsRouter } from "./routes/requests.js"; // 📦 Import your requests submodule router
import { paymentsRouter } from "./routes/payments.js";
import { restaurantsRouter } from "./routes/restaurants.js"; // 🔌 Import the new file
import { usersRouter } from "./routes/users.js";
import { contactsRouter } from "./routes/contacts.js";
import { cors } from "hono/cors";
import { trackingRouter } from "./routes/tracking.js";

// Initialize the root Hono platform application
const app = new Hono();


app.use('*', cors({
  origin: 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400,
}))

// if (!process.env.AWS_LAMBDA_FUNCTION_NAME) {
//   app.use(
//     '*',
//     cors({
//       origin: 'http://localhost:5173',
//       credentials: true,
//     })
//   );
// }


/**
 * 🚇 UNIFIED SUB-ROUTER REGISTRATION
 * Funnels all traffic coming to '/requests/*' straight into our modular requests router.
 * This includes /requests/create and /requests/:requestId/cancel
 */
app.route("/payments", paymentsRouter);
app.route("/requests", requestsRouter);
app.route("/restaurants", restaurantsRouter);
app.route("/users", usersRouter);
app.route("/contacts", contactsRouter);
app.route("/tracking", trackingRouter)

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
// export const handler = handle(app);

// For real AWS 
const rawHandler = handle(app)

export const handler = async (event: any, context: any) => {
  const stage = event.requestContext?.stage
  if (stage && stage !== '$default' && event.rawPath?.startsWith(`/${stage}`)) {
    event.rawPath = event.rawPath.slice(stage.length + 1) || '/'
    if (event.requestContext?.http?.path) {
      event.requestContext.http.path = event.requestContext.http.path.slice(stage.length + 1) || '/'
    }
  }
  return rawHandler(event, context)
}

export default app;