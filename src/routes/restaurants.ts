import { Hono } from "hono";
import { QueryCommand, BatchGetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";

// 🔌 Wrap standard client for clean, automated JSON marshalling
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = "YummiziTable";
const BUCKET_NAME = "restaurant-assets";

// 📦 Create an isolated sub-router specifically for restaurant data processing
export const restaurantsRouter = new Hono();

/**
 * 🛰️ ROUTE: Retrieve the personalized user restaurant feed
 * PATH: GET /restaurants/feed
 */
restaurantsRouter.get("/feed", async (c) => { /// Maybe it's better to move this to a new file called "restaurants" and rename this current file to "menu" 
  try {
    // 1. Get User ID from Query Params (?userId=...)
    const userId = c.req.query("userId");
    
    if (!userId) {
      return c.json({ error: "Missing userId" }, 400);
    }

    // 🗺️ DYNAMIC S3 RESOLUTION: Switches seamlessly between LocalStack and AWS Cloud grids
    // const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
    // const s3BaseUrl = isLocal 
    //   ? `http://localhost:4566/${BUCKET_NAME}`
    //   : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;

    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

    // 2. STEP 1: Find the Section relation pointer records (SEC# rows)
    const feedLinksResponse = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `USER#${userId}`,
        ":skPrefix": "SEC#",
      }
    }));

    const feedLinks = feedLinksResponse.Items || [];

    if (feedLinks.length === 0) {
      return c.json([], 200);
    }

    // 3. STEP 2: Hydrate keys to prep for BatchGet
    const restaurantKeys: Record<string, string>[] = [];
    const sectionMap: Record<string, string> = {}; // Remembers relationship groupings

    for (const link of feedLinks) {
      const parts = link.SK.split("#"); // ["SEC", "Popular", "UUID"]
      const sectionName = parts[1];
      const rid = parts[2];

      restaurantKeys.push({ PK: `REST#${rid}`, SK: "METADATA" });
      sectionMap[rid] = sectionName;
    }

    // ⚡ Execute High-Speed Batch Read against DynamoDB Grid Core
    const batchResponse = await docClient.send(new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: {
          Keys: restaurantKeys
        }
      }
    }));

    const rawRestaurants = batchResponse.Responses?.[TABLE_NAME] || [];

    // 4. STEP 3: Format output layout matching your Kotlin mobile app Data Transfer Objects
    const formattedFeed = rawRestaurants.map((res: any) => {
      const rid = res.PK.replace("REST#", "");
      const originalDishes = res.dishesToShow || [];

      return {
        id: rid,
        name: res.name,
        logoUrl: `${s3BaseUrl}/${res.logoUrl || ""}`,
        sectionType: sectionMap[rid] || "General",
        dishesToShowUrls: originalDishes.map((img: string) => `${s3BaseUrl}/${img}`)
      };
    });

    console.log(`✅🏪 Personalized feed items fetched and formatted for User: ${userId}\n`);
    console.log(`A sample of data is\n ${formattedFeed[0]}\n`);
    
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

    // 🗺️ DYNAMIC S3 RESOLUTION: Matches development environments vs production targets
    // const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
    // const s3BaseUrl = isLocal 
    //   ? `http://localhost:4566/${BUCKET_NAME}`
    //   : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;

    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

    // ⚡ SINGLE-TABLE QUERY: Grabs both Dishes and Menu details in 1 fast DB request
    const response = await docClient.send(new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${rid}`,
        ":skPrefix": "RESOURCE#",
      }
    }));

    const items = response.Items || [];
    
    const menuPages: any[] = [];
    const dishes: any[] = [];

    // Parse and split rows based on sub-keys
    for (const item of items) {
      const sk: string = item.SK || "";

      if (sk.startsWith("RESOURCE#MENU#")) {
        menuPages.push({
          pageId: sk.replace("RESOURCE#MENU#", ""),
          imageUrl: `${s3BaseUrl}/${item.imageUrl || ""}`,
          pageNumber: Number(item.pageNumber || 0)  /// Check if sending it to page 0 is ok in case of fail
        });
      } else if (sk.startsWith("RESOURCE#DISH#")) {
        if ((item.priceCents??null)!==null && (item.prepTime??null)!==null){
          dishes.push({
            id: sk.replace("RESOURCE#DISH#", ""),
            name: item.dishName,
            imageUrl: `${s3BaseUrl}/${item.dishImageUrl || ""}`,
            priceCents: Number(item.priceCents),
            prepTime: Number(item.prepTime),
            isOutOfStock: Boolean(item.isOutOfStock || false),
            menuPageId: item.menuPageId,
            coordinateXInMenu: item.coordinateXInMenu,
            coordinateYInMenu: item.coordinateYInMenu,
            description: item.description || ""
          });
        } else{
          console.log(`🚨  There was an issue with the price or preparation time of ${sk.replace("RESOURCE#DISH#", "")} | Fallback: pin is not sent`);
        }
      }
    }

    // Sort menu pages sequentially by page index number
    menuPages.sort((a, b) => a.pageNumber - b.pageNumber);

    console.log(`✅📃 Menu info attached and mapped for Restaurant ID: ${rid}`);

    return c.json({
      menuPages,
      dishes
    }, 200);

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
    const body = await c.req.json().catch(() => ({}));
    const menuPages = body.menuPages || [];
    const dishes = body.dishes || [];

    // This array will assemble all atomic actions for the single-table transaction block
    const transactionItems: any[] = [];

    // 📃 PROCESS MENU PAGES
    for (const page of menuPages) {
      const pageId = page.pageId;
      const action = page.action; // Expects "save" (create/update) or "delete"
      const sk = `RESOURCE#MENU#${pageId}`;

      if (action === "delete") {
        transactionItems.push({
          Delete: {
            TableName: TABLE_NAME,
            Key: { PK: `REST#${rid}`, SK: sk }
          }
        });
      } else if (action === "save") {
        transactionItems.push({
          Put: {
            TableName: TABLE_NAME,
            Item: {
              PK: `REST#${rid}`,
              SK: sk,
              pageNumber: Number(page.pageNumber || 0),
              /**
                        * 💡 HINT FOR SIGNED URL TRANSITION:
                        * For now, we take the raw imageUrl. When migrating to pre-signed URLs, 
                        * strip the S3 domain/base path and store ONLY the S3 object key string here
                        * (e.g., page.imageUrl -> "restaurants/uuid/menus/page1.jpg").
                        */
              imageUrl: page.imageUrl
            }
          }
        });
      }
      else if (action === "update") {
        transactionItems.push({
          Update: {
            TableName: TABLE_NAME,
            Key: { 
              PK: `REST#${rid}`, 
              SK: sk 
            },
            // 📝 UpdateExpression targets only the specific fields modified
            UpdateExpression: "SET pageNumber = :pageNumber, imageUrl = :imageUrl",
            ExpressionAttributeValues: {
              ":pageNumber": Number(page.pageNumber || 0),
              ":imageUrl": page.imageUrl
            }
          }
        });
      }
    }

    // 🍔 PROCESS INDIVIDUAL DISHES
    for (const dish of dishes) {
      const dishId = dish.id;
      const action = dish.action; // Expects "save" or "delete"
      const sk = `RESOURCE#DISH#${dishId}`;

      if (action === "delete") {
        transactionItems.push({
          Delete: {
            TableName: TABLE_NAME,
            Key: { PK: `REST#${rid}`, SK: sk }
          }
        });
      } else if (action === "save") { //TODO: Include a "update" condition. That includes code a diff logic in the client side.
        transactionItems.push({
          Put: {
            TableName: TABLE_NAME,
            Item: {
              PK: `REST#${rid}`,
              SK: sk,
              dishName: dish.name,
              priceCents: Number(dish.priceCents || 0),
              prepTime: Number(dish.prepTime || 0),
              isOutOfStock: false, // Per request constraint: always false for now
              menuPageId: dish.menuPageId,
              coordinateXInMenu: dish.coordinateXInMenu,
              coordinateYInMenu: dish.coordinateYInMenu,
              description: dish.description,
              /**
              * 💡 HINT FOR SIGNED URL TRANSITION:
              * Strip down full path URLs to save only the relative storage object key identifiers
              * when moving to signed asset validation loops.
              */
              dishImageUrl: dish.imageUrl
            }
          }
        });
      }
      else if (action === "update") {
        transactionItems.push({
          Update: {
            TableName: TABLE_NAME,
            Key: { 
              PK: `REST#${rid}`, 
              SK: sk 
            },
            // ⚡ Granular update mapping every editable attribute without overwriting keys
            UpdateExpression: `SET dishName = :name, 
                                  priceCents = :price, 
                                  prepTime = :prep, 
                                  menuPageId = :menuPageId, 
                                  coordinateXInMenu = :x, 
                                  coordinateYInMenu = :y, 
                                  description = :desc,
                                  dishImageUrl = :img`,
            ExpressionAttributeValues: {
              ":name": dish.name,
              ":price": Number(dish.priceCents || 0),
              ":prep": Number(dish.prepTime || 0),
              ":menuPageId": dish.menuPageId,
              ":x": dish.coordinateXInMenu,
              ":y": dish.coordinateYInMenu,
              ":desc": dish.description,
              ":img": dish.imageUrl
            }
          }
        });
      }
    }

    // Edge case: If client sent an empty mutation array package
    if (transactionItems.length === 0) {
      return c.json({ message: "No menu or dish mutations provided." }, 200);
    }

    // 🛑 Guard against DynamoDB structural limits
    if (transactionItems.length > 100) {
      return c.json({ error: "Transaction block exceeds AWS limit of 100 items." }, 400);
    }

    // ⚡ Execute all operations atomically in 1 single network trip
    await docClient.send(new TransactWriteCommand({
      TransactItems: transactionItems
    }));

    console.log(`✅ TransactWrite completed: Synchronized menu states for Restaurant: ${rid}`);
    return c.json({ message: "Menu state successfully synchronized atomically" }, 200);

  } catch (error: any) {
    console.error(`🚨 SYNC MENU ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});