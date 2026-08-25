import { Hono } from "hono";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { calculateTotalCost, obtainAllOrders, obtainPaymentPresignedUrl, obtainSpecificDishesData, saveConfirmationEvent, transmitConfirmationToRestaurant } from "../services/paymentService.js"
import { ConfirmedOrder, dishPrice, PaymentConfirmationPayload, PaymentConfirmationResponse } from "../types/payments.js";
import { PresignedUrls } from "../types/s3Clients.js";
import { bodyLimit } from "hono/body-limit";

export const paymentsRouter = new Hono(); // TODO: Rename this feature from "payment" to "order"


//X
// export interface PaymentImageReferencesPayload {  // TODO: Move to interfaces
//   uploadUrl: string; // Temporary token URL for client PUT request
//   publicUrl: string; // The permanent public read URL saved in DB
// }

//X
// // 🔌 Wrap standard Dynamo client into Document Client for comfortable JSON mappings
// const s3Client = getS3Client();
// export const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
//   marshallOptions: { removeUndefinedValues: true },
// });

export const TABLE_NAME = "YummiziTable";

paymentsRouter.post("/confirm", async (c) => {  // TODO: Implement Zod in every router and move become them more abstract
  try {
    // 📩 Parse input payload safely from Hono context body
    const body: PaymentConfirmationPayload = await c.req.json().catch(() => ({}));  /// What of these IDs go in the URL?  /// Should I include it inside the try that is bellow?

    // TODO: Only the users in ACCEPTED can do this 

    if (!body.restaurantId || !body.userId || !body.requestId) {
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }

    const dishItems: dishPrice[] = await obtainSpecificDishesData(body.orderSelections, body.restaurantId)

    const totalCostInCents = calculateTotalCost(body.orderSelections, dishItems);

    // IN FAIL: I changed the menus for payments because that has more sense, look for possible bugs
    // const s3Key = `menus/${body.restaurantId}/${body.requestId}.webp`;  /// This shape could be useful when we use "S3 ObjectCreated event"
    const s3Key = `payments/${body.restaurantId}/${body.requestId}.webp`;  /// This shape could be useful when we use "S3 ObjectCreated event"

    const paymentImageReferences: PresignedUrls = await obtainPaymentPresignedUrl(s3Key)

    const now = Date.now()
    const newConfirmationEvent: ConfirmedOrder = {
      totalCostInCents: totalCostInCents,
      lastUpdateTimestamp: now,
      onPaidTimeStamp: now,
      ...body
    }

    await saveConfirmationEvent(newConfirmationEvent)

    await transmitConfirmationToRestaurant(newConfirmationEvent)

    const paymentConfirmationResponse: PaymentConfirmationResponse = {
      message: "Order saved successfully and broadcast state synchronized",
      requestId: body.requestId,
      totalPriceInCents: totalCostInCents,
      paymentImageReferences: paymentImageReferences
      // realtimeNotified: ablyDispatchSuccess
    }

    // 🎉 Success response utilizing Hono native JSON encoder
    return c.json(paymentConfirmationResponse, 201);
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

   const mappedPayloads = await obtainAllOrders(rid)

    return c.json(mappedPayloads, 200);
  } catch (error: any) {
    console.error(`🚨 FETCH PAYMENT PRESELECTIONS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

