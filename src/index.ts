import { Hono } from "hono";
import { handle } from "hono/aws-lambda"; // 🔌 Official Hono adapter for AWS serverless payloads
import { requestsRouter } from "./routes/requests.js"; // 📦 Import your requests submodule router
import { paymentsRouter } from "./routes/payments.js";
import { restaurantsRouter } from "./routes/restaurants.js"; // 🔌 Import the new file
import { usersRouter } from "./routes/users.js";
import { contactsRouter } from "./routes/contacts.js";
import { cors } from "hono/cors";

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