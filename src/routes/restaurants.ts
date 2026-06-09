import { Hono } from "hono";
import { QueryCommand, BatchGetCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "../aws/clientFactory.js";

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
restaurantsRouter.get("/feed", async (c) => {
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
