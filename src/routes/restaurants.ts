import { Hono } from "hono";
import { QueryCommand, BatchGetCommand, GetCommand, DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient, getS3Client } from "../aws/clientFactory.js";
import { TransactWriteCommand } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3"; // 📦 Native S3 actions
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // 🔑 Presign signing engines
import { RestaurantDataToUpdate } from "../types/restaurantTypes.js";

// Initialize the S3 Client engine instance
const s3Client = getS3Client();

// FIXME: Use the time fixer for all the routers
// const serverDate = new Date()
  
//   // Formats the server's UTC time to Peru local time (PET)
//   const peruTime = serverDate.toLocaleString("es-PE", { 
//     timeZone: "America/Lima",
//     dateStyle: "short",
//     timeStyle: "medium"
//   })

//TODO: Change the URLs by keys, the entire link shouldn't be sent

// 📦 Define your structural types matching client DTO definitions
export interface PresignedUrlMapping {  // TODO: Move to interfaces
  pageId: string;
  uploadUrl: string; // Temporary token URL for client PUT request
  publicUrl: string; // The permanent public read URL saved in DB
}

export interface SyncDataFirstResponse {
  message: string;
  presignedUrls: PresignedUrlMapping[];
}


// 🔌 Wrap standard client for clean, automated JSON marshalling
const docClient = DynamoDBDocumentClient.from(getDynamoDBClient(), {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = "YummiziTable";
const BUCKET_NAME = "restaurant-assets";

// 📦 Create an isolated sub-router specifically for restaurant data processing
export const restaurantsRouter = new Hono();

restaurantsRouter.post("/:restaurantId/create", async (c) => {
  // TODO: Here the restaurant is initialized with the default values when the restaurant register
})

restaurantsRouter.get("/:restaurantId/info", async (c) => {
  try{
    const restaurantId = c.req.param("restaurantId");

     if (!restaurantId) {
      return c.json({ error: `Missing restaurantId ${restaurantId}` }, 400);
     }

    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

    const command = new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `REST#${restaurantId}`,
        SK: 'METADATA'
      },
      // Set to true only if you strictly need the absolute latest write
      ConsistentRead: false 
    })
    const response = await docClient.send(command)

    if (!response.Item) {
      return c.json({ error: 'Item not found' }, 404)
    }

    const restaurantItem = response.Item

    console.log(`🔎🏪  Restaurant info fetched for ID: ${restaurantId}\n`, restaurantItem)

    return c.json(
      {
        restaurantId: restaurantItem.PK.replace('REST#', ''),
        restaurantName: restaurantItem.name,
        logoUrl: restaurantItem.logoUrl,
        latitude: restaurantItem.latitude,
        // longitude: restaurantItem.longitude,
        // openTime: restaurantItem.openTime,
        closeTime: restaurantItem.closeTime,
        dishesToShowUrls: [restaurantItem.dishesToShowUrl1, restaurantItem.dishesToShowUrl2, restaurantItem.dishesToShowUrl3],
        phoneNumberToPay: restaurantItem.phoneNumberToPay,
        phoneNumberToContact: restaurantItem.phoneNumberToContact,
        paymentQrUrl: restaurantItem.paymentQrUrl,
      }
    )

  }
  catch(error: any){
    return c.json({ error: 'Internal Server Error', details: error.message }, 500)
  }
});

// TODO: It really needs the improvement of modularize the presigned URL obtaining
// TODO: Optimize it with the dynamic attribute selection logic 
restaurantsRouter.post("/:restaurantId/info", async (c) => {  
  try{
    const restaurantId = c.req.param("restaurantId");
    if (!restaurantId) {
      return c.json({ error: "restaurantId is required" }, 400);
    }

    const body = await c.req.json().catch(() => ({}));

    const restaurantName: string = body.restaurantName
    const logoUrlRequired: boolean = body.logoUrlRequired
    const latitude: number = body.latitude
    const longitude: number = body.longitude
    const dishesToShowUrlsRequired: [boolean, boolean, boolean] = body.dishesToShowUrlsRequired
    const phoneNumberToPay: string = body.phoneNumberToPay
    const phoneNumberToContact: string = body.phoneNumberToContact
    const paymentQrUrlsRequired: boolean = body.paymentQrUrlsRequired

    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

    console.log(`🔎🏪  Restaurant info received for ID: ${restaurantId}\n`, JSON.stringify(body , null, 2))

    const dataToUpdate: RestaurantDataToUpdate = {      
      name: restaurantName,
      latitude: latitude,
      longitude: longitude,
      // openTime: openTime,
      // closeTime: closeTime,
      phoneNumberToPay: phoneNumberToPay,
      phoneNumberToContact: phoneNumberToContact
    }

    
    let logoUploadUrl
    if(logoUrlRequired){

      // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
    const logoS3Key = `logo/${restaurantId}.webp`;
    
    // 🕒 CACHE BUSTING: Generate a standard Unix epoch timestamp (in seconds)
    const logoUnixEpoch = Math.floor(Date.now() / 1000);

    // 🎯 COMBINED SOLUTION: The database saves the static path + the dynamic timestamp version parameter
    const logoPublicUrl = `${s3BaseUrl}/${logoS3Key}?v=${logoUnixEpoch}`;
    console.log('🔎🖼️  Logo public Url', logoPublicUrl)
      
      // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
      logoUploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: logoS3Key,
          ContentType: "image/webp" // Enforces binary media type constraints
        }),
        { expiresIn: 900 } // URL token token expires safely in 15 minutes
      );

      dataToUpdate.logoUrl = logoPublicUrl

      console.log('✅🖼️  Logo upload Url')
    }
    else{
      logoUploadUrl = ''
    }

    const dishImageSelection = [
      (dishImageUrl: string) => {dataToUpdate.dishesToShowUrl1 = dishImageUrl},
      (dishImageUrl: string) => {dataToUpdate.dishesToShowUrl2 = dishImageUrl},
      (dishImageUrl: string) => {dataToUpdate.dishesToShowUrl3 = dishImageUrl},
    ]

    const dishesToUploadShowUrls = new Array<String>(3)
    for (let i = 0; i < 3; i++) {
      
      if (dishesToShowUrlsRequired[i] === true) {
        
        // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
        const s3Key = `front/${i}/${restaurantId}.webp`;
        
        // 🕒 CACHE BUSTING: Generate a standard Unix epoch timestamp (in seconds)
        const unixEpoch = Math.floor(Date.now() / 1000);
  
        // 🎯 COMBINED SOLUTION: The database saves the static path + the dynamic timestamp version parameter
        const dishImagePublicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`;
        console.log(`🔎🖼️  dish ${i} to show image public Url`, dishImagePublicUrl)
  
        dishImageSelection[i](dishImagePublicUrl)

        // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
        const dishImageUploadUrl = await getSignedUrl(
          s3Client,
          new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: s3Key,
            ContentType: "image/webp" // Enforces binary media type constraints
          }),
          { expiresIn: 900 } // URL token token expires safely in 15 minutes
        );

        dishesToUploadShowUrls[i] = dishImageUploadUrl

      console.log('✅🖼️  Dish image upload Url')
      }
      else{
        dishesToUploadShowUrls[i] = ''
      }
    }

    
    let QrUploadUrl
    if(paymentQrUrlsRequired){
      
      // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
      const qrS3Key = `qr/${restaurantId}.webp`;
      
      // 🕒 CACHE BUSTING: Generate a standard Unix epoch timestamp (in seconds)
      const qrUnixEpoch = Math.floor(Date.now() / 1000);
  
      // 🎯 COMBINED SOLUTION: The database saves the static path + the dynamic timestamp version parameter
      const QrPublicUrl = `${s3BaseUrl}/${qrS3Key}?v=${qrUnixEpoch}`;
      console.log('🔎🖼️  QR public Url', QrPublicUrl)

      dataToUpdate.paymentQrUrl = QrPublicUrl

      // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
      QrUploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: qrS3Key,
          ContentType: "image/webp" // Enforces binary media type constraints
        }),
        { expiresIn: 900 } // URL token token expires safely in 15 minutes
      );

      console.log('✅🖼️  QR upload Url')
    }
    else{
      QrUploadUrl = ''
    }

    const updateEntries = Object.entries(dataToUpdate).filter(([, value]) => value !== undefined);  /// What is cheaper between doing this and read the data from dynamoDB previously?
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, string | number> = {};
    const updateExpressions = updateEntries.map(([field, value], index) => {
      const nameToken = `#field${index}`;
      const valueToken = `:value${index}`;

      expressionAttributeNames[nameToken] = field;
      expressionAttributeValues[valueToken] = value;
      return `${nameToken} = ${valueToken}`;
    });

    if (updateExpressions.length > 0) {
      await docClient.send(new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
          PK: `REST#${restaurantId}`,
          SK: "METADATA",
        },
        UpdateExpression: `SET ${updateExpressions.join(", ")}`,
        ExpressionAttributeNames: expressionAttributeNames,
        ExpressionAttributeValues: expressionAttributeValues,
      }));
    }

    console.log(`✅⤴️ Synchronized restaurant info: ${restaurantId}`);
    return c.json({
      logoPresignedUrl: logoUploadUrl,
      dishesToShowPresignedUrls: dishesToUploadShowUrls,
      paymentQrPresignedUrl: QrUploadUrl,
    }, 200);

  }
  catch(error: any){
    console.error(`🚨 SYNC RESTAURANT INFO ERROR -> ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});


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
          Keys: restaurantKeys,
          // ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB) /// FIXME: Necessary here? // Consistent read is used when the read is just after a writting
        }
      }
    }));

    const rawRestaurants = batchResponse.Responses?.[TABLE_NAME] || [];

    // 4. STEP 3: Format output layout matching your Kotlin mobile app Data Transfer Objects
    const formattedFeed = rawRestaurants.map((res: any) => {
      const rid = res.PK.replace("REST#", "");
      const originalDishes = [res.dishesToShow1 || '', res.dishesToShow2 || '', res.dishesToShow3 || ''];

      return {
        id: rid,
        name: res.name,
        logoUrl: res.logoUrl || "",
        sectionType: sectionMap[rid] || "General",
        dishesToShowUrls: originalDishes
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
          imageUrl: item.imageUrl || "",
          pageNumber: Number(item.pageNumber || 0)  /// Check if sending it to page 0 is ok in case of fail
        });
      } else if (sk.startsWith("RESOURCE#DISH#")) {
        if ((item.priceCents??null)!==null && (item.prepTime??null)!==null){
          dishes.push({
            id: sk.replace("RESOURCE#DISH#", ""),
            name: item.dishName,
            imageUrl: item.dishImageUrl || "",
            priceCents: Number(item.priceCents),  /// Does it work without "Number" parser?
            prepTime: Number(item.prepTime),
            isOutOfStock: Boolean(item.isOutOfStock || false),
            menuPageId: item.menuPageId,
            coordinateXInMenu: item.coordinateXInMenu,
            coordinateYInMenu: item.coordinateYInMenu,
            createdAt: item.createdAt,
            description: item.description || ""
          });
        } else{
          console.log(`🚨  There was an issue with the price or preparation time of ${sk.replace("RESOURCE#DISH#", "")} | Fallback: pin is not sent`);
          //TODO: Include a response's attribute that says what and why certain dishes were not saved remotely (Use a small "code" of the why to reduce the payload weight)
        }
      }
    }

    // Sort menu pages sequentially by page index number
    menuPages.sort((a, b) => a.pageNumber - b.pageNumber);

    console.log(`🔎📃  Menu info attached and mapped for Restaurant ID:\n${rid}`);

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

    console.log('🍽️  dishes to update\n', dishes)

    // This array will assemble all atomic actions for the single-table transaction block
    const transactionItems: any[] = [];

    const presignedUrls: PresignedUrlMapping[] = [];

    // Resolve structural patterns targeting local environments vs live AWS
    // const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
    // const s3BaseUrl = isLocal 
    //   ? `http://localhost:4566/${BUCKET_NAME}`
    //   : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;
    const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

    console.log(`🔎📃  Pages received:\n${JSON.stringify(menuPages, null, 2)}`);

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
      } else if (action === "save" || action === "update") {  //TODO: Add checking to avoid to images with the same page number 
        // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
        // const s3Key = `restaurants/${rid}/menus/${pageId}.webp`;
        const s3Key = `menus/${pageId}.webp`;

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

        console.log('🔎  uploadUrl', uploadUrl)

        // Map token configurations to match your "SyncDataFirstResponse" response payload design
        presignedUrls.push({
          pageId,
          uploadUrl,
          publicUrl
        });

        if (action === "save") {
          transactionItems.push({
            Put: {
              TableName: TABLE_NAME,
              Item: {
                PK: `REST#${rid}`,
                SK: sk,
                pageNumber: Number(page.pageNumber || 0), /// Take care with that "0"
                imageUrl: publicUrl // 🎯 Overwritten with the final public reading URL string destination
              }
            }
          });
        } 
        else if (action === "update") {

          // 🧠 DYNAMIC COMPILER ENGINE
          // Map client field names to their specific DynamoDB attribute counterparts
          const fieldMapping: Record<string, string> = {
            imageUrl: "imageUrl",
            pageNumber: "pageNumber"
          };

          // Extract the target payload block (checks flat attributes first, falls back to an inner updatedFields map if structured that way)
          const payloadSource = page.updatedFields;

          const expressions: string[] = [];
          const expressionAttributeValues: Record<string, any> = {};

          // Only add things to the update execution parameters if the client explicitly sent them
          for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
            if (payloadSource[clientKey] !== undefined) {
              expressions.push(`${dbField} = :${clientKey}`);
              
              // Ensure proper numeric cast primitives for numbers
              if (["pageNumber"].includes(clientKey)) {
                expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
              }
              else if (clientKey === "imageUrl"){
                expressionAttributeValues[`:${clientKey}`] = publicUrl;
              }
              else {
                expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
              }
            }
          }

          if (expressions.length > 0) {
          transactionItems.push({
            Update: {
              TableName: TABLE_NAME,
              Key: { PK: `REST#${rid}`, SK: sk },
              UpdateExpression: `SET ${expressions.join(", ")}`,
              ExpressionAttributeValues: expressionAttributeValues
            }
          });
        }
        }
      }
    }

    // 🍔 PROCESS INDIVIDUAL DISHES
    for (const dish of dishes) {  // Dishes from client
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
            Item: { // Shape of what is going to be sent
              PK: `REST#${rid}`,
              SK: sk,
              dishName: dish.name,
              priceCents: Number(dish.priceCents || 0),
              prepTime: Number(dish.prepTime || 0),
              isOutOfStock: dish.isOutOfStock,
              menuPageId: dish.menuPageId,
              coordinateXInMenu: dish.coordinateXInMenu,
              coordinateYInMenu: dish.coordinateYInMenu,
              description: dish.description,
              /**
              * 💡 HINT FOR SIGNED URL TRANSITION:
              * Strip down full path URLs to save only the relative storage object key identifiers
              * when moving to signed asset validation loops.
              */
              imageUrl: dish.imageUrl
            }
          }
        });
      }
      else if (action === "update") {
        // 🧠 DYNAMIC COMPILER ENGINE
        // Map client field names to their specific DynamoDB attribute counterparts
        const fieldMapping: Record<string, string> = {
          name: "dishName",
          priceCents: "priceCents",
          prepTime: "prepTime",
          menuPageId: "menuPageId",
          coordinateXInMenu: "coordinateXInMenu",
          coordinateYInMenu: "coordinateYInMenu",
          description: "description",
          isOutOfStock: "isOutOfStock",
          imageUrl: "imageUrl"
        };

        // Extract the target payload block (checks flat attributes first, falls back to an inner updatedFields map if structured that way)
        const payloadSource = dish.updatedFields;

        const expressions: string[] = [];
        const expressionAttributeValues: Record<string, any> = {};

        // Only add things to the update execution parameters if the client explicitly sent them
        for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
          if (payloadSource[clientKey] !== undefined) {
            expressions.push(`${dbField} = :${clientKey}`);
            
            // Ensure proper numeric cast primitives for numbers
            if (["priceCents", "prepTime", "coordinateXInMenu", "coordinateYInMenu"].includes(clientKey)) { // TODO: Consider that it could be handled with "typeof"
              expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
            } 
            else if (clientKey === "isOutOfStock"){
              expressionAttributeValues[`:${clientKey}`] = Boolean(payloadSource[clientKey]);
            }        
            else {
              expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
            }
          }
        }

        // Safety check: Avoid throwing errors if an update call was fired with an empty change block
        if (expressions.length > 0) {
          transactionItems.push({
            Update: {
              TableName: TABLE_NAME,
              Key: { PK: `REST#${rid}`, SK: sk },
              UpdateExpression: `SET ${expressions.join(", ")}`,
              ExpressionAttributeValues: expressionAttributeValues
            }
          });
        }
      }
    }

    console.log(`🔎📃  Data to be transacted:\n${JSON.stringify(transactionItems, null, 2)}`);

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

    // 🎯 OUTPUT: Enforce formatting structure to output "SyncDataFirstResponse"
    const responsePayload: SyncDataFirstResponse = {
      message: "Menu state successfully synchronized atomically",
      presignedUrls
    };

    console.log(`✅⤴️ TransactWrite completed: Synchronized menu states for Restaurant: ${rid}`);
    return c.json(responsePayload, 200);

  } catch (error: any) {
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

    // if (rid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(rid)) {  /// Here an example of ID shape validation
    //   return c.json({ error: "Invalid restaurantId" }, 400);
    // }

    const response = await docClient.send(new GetCommand({
      TableName: TABLE_NAME,
      Key: {
        PK: `REST#${rid}`,
        SK: "METADATA",
      },
      ConsistentRead: false,
      ProjectionExpression: "phoneNumberToPay, phoneNumberToContact, paymentQrUrl",
    }));

    const metadata = response.Item;

    if (!metadata) {
      return c.json({ error: "🚩 Restaurant payment metadata not found" }, 404);
    }

    const phoneNumberToPay = Number(metadata.phoneNumberToPay);
    const phoneNumberToContact = Number(metadata.phoneNumberToContact);
    const paymentQrUrl = typeof metadata.paymentQrUrl === "string" ? metadata.paymentQrUrl : "";

    // if ( /// Here an example of integer protection
    //   !Number.isSafeInteger(phoneNumberToPay) ||
    //   !Number.isSafeInteger(phoneNumberToContact) ||
    //   paymentQrUrl.length === 0
    // ) {
    //   console.error(`🚨 PAYMENT METADATA INVALID: ${rid}`);
    //   return c.json({ error: "Restaurant payment metadata is invalid" }, 500);
    // }

    return c.json({
      phoneNumberToPay,
      phoneNumberToContact,
      paymentQrUrl,
    }, 200);
  } catch (error: any) {
    console.error(`🚨 RESTAURANT PAYMENT ROUTE ERROR: ${error.message}`);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});
