import { Hono } from "hono";
import { handle } from "hono/aws-lambda"; // 🔌 Official Hono adapter for AWS serverless payloads
import { requestsRouter } from "./routes/requests.js"; // 📦 Import your requests submodule router
import { restaurantsRouter } from "./routes/restaurants.js"; // 🔌 Import the new file
import { usersRouter } from "./routes/users.js";

// Initialize the root Hono platform application
const app = new Hono();

/**
 * 🚇 UNIFIED SUB-ROUTER REGISTRATION
 * Funnels all traffic coming to '/requests/*' straight into our modular requests router.
 * This includes /requests/create and /requests/:requestId/cancel
 */
app.route("/requests", requestsRouter);
app.route("/restaurants", restaurantsRouter); // 🏪 Funnels all /restaurants/* traffic here
app.route("/users", usersRouter); // 🙋 Funnels all /users/* traffic straight into the new module

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

/**
 * 💻 STANDALONE NODE SERVER ENGINE (Local Development Sandbox)
 * Runs your backend on http://localhost:3000 when you execute `npm run dev`.
 * It automatically bypasses the Lambda simulator overhead for instant console logs.
 */
if (process.env.NODE_ENV === "development" && !process.env.AWS_LAMBDA_FUNCTION_NAME) {
  import("@hono/node-server").then(({ serve }) => {
    const port = 3000;
    console.log(`\n=================================================`);
    console.log(`🏃‍♂️ Yummizi Engine listening on http://localhost:${port}`);
    console.log(`💡 Standalone mode active: testing routes is super fast!`);
    console.log(`=================================================\n`);
    
    serve({
      fetch: app.fetch,
      port: port
    });
  });
}

export default app;