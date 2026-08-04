import { Hono } from "hono";
import { QueryCommand, PutCommand, UpdateCommand, DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";
import { ablyKeyWS } from "../k.js";

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
    const restaurantId = body.restaurantId;
    const userId = body.userId;
    const requestId = body.requestId;   // TODO: It should be created in here, not in client
    const groupSize = body.groupSize;        
    const userName = body.userName;      
    const arrivalTime = body.arrivalTime;      

    if (!restaurantId || !userId || !requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }

    const requestTime =  Date.now()

    /// Mocks: They should be passed by the customer's request
    const mockUserSpecifics = ['special day', 'with vehicule']
    // const mockUserSpecifics = {  // TODO: Research how to implement in this way when details are added in the specifications (Maybe every detail could be a object's keys like "groupSize" or "state", and their value)
    //     birthday: 'For julia',
    //     baby: '2 babies'
    //   }

    // TODO: Verify here that the arrival time is less than 20 minutes (or a small time that the restaurant set)

    // Base info
    const baseRequestInfo = {
      userId: userId,
      userName: userName,
      groupSize: groupSize,
      onQueuedTimestamp: requestTime,
      state: "QUEUED",
      specifics: mockUserSpecifics,
      arrivlaTime: arrivalTime
    }

    // Match exact original structure for Database Ledger
    const newRequestItem = {
      PK: `REST#${restaurantId}`,
      SK: `REQ#${requestId}`,

      ...baseRequestInfo
    };

    console.log('💽  Request Item to save in DynamoDB', JSON.stringify(newRequestItem , null, 2), '\nfor restaurant ', restaurantId);
    
    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: newRequestItem,
    }));

    // CONSTRUCT TARGET CLIENT INTERFACE PAYLOAD ("TableRequestPayload" shape)  
    const clientPayload = {
      requestId: requestId,

      ...baseRequestInfo
    };

    // EXECUTING FIRE-AND-FORGET MOCK ABLY DISPATCH (Side Effect Secondary)
    // Wrapped inside a fast transient network retry loop block

    const apiKey = ablyKeyWS;

    if (!apiKey) {
      throw new Error("ABLY_API_KEY is not defined");
    }

    const [username, password] = apiKey.split(':');
    const credentials = btoa(`${username}:${password}`);

    const channelName = `restaurant:${restaurantId}:ops`;
    const requestName = 'table-requested'
    
    const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`

    // We can extract this to an inline execution workflow
    let ablyDispatchSuccess = false;
    let attempts = 0;
    const maxAttempts = 3;

    while (!ablyDispatchSuccess && attempts < maxAttempts) {  /// TODO: Follow the folder tree of AWS expert in Claude for more abstraction.
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
          console.log(`📦  Data to send: ${JSON.stringify({name: requestName, data: clientPayload}, null, 2)}`);
          
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
      requestId: requestId,
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
    const requestId = c.req.param("requestId");
    
    const body = await c.req.json().catch(() => ({}));
    const restaurantId = body.restaurantId;

    if (!requestId || !restaurantId) {
      return c.json({ error: "Missing requestId or restaurantId" }, 400);
    }

    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;
    const timestamp = new Date().toISOString();

    // /**
    //  * 🛡️ ATOMIC CONDITIONAL UPDATE
    //  * 💡 HINT FOR FUTURE STATE-DRIVEN TODO FIX:
    //  * To change this condition to rely on your state machine flow instead of timestamp checking,
    //  * you can map the ConditionExpression to check against your allowed statuses:
    //  * e.g., ConditionExpression: "#stateAttr = :queuedState OR #stateAttr = :processingState"
    //  */
    // await docClient.send(new UpdateCommand({
    //   TableName: TABLE_NAME,
    //   Key: { PK: pk, SK: sk },
    //   UpdateExpression: "SET onCancellationTimestamp = :ts",
    //   ConditionExpression: "attribute_not_exists(onPaidTimestamp)",
    //   ExpressionAttributeValues: {
    //     ":ts": timestamp,
    //   }
    // }));

    await docClient.send(new DeleteCommand({  // TODO: This is temporal  code and should be alternated with the commented code that is just above
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
    }));

    return c.json({
      message: "Request cancelled successfully",
      // onCancellationTimestamp: timestamp
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
 * 🛰️ ROUTE: Fetch all active requests for a specific restaurant
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

    console.log(`🔍 Raw data to respond the GET request \n${JSON.stringify(rawItems)} \nFor Restaurant: ${rid}`);

    // 🧹 2. Filter for active requests and transform them to match "TableRequestPayload"
    const mappedPayloads = rawItems
      .map((item) => {
        const requestId = item.SK.replace("REQ#", ""); // Strip the prefix back out to get the clean ID

        // Return the exact structure matching your client-side type definitions
        return {
          requestId: requestId,

          userId: item.userId,
          userName: item.userName,
          groupSize: item.groupSize,
          onQueuedTimestamp: item.onQueuedTimestamp,
          state: item.state,
          specifics: item.specifics,
          arrivlaTime: item.arrivlaTime // TODO: Correct the name
        };
      });

    console.log(`1️⃣📦  Initialized UI state feed: Found \n${JSON.stringify(mappedPayloads)} \nFor Restaurant: ${rid}`);

    // 🎉 3. Output the compiled collection straight to your frontend
    return c.json(mappedPayloads, 200);

  } catch (error: any) {
    console.error(`🚨 FETCH ACTIVE REQS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

requestsRouter.post("/:restaurantId/update", async (c) => { /// (#1) Analize if it should be "requestId" instead of the "restaurantId"
  try {
    const restaurantId = c.req.param("restaurantId");
    const body = await c.req.json().catch(() => ({}));
    const requestId = body.requestId;
    const newState = body.newState;
    const userId = body.userId; /// (#1) if yes, consider if the secure way to get the "userId" and "restaurantId" is via dynamoDB's Query and not from the client 

    console.log(`1️⃣📦  Data arrived from restaurant ${restaurantId} \n${JSON.stringify(body)}`);

    if (!restaurantId || !requestId || !newState) {
      return c.json({ error: "Missing restaurantId, requestId, or newState" }, 400);
    }

    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;

    const normalizedState = String(newState); /// Necessary?

    // TODO: Before update, check that the status transition is valid

    await docClient.send(new UpdateCommand({  // TODO: Include the updating of the acceptance's timestamp too
      TableName: TABLE_NAME,
      Key: { PK: pk, SK: sk },
      UpdateExpression: "SET #state = :state",
      ExpressionAttributeNames: {
        "#state": "state",
      },
      ExpressionAttributeValues: {
        ":state": normalizedState,
      },
    }));

    // TODO:
    // 1. Get the active requests of the user and separate them from the current request.
    // 2. Cancel those request in DynamoBD (In MVP, it's deleting them, but then is updating the attribute "onCancelTimestamp") 
    // 3. Use the batch publish of Ably to cancel the table request of the other restaurants (In claude "AWS expert" is the code ) 

    const channelName: Record<string, string> = {
      ACCEPTED: `request:${userId}`,
      READY: `restaurant:${restaurantId}:ops`
    }

    const apiKey = ablyKeyWS;
    let realtimeNotified = false;

    if (apiKey) {
      const [username, password] = apiKey.split(":");
      const credentials = btoa(`${username}:${password}`);
      //X const channelName = `request:${userId}`;  // In mobile -> "request:$userId"
      console.log(`1️⃣📺  Channel to subscrive ${channelName[normalizedState]}`);
      const ablyEndpoint = `https://rest.ably.io/channels/${channelName[normalizedState]}/messages`;

      try {
        const ablyResponse = await fetch(ablyEndpoint, {
          method: "POST",
          headers: {
            'Authorization': `Basic ${credentials}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "request-status-updated", /// Consider change Message's name by a code for security 
            data: { // TODO: Move this to an object like above
              //X restaurantId,
              requestId,
              newStatus: normalizedState,
            },
          }),
        });

        realtimeNotified = ablyResponse.ok;
        if (!ablyResponse.ok) {
          console.warn(`⚠️ Failed to broadcast request status update to Ably, status=${ablyResponse.status}`);
        }
      } catch (error: any) {
        console.warn(`⚠️ Failed to broadcast request status update to Ably: ${error.message}`);
      }
    } else {
      console.warn("⚠️ ABLY_API_KEY is not defined; skipping realtime broadcast.");
    }

    console.log(`🔎  The post of the request update finished`);

    return c.json({
      message: "Request state updated successfully",
      restaurantId,
      requestId,
      newState: normalizedState,
      realtimeNotified,
    }, 200);
  } catch (error: any) {
    console.error(`🚨 UPDATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});