"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestsRouter = void 0;
const hono_1 = require("hono");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const clientFactory_js_1 = require("../aws/clientFactory.js");
// 🔌 Wrap standard Dynamo client into Document Client for comfortable JSON mappings
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from((0, clientFactory_js_1.getDynamoDBClient)(), {
    marshallOptions: { removeUndefinedValues: true },
});
const TABLE_NAME = "YummiziTable";
// 📦 Create an isolated, modular sub-router for /requests routes
exports.requestsRouter = new hono_1.Hono();
/**
 * 🛰️ ROUTE: Create a new Restaurant Queue Request
 * PATH: POST /requests/create
 */
exports.requestsRouter.post("/create", async (c) => {
    try {
        // 📩 Parse input payload safely from Hono context body
        const body = await c.req.json().catch(() => ({}));
        const rid = body.restaurantId;
        const uid = body.userId;
        const req_id = body.requestId;
        if (!rid || !uid) {
            return c.json({ error: "Missing restaurantId or userId" }, 400);
        }
        const now = new Date().toISOString();
        // 📝 Match exact original Python dictionary structure
        const newRequestItem = {
            PK: `REST#${rid}`,
            SK: `REQ#${req_id}`,
            userId: uid,
            state: "Queued",
            onQueuedTimestamp: now,
        };
        // ⚡ Execute atomic database insertion
        await docClient.send(new lib_dynamodb_1.PutCommand({
            TableName: TABLE_NAME,
            Item: newRequestItem,
        }));
        // 🎉 Success response utilizing Hono native JSON encoder
        return c.json({
            message: "Request created successfully",
            requestId: req_id,
        }, 201);
    }
    catch (error) {
        console.error(`🚨 CREATE REQ ERROR: ${error.message}`);
        return c.json({ error: error.message || "Internal Server Error" }, 500);
    }
});
/**
 * 🛰️ ROUTE: Cancel an existing Queue Request safely
 * PATH: POST /requests/:requestId/cancel
 */
exports.requestsRouter.post("/:requestId/cancel", async (c) => {
    try {
        // 🗺️ Extract context routing path variables
        const request_id = c.req.param("requestId");
        const body = await c.req.json().catch(() => ({}));
        const restaurant_id = body.restaurantId;
        if (!request_id || !restaurant_id) {
            return c.json({ error: "Missing requestId or restaurantId" }, 400);
        }
        const pk = `REST#${restaurant_id}`;
        const sk = `REQ#${request_id}`;
        const timestamp = new Date().toISOString();
        /**
         * 🛡️ ATOMIC CONDITIONAL UPDATE
         * 💡 HINT FOR FUTURE STATE-DRIVEN TODO FIX:
         * To change this condition to rely on your state machine flow instead of timestamp checking,
         * you can map the ConditionExpression to check against your allowed statuses:
         * e.g., ConditionExpression: "#stateAttr = :queuedState OR #stateAttr = :processingState"
         */
        await docClient.send(new lib_dynamodb_1.UpdateCommand({
            TableName: TABLE_NAME,
            Key: { PK: pk, SK: sk },
            UpdateExpression: "SET onCancellationTimestamp = :ts",
            ConditionExpression: "attribute_not_exists(onPaidTimestamp)",
            ExpressionAttributeValues: {
                ":ts": timestamp,
            }
        }));
        return c.json({
            message: "Request cancelled successfully",
            onCancellationTimestamp: timestamp
        }, 200);
    }
    catch (error) {
        // 🛑 CHECK FOR CONDITIONAL TRANSACTION COLLISION
        if (error.name === "ConditionalCheckFailedException") {
            return c.json({
                error: "The request was already paid and cannot be cancelled"
            }, 403);
        }
        console.error(`🚨 CANCEL REQ ERROR: ${error.message}`);
        return c.json({ error: "Internal Server Error" }, 500);
    }
});
