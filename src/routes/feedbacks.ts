import { Hono } from "hono";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";

export const feedbacksRouter = new Hono();

const TABLE_NAME = "YummiziTable";

// 🔌 Wrap standard Dynamo client into Document Client for comfortable JSON mappings
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

feedbacksRouter.post("/final", async (c) =>{
    try{
        // 📩 Parse input payload safely from Hono context body
        const body = await c.req.json().catch(() => ({}));
        const userId = body.userId   // TODO: It should be created in here, not in client
        const requestId = body.requestId
        const conformDegree = body.conformDegree
        const description = body.description

    if (!userId || !requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }

    const newFinalFeedbackItem = {
        PK: `FEEDBACK#${requestId}`,
        SK: `USER#${userId}`,

        conformDegree: conformDegree,
        description: description
    }

    console.log('💽 Feedback Item to save in DynamoDB', JSON.stringify(newFinalFeedbackItem , null, 2), '\nfor request ', requestId);

    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newFinalFeedbackItem,
    }));

    // 🎉 Success response utilizing Hono native JSON encoder
      return c.json({
        message: "Feedback saved successfully",
        // realtimeNotified: ablyDispatchSuccess
      }, 201);

    }
    catch (error: any) {
        console.error(`🚨 SAVE FEEDBACK ERROR: ${error.message}`);
        return c.json({ error: error.message || "Internal Server Error" }, 500);
    }
})