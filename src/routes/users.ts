import { Hono } from "hono";
import { PutCommand, DeleteCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";

// 🔌 Wrap standard client for clean, automated JSON marshalling
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = "YummiziTable";

// 📦 Create an isolated, modular sub-router for /users routes
export const usersRouter = new Hono();

/**
 * 🛰️ ROUTE: Save or update a user preferences entity
 * PATH: PUT /users/:userId/preferences/:prefId
 */
usersRouter.put("/:userId/preferences/:prefId", async (c) => {
  try {
    // 🗺️ Extract context routing path variables cleanly
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");

    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }

    // 📩 Parse input payload safely from Hono context body
    const body = await c.req.json().catch(() => ({}));

    const pk = `USER#${user_id}`;
    const sk = `PREF#${pref_id}`;

    // 📝 Prepare the single-table item schema matching Kotlin data models
    const preferenceItem = {
      PK: pk,
      SK: sk,
      userId: user_id, // Redundant but useful for GSIs later
      prefId: pref_id,
      title: body.title,
      description: body.description,
      color: body.color,
      createdAt: body.createdAt ? Number(body.createdAt) : undefined // Maps Kotlin Long timestamp cleanly
    };

    /**
     * 💡 HINT FOR FUTURE SECURITY/VALIDATION TODO FIX:
     * If you want to enable the validation logic later, you can uncomment this validation guard block:
     * if (!preferenceItem.title || !preferenceItem.color) {
     * return c.json({ error: "Title and Color are required" }, 400);
     * }
     */

    // ⚡ Execute Atomic Upsert (replaces entire object block if matching keys are targeted)
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: preferenceItem
    }));

    console.log(`✅🙋 The preference ${pref_id} for user ${user_id} was successfully added`);
    return c.json({ message: "Preference saved successfully" }, 200);

  } catch (error: any) {
    console.error(`🚩 USER PREF PUT ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * 🛰️ ROUTE: Erase a targeted user preference block
 * PATH: DELETE /users/:userId/preferences/:prefId
 */
usersRouter.delete("/:userId/preferences/:prefId", async (c) => {
  try {
    const user_id = c.req.param("userId");
    const pref_id = c.req.param("prefId");

    if (!user_id || !pref_id) {
      return c.json({ error: "Missing userId or prefId in path" }, 400);
    }

    const pk = `USER#${user_id}`;
    const sk = `PREF#${pref_id}`;

    // ⚡ Execute atomic delete operation against targeted key coordinate
    await docClient.send(new DeleteCommand({
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk }
    }));

    console.log(`✅🗑️ The preference ${pref_id} of user ${user_id} was successfully deleted`);
    
    // 📭 Return true 204 No Content with empty body standard payload
    return c.body(null, 204);

  } catch (error: any) {
    console.error(`🚩 USER PREF DELETE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});