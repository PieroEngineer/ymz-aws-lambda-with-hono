import { Hono } from "hono";
import {
    initializeRestaurantInfo,
    obtainTemporalPersonalizedFeed,
    obtainRestaurantInfo,
    obtainRestaurantMenu,
    obtainRestaurantPaymentInfo,
    synchronizeRestaurantMenu,
    updateRestaurantInfo,
} from "../services/restaurantService.js";
import {
    MenuSyncPayload,
    RestaurantInitializePayload,
    RestaurantUpdatePayload,
    SyncDataFirstResponse,
} from "../types/restaurants.js";


//TODO: Change the URLs by keys, the entire link shouldn't be sent

// 📦 Create an isolated sub-router specifically for restaurant data processing
export const restaurantsRouter = new Hono();  // TODO: Consider divide this router between "restuarants" and "Menu"

restaurantsRouter.post("/:restaurantId/info/initialize", async (c) => {
  // TODO: Here the restaurant is initialized with the default values when the restaurant register
  try {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId) {
      return c.json({ error: "restaurantId is required" }, 400);
    }

    const body: RestaurantInitializePayload = await c.req.json().catch(() => ({}));

    const initializeResponse = await initializeRestaurantInfo(restaurantId, body);

    return c.json(initializeResponse, 200);

  }
  catch (error: any) {
    console.error(`🚨 RESTAURANT RESTAURANT INFO ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }

});

restaurantsRouter.get("/:restaurantId/info", async (c) => {
  console.log( `🔎✅ Fetching restaurant info for restaurantId` );
  try {
    const restaurantId = c.req.param("restaurantId");

    if (!restaurantId) {
      return c.json({ error: `Missing restaurantId ${restaurantId}` }, 400);
    }

    const restaurantInfo = await obtainRestaurantInfo(restaurantId);

    return c.json(restaurantInfo);

  }
  catch (error: any) {
    return c.json({ error: 'Internal Server Error', details: error.message }, 500);
  }
});

// TODO: It really needs the improvement of modularize the presigned URL obtaining
// TODO: Optimize it with the dynamic attribute selection logic 
// TODO: Change "post" for patch and use the same endpoint of the other "POST" because this is going to be to update and the other one to initialize
restaurantsRouter.post("/:restaurantId/info/update", async (c) => {
  try {
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId) {
      return c.json({ error: "restaurantId is required" }, 400);
    }

    const body: RestaurantUpdatePayload = await c.req.json().catch(() => ({}));

    const updateResponse = await updateRestaurantInfo(restaurantId, body);

    return c.json(updateResponse, 200);

  }
  catch (error: any) {
    console.error(`🚨 UPDATE RESTAURANT INFO ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});


/**
 * 🛰️ ROUTE: Retrieve the personalized user restaurant feed
 * PATH: GET /restaurants/feed
 */
// TODO: Optimize it
restaurantsRouter.get("/feed", async (c) => { /// Maybe it's better to move this to a new file called "restaurants" and rename this current file to "menu" 
  try {
    // 1. Get User ID from Query Params (?userId=...)
    const userId = c.req.query("userId");

    if (!userId) {
      console.log(`🔴🔎😌 User ID was not fown: ${userId}`);
      return c.json({ error: "Missing userId" }, 400);
    }

    const formattedFeed = await obtainTemporalPersonalizedFeed(userId);

    return c.json(formattedFeed, 200);

  } catch (error: any) {
    console.error(`🚨 FEED ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});


/**
 * 🛰️ ROUTE: Get full Menu Details (Pages & Dishes) for a specific Restaurant
 * PATH: GET /restaurants/:restaurantId/menu
 */
restaurantsRouter.get("/:restaurantId/menu", async (c) => {
  try {
    const rid = c.req.param("restaurantId");

    if (!rid) {
      return c.json({ error: "restaurantId is required" }, 400);
    }

    const menuResponse = await obtainRestaurantMenu(rid);

    return c.json(menuResponse, 200);

  } catch (error: any) {
    console.error(`🚨 MENU ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

/**
 * 🛰️ ROUTE: Synchronize full Menu Pages and Dishes updates atomically
 * PATH: POST /restaurants/:restaurantId/menu
 */
restaurantsRouter.post("/:restaurantId/menu", async (c) => {
  try {
    const rid = c.req.param("restaurantId");
    if (!rid) {
      return c.json({ error: "restaurantId is required" }, 400);
    }

    // 📩 Parse the synchronization delta payload from the client body
    const body: MenuSyncPayload = await c.req.json().catch(() => ({}));

    const syncResult = await synchronizeRestaurantMenu(rid, body);

    if ("presignedUrls" in syncResult) {
      return c.json(syncResult as SyncDataFirstResponse, 200);
    }

    return c.json(syncResult, 200);

  } catch (error: any) {
    if (error.message === "Transaction block exceeds AWS limit of 100 items.") {
      return c.json({ error: error.message }, 400);
    }

    console.error(`🚨 SYNC MENU ROUTE ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// Payment info 
restaurantsRouter.get("/:restaurantId/payment", async (c) => {
  try {
    const rid = c.req.param("restaurantId");

    if (!rid) {
      return c.json({ error: "restaurantId is required" }, 400);
    }

    const paymentInfo = await obtainRestaurantPaymentInfo(rid);

    return c.json(paymentInfo, 200);
  } catch (error: any) {
    if (error.message === "🚩 Restaurant payment metadata not found") {
      return c.json({ error: error.message }, 404);
    }

    console.error(`🚨 RESTAURANT PAYMENT ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
