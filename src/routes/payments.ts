import { Hono } from "hono";
import { getDynamoDBClient, getS3Client } from "../aws/clientFactory.js";
import { QueryCommand, PutCommand, DynamoDBDocumentClient, BatchGetCommand } from "@aws-sdk/lib-dynamodb";
import { ablyKeyWS } from "../k.js";
import { OrderItemPayload } from "../types/orders.js";
import { calculateTotalCost } from "../services/paymentService.js"
import { PutObjectCommand } from "@aws-sdk/client-s3"; // 📦 Native S3 actions
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // 🔑 Presign signing engines

export const paymentsRouter = new Hono();

const s3Client = getS3Client();

export interface PaymentImageReferencesPayload {  // TODO: Move to interfaces
  uploadUrl: string; // Temporary token URL for client PUT request
  publicUrl: string; // The permanent public read URL saved in DB
}

// 🔌 Wrap standard Dynamo client into Document Client for comfortable JSON mappings
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = "YummiziTable";
const BUCKET_NAME = "restaurant-assets";

paymentsRouter.post("/confirm", async (c) => {  // TODO: Implement Zod in every router and move become them more abstract

    // 📩 Parse input payload safely from Hono context body
    const body = await c.req.json().catch(() => ({}));  /// What of these IDs go in the URL?  /// Should I include it inside the try that is bellow?

    const restaurantId: string = body.restaurantId; 
    const userId: string = body.userId;
    const requestId: string = body.requestId;
    const userName: string = body.userName;
    const arrivalTimeInMinutes: number = body.arrivalTimeInMinutes
    const groupSize: number = body.groupSize
    const orderSelections: OrderItemPayload[] = body.orderSelections;

    if (!restaurantId || !userId || !requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }

    // TODO: Only the users in ACCEPTED can do this 

    // Map your SKs into the required DynamoDB key structure
    const keys = orderSelections.map((selection) => ({
      PK: `REST#${restaurantId}`,
      SK: `RESOURCE#DISH#${selection.dishId}`,
    }));

    ///     const batchResponse = await docClient.send(new BatchGetCommand({
    const command = new BatchGetCommand({ /// Analyze if a transaction is more proper for this situation
      RequestItems: {
        [TABLE_NAME]: {
          Keys: keys,
          ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
          ProjectionExpression: "priceCents, SK", // Optional: Save bandwidth
        },
      },
    });
    const response = await docClient.send(command);

  // Extract results safely
  const dishItems = response.Responses?.[TABLE_NAME] || [];

  // console.log('💲🔎  Listing the prices in cents of the selected dishes');
  // dishItems.forEach(dishItem => {
  //     console.log(dishItem.dishName, ':', dishItem.priceCents)
  // });

  const totalCostInCents = calculateTotalCost(orderSelections, dishItems);
  // console.log('💲🔎  Total price in cents is ', totalCostInCents);

    // TODO: Handle the situation when a dish wasn't found. "BatchGet" doesn't notify that, so I leave this code as hint to handle it; continue the action to notify to the user and/or restaurant  /// If it's possible that the dish is not available, create the dish availability confirmation to the moment when the user go from menu selection to payment
    // Inside your Hono handler...
    // const requestedIds = ["123", "456", "789"];
    // const dishesFromDb = await batchGetDishes(keysToFetch);

    // // 1. Convert the DB array into a quick lookup Map using the clean Sort Key ID
    // const dbMap = new Map(
    //   dishesFromDb.map(item => [item.SK.replace("DISH#", ""), item])
    // );

    // // 2. Reconstruct the array matching the exact input order, inserting null for missing items
    // const orderedResults = requestedIds.map(id => dbMap.get(id) || null);


    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

    // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
    // const s3Key = `restaurants/${rid}/menus/${pageId}.webp`;
    const s3Key = `menus/${restaurantId}/${requestId}.webp`;  /// This shape could be useful when we use "S3 ObjectCreated event"

    // 🕒 CACHE BUSTING: Generate a standard Unix epoch timestamp (in seconds)
    const unixEpoch = Math.floor(Date.now() / 1000);

    // 🎯 COMBINED SOLUTION: The database saves the static path + the dynamic timestamp version parameter
    const publicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`;
    console.log('🔎  publicUrl', publicUrl)

    // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
    const uploadUrl = await getSignedUrl(
      s3Client,
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: s3Key,
        ContentType: "image/webp" // Enforces binary media type constraints
      }),
      { expiresIn: 900 } // URL token token expires safely in 15 minutes
    );

    const paymentImageReferences: PaymentImageReferencesPayload = {
      uploadUrl: uploadUrl,
      publicUrl: publicUrl
    }

    const basePaymentPreselection = {
        lastUpdateTimestamp: Date.now(),
        userName: userName,
        userId: userId,
        orderSelections: orderSelections,
        arrivalTimeInMinutes: arrivalTimeInMinutes,
        groupSize: groupSize,
        totalCostInCents: totalCostInCents,
        onPaidTimeStamp: Date.now()
        //paymentMethod,
    }

    const paymentPreselectionItem = {
        PK: `REST#${restaurantId}`,
        SK: `ORDER#${requestId}`,   /// Perphaps it should be a new ID, not the request ID

        ...basePaymentPreselection
    }

    console.log('💽  Order to save in DynamoDB', JSON.stringify(paymentPreselectionItem , null, 2), '\nfor restaurant ', restaurantId);

    // TODO: Handle the situation where it's an update of the pre-selection and not only a new one (Perhaps in another router)

    try {
        // Execute atomic database insertion (System of Record First!)
      await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: paymentPreselectionItem,
      }));

      const clientPayload = {
        requestId: requestId,

        ...basePaymentPreselection
      };

      const apiKey = ablyKeyWS;

      if (!apiKey) {
        throw new Error("ABLY_API_KEY is not defined");
      }

      const [username, password] = apiKey.split(':');
      const credentials = btoa(`${username}:${password}`);

      const channelName = `restaurant:${restaurantId}:ops`;
      const requestName = 'new-order-preselected'
      
      const ablyEndpoint = `https://rest.ably.io/channels/${channelName}/messages`

      // We can extract this to an inline execution workflow
      let ablyDispatchSuccess = false;
      let attempts = 0;
      const maxAttempts = 3;

      while (!ablyDispatchSuccess && attempts < maxAttempts) {  /// It would look better if this part is saved within a helper
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
            console.log(`📡 [Attempt ${attempts}] Successfully order preselection event to Ably channel: ${channelName}`);
            console.log(`📦  Order to send: ${JSON.stringify({name: requestName, data: clientPayload}, null, 2)}`);
            
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

      // 🎉 Success response utilizing Hono native JSON encoder
      return c.json({
        message: "Order saved successfully and broadcast state synchronized",
        requestId: requestId,
        totalPriceInCents: totalCostInCents,
        paymentImageReferences: paymentImageReferences
        // realtimeNotified: ablyDispatchSuccess
      }, 201);
  }
  catch (error: any) {
      console.error(`🚨 CREATE REQ ERROR: ${error.message}`);
      return c.json({ error: error.message || "Internal Server Error" }, 500);
  }

});

paymentsRouter.get("/:restaurantId", async (c) => {
  try {
    const rid = c.req.param("restaurantId");

    if (!rid) {
      return c.json({ error: "Missing restaurantId parameter" }, 400);
    }

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${rid}`,
        ":skPrefix": "ORDER#",
      },
    };

    const dbResult = await docClient.send(new QueryCommand(queryParams));
    const rawItems = dbResult.Items || [];

    const mappedPayloads = rawItems.map((item) => {
      const requestId = item.SK.replace("ORDER#", "");

      return {
        requestId,
        userName: item.userName,
        lastUpdateTimestamp: item.lastUpdateTimestamp,
        userId: item.userId,
        orderSelections: item.orderSelections,
        arrivalTimeInMinutes: item.arrivalTimeInMinutes,
        groupSize: item.groupSize,
        totalCostInCents: item.totalCostInCents,
        onPaidTimeStamp: item.onPaidTimeStamp,
      };
    });

    return c.json(mappedPayloads, 200);
  } catch (error: any) {
    console.error(`🚨 FETCH PAYMENT PRESELECTIONS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

