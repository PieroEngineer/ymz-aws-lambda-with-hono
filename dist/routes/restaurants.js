"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.restaurantsRouter = void 0;
const hono_1 = require("hono");
const lib_dynamodb_1 = require("@aws-sdk/lib-dynamodb");
const clientFactory_js_1 = require("../aws/clientFactory.js");
// 🔌 Wrap standard client for clean, automated JSON marshalling
const docClient = lib_dynamodb_1.DynamoDBDocumentClient.from((0, clientFactory_js_1.getDynamoDBClient)(), {
    marshallOptions: { removeUndefinedValues: true },
});
const TABLE_NAME = "YummiziTable";
const BUCKET_NAME = "restaurant-assets";
// 📦 Create an isolated sub-router specifically for restaurant data processing
exports.restaurantsRouter = new hono_1.Hono();
/**
 * 🛰️ ROUTE: Retrieve the personalized user restaurant feed
 * PATH: GET /restaurants/feed
 */
exports.restaurantsRouter.get("/feed", async (c) => {
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
        const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`;
        console.log(`🪣  Current Bucket ${s3BaseUrl}\n`);
        // 2. STEP 1: Find the Section relation pointer records (SEC# rows)
        const feedLinksResponse = await docClient.send(new lib_dynamodb_1.QueryCommand({
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
        const restaurantKeys = [];
        const sectionMap = {}; // Remembers relationship groupings
        for (const link of feedLinks) {
            const parts = link.SK.split("#"); // ["SEC", "Popular", "UUID"]
            const sectionName = parts[1];
            const rid = parts[2];
            restaurantKeys.push({ PK: `REST#${rid}`, SK: "METADATA" });
            sectionMap[rid] = sectionName;
        }
        // ⚡ Execute High-Speed Batch Read against DynamoDB Grid Core
        const batchResponse = await docClient.send(new lib_dynamodb_1.BatchGetCommand({
            RequestItems: {
                [TABLE_NAME]: {
                    Keys: restaurantKeys
                }
            }
        }));
        const rawRestaurants = batchResponse.Responses?.[TABLE_NAME] || [];
        // 4. STEP 3: Format output layout matching your Kotlin mobile app Data Transfer Objects
        const formattedFeed = rawRestaurants.map((res) => {
            const rid = res.PK.replace("REST#", "");
            const originalDishes = res.dishesToShow || [];
            return {
                id: rid,
                name: res.name,
                logoUrl: `${s3BaseUrl}/${res.logoUrl || ""}`,
                sectionType: sectionMap[rid] || "General",
                dishesToShowUrls: originalDishes.map((img) => `${s3BaseUrl}/${img}`)
            };
        });
        console.log(`✅🏪 Personalized feed items fetched and formatted for User: ${userId}\n`);
        console.log(`A sample of data is\n ${formattedFeed[0]}\n`);
        return c.json(formattedFeed, 200);
    }
    catch (error) {
        console.error(`🚨 FEED ROUTE ERROR: ${error.message}`);
        return c.json({ error: "Internal Server Error" }, 500);
    }
});
