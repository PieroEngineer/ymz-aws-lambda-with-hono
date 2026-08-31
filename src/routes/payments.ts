import { Hono } from "hono";
import { calculateTotalCost, finalizeOrder, obtainAllActiveOrders, obtainPaymentPresignedUrl, obtainSpecificDishesData, saveConfirmedOrder, transmitConfirmationToRestaurant } from "../services/paymentService.js"
import { ConfirmedOrder, dishPrice, FinalizeOrderPayload, PaymentConfirmationPayload, PaymentConfirmationResponse } from "../types/payments.js";
import { PresignedUrls } from "../types/s3Clients.js";

export const paymentsRouter = new Hono(); // TODO: Rename this feature from "payment" to "order"

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
    console.log(`✅  Retrieved specific dish data for restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`);

    const totalCostInCents = calculateTotalCost(body.orderSelections, dishItems);
    console.log(`✅  Total cost calculated for restaurantId: ${body.restaurantId}, requestId: ${body.requestId} is ${totalCostInCents} cents`);

    // IN FAIL: I changed the menus for payments because that has more sense, look for possible bugs
    // const s3Key = `menus/${body.restaurantId}/${body.requestId}.webp`;  /// This shape could be useful when we use "S3 ObjectCreated event"
    const s3Key = `payments/${body.restaurantId}/${body.requestId}.webp`;  /// This shape could be useful when we use "S3 ObjectCreated event"

    const paymentImageReferences: PresignedUrls = await obtainPaymentPresignedUrl(s3Key)
    console.log(`✅  Obtained presigned URLs for restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`);
    console.log(`🔎🔎  Presigned URLs: ${JSON.stringify(paymentImageReferences)}`);

    const now = Date.now()
    const newConfirmationEvent: ConfirmedOrder = {
      totalCostInCents: totalCostInCents,
      // lastUpdateTimestamp: now,
      onPaidTimeStamp: now,
      paymentImageUrl: paymentImageReferences.publicUrl,
      ...body
    }

    await saveConfirmedOrder(newConfirmationEvent)
    console.log(`✅  Order confirmed and saved for restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`)

    await transmitConfirmationToRestaurant(newConfirmationEvent)
    console.log(`✅  Confirmation transmitted to restaurantId: ${body.restaurantId}, requestId: ${body.requestId}`)

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

   const mappedPayloads = await obtainAllActiveOrders(rid)
   console.log(`🔎🔎  Mapped payloads for restaurantId: ${rid}: ${JSON.stringify(mappedPayloads)}`);
   console.log(`✅  Fetched active orders for restaurantId: ${rid}`);

    return c.json(mappedPayloads, 200);
  } catch (error: any) {
    console.error(`🚨 FETCH PAYMENT PRESELECTIONS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});



paymentsRouter.post("/finalize", async (c) => {
  try{
    const body: FinalizeOrderPayload = await c.req.json().catch(() => ({}));  /// What of these IDs go in the URL?  /// Should I include it inside the try that is bellow?

    // TODO: Ensure that the time of arrival happened. So the restaurant doesn't finalize it before the customer arrives.

    await finalizeOrder(body.restaurantId, body.orderId)
    console.log(`✅  Order finalized for restaurantId: ${body.restaurantId}, orderId: ${body.orderId}`);

    return c.json({ message: "Order finalized successfully" }, 200);
  } catch (e: any) {
    console.error(`🚨 FINALIZE ORDER ERROR: ${e.message}`);
    return c.json({ error: e.message || "Internal Server Error" }, 500);
  }

})