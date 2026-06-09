"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const hono_1 = require("hono");
const aws_lambda_1 = require("hono/aws-lambda"); // 🔌 Official Hono adapter for AWS serverless payloads
const requests_js_1 = require("./routes/requests.js"); // 📦 Import your requests submodule router
const restaurants_js_1 = require("./routes/restaurants.js"); // 🔌 Import the new file
// Initialize the root Hono platform application
const app = new hono_1.Hono();
/**
 * 🚇 UNIFIED SUB-ROUTER REGISTRATION
 * Funnels all traffic coming to '/requests/*' straight into our modular requests router.
 * This includes /requests/create and /requests/:requestId/cancel
 */
app.route("/requests", requests_js_1.requestsRouter);
app.route("/restaurants", restaurants_js_1.restaurantsRouter); // 🏪 Funnels all /restaurants/* traffic here
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
exports.handler = (0, aws_lambda_1.handle)(app);
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
exports.default = app;
