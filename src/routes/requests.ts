import { Hono } from "hono";
import { QueryCommand, PutCommand, UpdateCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";

// 🌍 CONFIGURATION COORDINDATES FOR REUSE
// In production, these will be read from process.env.ABLY_REST_URL
const MOCK_ABLY_REST_URL = "http://host.docker.internal:8080";

// 🔌 Wrap standard Dynamo client into Document Client for comfortable JSON mappings
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = "YummiziTable";

// 📦 Create an isolated, modular sub-router for /requests routes
export const requestsRouter = new Hono();

/**
 * 🛰️ ROUTE: Create a new Restaurant Queue / Table Request and Broadcast Event
 * PATH: POST /requests/create
 */
requestsRouter.post("/create", async (c) => {
  try {
    // 📩 Parse input payload safely from Hono context body
    const body = await c.req.json().catch(() => ({}));
    const rid = body.restaurantId;
    const uid = body.userId;
    const req_id = body.requestId; 

    if (!rid || !uid || !req_id) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }

    const now = new Date().toISOString();

    // 📝 1. Match exact original Python dictionary structure for Database Ledger
    const newRequestItem = {
      PK: `REST#${rid}`,
      SK: `REQ#${req_id}`,
      userId: uid,
      state: "QUEUED",
      onQueuedTimestamp: now,

    };

    // ⚡ 2. Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newRequestItem,
    }));

    // 🍔 3. CONSTRUCT TARGET CLIENT INTERFACE PAYLOAD ("TableRequestPayload" shape)
    // Hardcoding default parameters for scenario testing simulation  //TODO(#1): This adaptation shouldn't be here, but in the restaurant app
    const clientPayload = {
      requestId: req_id,
      title: "Mesa 4", // Hardcoded target identifier label
      type: "QUEUED", // Hardcoded example enum value matching TableRequestType
      createdAt: now,
      referenceTimeMinutes: 0, // Freshly created, relative offset is exactly zero minutes
      info: [
        { label: "Cliente ID", value: uid.substring(0, 8) },
        { label: "Detalle", value: "Solicita asistencia del mozo en mesa." }
      ],
      statusText: "En Espera"
    };

    // 📡 4. EXECUTING FIRE-AND-FORGET MOCK ABLY DISPATCH (Side Effect Secondary)
    // Wrapped inside a fast transient network retry loop block

    const temporalHardcodedId = '4258e0fa-6b3c-43bc-a6d8-82c5835d608d'
    const apiKey = process.env.ABLY_API_KEY;

    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not defined");
    }

    const [username, password] = apiKey.split(':');
    const credentials = btoa(`${username}:${password}`);

    // const ablyChannel = `restaurant:${rid}:ops`;  //restaurant:${restaurantId}:ops
    const channelName = `restaurant:${temporalHardcodedId}:ops`;
    const requestName = 'table-requested'
    
    const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`

    //Xconst ablyChannel = `restaurant:${temporalHardcodedId}:ops`;  //restaurant:${restaurantId}:ops
    //X const localAblyEndpoint = `${MOCK_ABLY_REST_URL}/v1/apps/local-app/channels/${encodeURIComponent(ablyChannel)}/messages`;

    // We can extract this to an inline execution workflow
    let ablyDispatchSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!ablyDispatchSuccess && attempts < maxAttempts) {
      try {
        attempts++;
        const ablyResponse = await fetch(ablyEndpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: requestName,   // The targeted subscriber frequency path matching mock constraints
            data: clientPayload   // The exact TableRequestPayload DTO shape your staff app consumes
          })
        });

        if (ablyResponse.ok) {
          ablyDispatchSuccess = true;
          console.log(`📡 [Attempt ${attempts}] Successfully broadcast table request event to Ably channel: ${channelName}`);
          console.log(`🔎  Data to send: ${JSON.stringify({name: "table-requested", data: clientPayload}, null, 2)}`);
          
        } else {
          console.warn(`⚠️ [Attempt ${attempts}] Mock Ably returned a status error code: ${ablyResponse.status}`);
        }
      } catch (netErr: any) {
        console.warn(`⚠️ [Attempt ${attempts}] Network failure transmitting data payload to mock Ably server: ${netErr.message}`);
      }
    }

    // Logging total failure fallback trace benchmarks if the mock server is down entirely
    if (!ablyDispatchSuccess) {
      console.error(`🚨 CRITICAL: Failed to stream real-time broadcast alert data past ${maxAttempts} attempts. Database state remains fully valid.`);
    }

    // 🎉 5. Success response utilizing Hono native JSON encoder
    return c.json({
      message: "Request created successfully and broadcast state synchronized",
      requestId: req_id,
      realtimeNotified: ablyDispatchSuccess
    }, 201);

  } catch (error: any) {
    console.error(`🚨 CREATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

/**
 * 🛰️ ROUTE: Cancel an existing Queue Request safely
 * PATH: POST /requests/:requestId/cancel
 */
requestsRouter.post("/:requestId/cancel", async (c) => {
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
    await docClient.send(new UpdateCommand({
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

  } catch (error: any) {
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

/**
 * 🛰️ ROUTE: Fetch all active queue requests for a specific restaurant
 * PATH: GET /requests/restaurant/:restaurantId/requests
 */
requestsRouter.get("/:restaurantId", async (c) => {
  try {
    const rid = c.req.param("restaurantId");

    if (!rid) {
      return c.json({ error: "Missing restaurantId parameter" }, 400);
    }

    // 🔍 1. Query DynamoDB for everything matching this restaurant's requests partition
    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${rid}`,
        ":skPrefix": "REQ#"
      }
    };

    const dbResult = await docClient.send(new QueryCommand(queryParams));
    const rawItems = dbResult.Items || [];

    // 🧹 2. Filter for active requests and transform them to match "TableRequestPayload"
    const mappedPayloads = rawItems
      // .filter((item) => item.state === "QUEUED") // Only pull records awaiting waiter actions // TODO: change it later
      .map((item) => {
        const requestId = item.SK.replace("REQ#", ""); // Strip the prefix back out to get the clean ID
        const createdAtISO = item.onQueuedTimestamp || new Date().toISOString();

        // 🕒 Compute the difference in minutes between creation time and now
        const createdTimeMs = new Date(createdAtISO).getTime();
        const nowMs = new Date().getTime();
        const diffMinutes = Math.max(0, Math.floor((nowMs - createdTimeMs) / 60000));

        // Return the exact structure matching your client-side type definitions
        return {  // TODO: It shouldn't hardcode items here. After repair the TODO(#1), assign the "item"'s attributes of "rawItems" here directly
          requestId: requestId,
          title: "Mesa 4", // Hardcoded target placeholder for now
          type: "QUEUED", // Hardcoded example enum value matching TableRequestType
          createdAt: createdAtISO,
          referenceTimeMinutes: diffMinutes, // Dynamic relative offset calculation
          info: [
            { label: "Cliente ID", value: String(item.userId).substring(0, 8) },
            { label: "Estado", value: `El cliente está en espera en la mesa.` }
          ],
          statusText: "En Espera"
        };
      });

    console.log(`🔍 Initialized UI state feed: Found ${mappedPayloads.length} active table requests for Restaurant: ${rid}`);

    // 🎉 3. Output the compiled collection straight to your frontend
    return c.json(mappedPayloads, 200);

  } catch (error: any) {
    console.error(`🚨 FETCH ACTIVE REQS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});