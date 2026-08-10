import { Hono } from "hono";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";

export const contactsRouter = new Hono();

const TABLE_NAME = "YummiziTable";

// 🔌 Wrap standard Dynamo client into Document Client for comfortable JSON mappings
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

contactsRouter.post("/feedback", async (c) =>{
    try{
        // 📩 Parse input payload safely from Hono context body
        const body = await c.req.json().catch(() => ({}));
        const userId = body.userId
        const requestId = body.requestId
        const conformDegree = body.conformDegree
        const description = body.description

      if (!userId) {
        return c.json({ error: "Missing userId" }, 400);
      }

      const newFinalFeedbackItem = {
          PK: `USER#${userId}`,
          SK: `FEEDBACK#${crypto.randomUUID()}`,

          requestId: requestId,
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

contactsRouter.post("/restaurant", async (c) =>{
    try{
        // 📩 Parse input payload safely from Hono context body
        const body = await c.req.json().catch(() => ({}));
        const userId = body.userId
        const restaurantName = body.restaurantName
        const restaurantContact = body.restaurantContact
        const restaurantComment = body.restaurantComment

        // TODOCheck if it's empty

    const newFinalContactItem = {
        PK: `USER#${userId}`,
        SK: `RCONTACT#${crypto.randomUUID()}`,

        restaurantName: restaurantName,
        restaurantContact: restaurantContact,
        restaurantComment: restaurantComment
    }

    console.log('💽 Contact Item to save in DynamoDB', JSON.stringify(newFinalContactItem , null, 2));

    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newFinalContactItem,
    }));

    // 🎉 Success response utilizing Hono native JSON encoder
      return c.json({
        message: "Contact saved successfully",
        // realtimeNotified: ablyDispatchSuccess
      }, 201);

    }
    catch (error: any) {
        console.error(`🚨 SAVE CONTACT ERROR: ${error.message}`);
        return c.json({ error: error.message || "Internal Server Error" }, 500);
    }
})