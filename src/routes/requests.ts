import { Hono } from "hono";
import {
    deactivateBatchRequests,
    deactivateRequest,
    obtainActiveRequestStatuses,
    obtainRestaurantActiveRequests,
    saveRequest,
    transmitBatchRequestCancellation,
    transmitRequestCancellation,
    transmitTableRequest,
    updateRequestStatus,
} from "../services/requestService.js";
import {
    ActiveRequestsPayload,
    CreateRequestResponse,
    RequestCancelPayload,
    TableRequestPayload,
    RequestUpdatePayload,
    UpdateRequestResponse,
    BatchCancellationPayload,
} from "../types/requests.js";

// 📦 Create an isolated, modular sub-router for /requests routes
export const requestsRouter = new Hono();



/**
 * 🛰️ ROUTE: Create a new Restaurant Queue / Table Request and Broadcast Event
 * PATH: POST /requests/create
 */
requestsRouter.post("/create", async (c) => {
  try {
    // 📩 Parse input payload safely from Hono context body
    const body: TableRequestPayload = await c.req.json().catch(() => ({}));
    console.log(`🔎📦  Data arrived from restaurant ${body.restaurantId} \n${JSON.stringify(body)}`);

    if (!body.restaurantId || !body.userId || !body.requestId) {   // TODO: The request ID shouldn't be here because the request ID should be generated here in the backend
      return c.json({ error: "Missing restaurantId, userId, or requestId" }, 400);
    }

    console.log(`🔎  Validated request payload for request ${body.requestId}`);

    const requestTime = Date.now();

    const baseRequestInfo = await saveRequest(body, requestTime);  // TODO: Avoid to return this, 
    console.log(`✅📦  Request saved in DynamoDB for restaurant ${body.restaurantId} \n${JSON.stringify(baseRequestInfo)}`);

    const ablyDispatchSuccess = await transmitTableRequest(body, requestTime);
    console.log(`✅📡  Ably dispatch success: ${ablyDispatchSuccess} for restaurant ${body.restaurantId}`);

    const createRequestResponse: CreateRequestResponse = {
      message: "Request created successfully and broadcast state synchronized",
      requestId: body.requestId,
      realtimeNotified: ablyDispatchSuccess
    };

    // 🎉 5. Success response utilizing Hono native JSON encoder
    return c.json(createRequestResponse, 201);

  } catch (error: any) {
    console.error(`🚨 CREATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

/**
 * 🛰️ ROUTE: Cancel an existing Queue Request safely
 * PATH: POST /requests/:requestId/cancel
 */
requestsRouter.post("/:requestId/cancel", async (c) => {  /// Perhaps this route has double function in the future; it could cancel and deny
  try {
    // 🗺️ Extract context routing path variables
    const requestId = c.req.param("requestId");

    const body: RequestCancelPayload = await c.req.json().catch(() => ({}));
    console.log(` Body of the cancellation ${JSON.stringify(body, null, 2)}`);
    // TODO: Later, the "userId" could be reached from dynamoDB because the transition verification will need it anyway

    if (!body.restaurantId) { return c.json({ error: "Missing restaurantId" }, 400); }
    if (!requestId) { return c.json({ error: "Missing requestId" }, 400); }
    if (!body.userId) { return c.json({ error: "Missing userId" }, 400); }

    if (!body.actor) {
      return c.json({ error: "Missing cancellation actor" }, 400);
    }

    // TODO: Create timestamp for this event


    await deactivateRequest(body.restaurantId, requestId);

    await transmitRequestCancellation(body, requestId);

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

requestsRouter.post( "/cancel",async (c) => {
  try{
    const body: BatchCancellationPayload = await c.req.json().catch(() => ({}));

    if (!body.requestsToCancel) {
      return c.json({ error: "Missing cancellations array" }, 400);
    }

    // TODO: Check if the amount of cancellable items is not huge

    await deactivateBatchRequests(body);
    console.log(`✅  Batch cancellation processed successfully`);

    await transmitBatchRequestCancellation(body);
    console.log(`✅  Batch cancellation transmitted successfully`);

    return c.json({
      message: "Batch cancellation processed successfully",
    }, 200);

  }
  catch (error: any) {
    console.error(`🚨 BATCH CANCELLATION ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
})

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

    const mappedPayloads = await obtainRestaurantActiveRequests(rid);

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
    const body: RequestUpdatePayload = await c.req.json().catch(() => ({}));

    /// When you get the request object from DynamoDB, it's possible or necessary you could get the userID from there and not from the restaurant's client side 
    /// (#1) if yes, consider if the secure way to get the "userId" and "restaurantId" is via dynamoDB's Query and not from the client 

    console.log(`1️⃣📦  Data arrived from restaurant ${restaurantId} \n${JSON.stringify(body)}`);

    if (!restaurantId || !body.requestId || !body.newState) {
      return c.json({ error: "Missing restaurantId, requestId, or newState" }, 400);
    }

    // TODO: Create timestamp for this event

    const { normalizedState, realtimeNotified } = await updateRequestStatus(restaurantId, body, /*now*/);

    console.log(`🔎  The post of the request update finished`);

    const updateRequestResponse: UpdateRequestResponse = {
      message: "Request state updated successfully",
      restaurantId, // TODO: Are these bellow attributes  necessary?
      requestId: body.requestId,
      newState: normalizedState,
      realtimeNotified,
    };

    return c.json(updateRequestResponse, 200);
  } catch (error: any) {
    console.error(`🚨 UPDATE REQ ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }
});

// TODO: This handler is only for the MVP, it should be replaced or complemented by reading a GSI table in future updates // Idea for the GSI: the SK could be the status of "ACTIVE", "DELETED", etc
requestsRouter.post("/active", async (c) => { /// It's accepted to use POST for get data, but it doesn't matter at all because with GSI, we can use GET normally
// This route will help to the customer to get all its active requests in all restaurants
  try {
    // 📩 Parse input payload safely from Hono context body
    const body: ActiveRequestsPayload = await c.req.json().catch(() => ({}));  /// What of these IDs go in the URL?

    const requestsToUpdate = body.requestsToUpdate;

    // TODO: Cover the situation if it's empty

    const mappedPayloads = await obtainActiveRequestStatuses(requestsToUpdate);

    return c.json({
      statuses: mappedPayloads
    }, 200);
  }
  catch (error: any) {
    console.error(`🚨 FETCH ACTIVE REQS ERROR: ${error.message}`);
    return c.json({ error: error.message || "Internal Server Error" }, 500);
  }

});
