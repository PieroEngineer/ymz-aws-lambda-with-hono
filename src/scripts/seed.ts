import * as fs from "fs";
import * as path from "path";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getS3Client, getDynamoDBClient } from "../aws/clientFactory.js";

/// ⚙️ CONFIGURATION CONSTANTS
const BUCKET_NAME = "restaurant-assets";
const TABLE_NAME = "YummiziTable";
const STATIC_USER_ID = "00000000-0000-4000-a000-000000000000";
const SECTIONS = ["Closest", "Popular", "FriendsFav", "Newest"];

// 🔌 INITIALIZE CLIENTS USING OUR TRAVEL ADAPTER FACTORY
const rawS3 = getS3Client();
const rawDynamo = getDynamoDBClient();

// 🚀 WRAP DYNAMODB CLIENT FOR COMFORTABLE PLAIN-JSON USAGE (Saves us from writing manual marshalling code)
const docClient = DynamoDBDocumentClient.from(rawDynamo, {
  marshallOptions: { removeUndefinedValues: true },
});


// 📦 HELPER: Safe JSON parser imitating Python's read_json
const readJsonFile = (relativeFilePath: string): any => {
  try {
    const absolutePath = path.resolve(relativeFilePath);
    const rawData = fs.readFileSync(absolutePath, "utf-8");
    return JSON.parse(rawData);
  } catch (error) {
    console.error(`🔴 Error processing JSON file at ${relativeFilePath}:`, error);
    process.exit(1);
  }
};


// 🔀 HELPER: Pick random item from array
const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

//🔢 HELPER: Random number generator (inclusive)
const getRandomInt = (min: number, max: number): number => 
  Math.floor(Math.random() * (max - min + 1)) + min;


// 🌱 MAIN DATA SEEDER ENGINE
async function seedData() {
  console.log("🚀 Seeding the Single-Table Cloud (TypeScript Edition)...");

  const visualElements = ["logo", "food", "menu"];
  const sampleImagesMap: Record<string, string> = {};

  // 📂 1. MAP LOCAL MOCKUP IMAGES TO S3 PATHS
  for (const element of visualElements) {
    // Matches your original relative local directory structures
    const localFolder = path.join("my_images", `mockup_${element}_images`);
    
    if (fs.existsSync(localFolder)) {
      const files = fs.readdirSync(localFolder);
      for (const filename of files) {
        const cloudPath = `${element}s/${filename}`;
        sampleImagesMap[cloudPath] = path.join(localFolder, filename);
      }
    } else {
      console.warn(`⚠️ Warning: Mock folder path not found: ${localFolder}`);
    }
  }

  const logoImageKeys_ = Object.keys(sampleImagesMap).filter(k => k.startsWith("logos/"));
  const foodImageKeys = Object.keys(sampleImagesMap).filter(k => k.startsWith("foods/"));
  const menuImageKeys = Object.keys(sampleImagesMap).filter(k => k.startsWith("menus/"));

  // 📐 COORD MATRIX
  const dishesCoordinates: [number, number][][] = [
    [[0.37, 0.22], [0.36, 0.32], [0.31, 0.48], [0.38, 0.6], [0.58, 0.72], [0.38, 0.84]],
    [[0.46, 0.18], [0.43, 0.21], [0.47, 0.25], [0.74, 0.28], [0.63, 0.31], [0.55, 0.34], [0.62, 0.38], [0.57, 0.42], [0.66, 0.45], [0.78, 0.48], [0.48, 0.52], [0.09, 0.68], [0.56, 0.72], [0.65, 0.75], [0.64, 0.82], [0.71, 0.85], [0.76, 0.89]],
    [[0.49, 0.21], [0.4, 0.25], [0.56, 0.28], [0.38, 0.31], [0.67, 0.35], [0.64, 0.38], [0.51, 0.42], [0.37, 0.45], [0.51, 0.48], [0.36, 0.52], [0.37, 0.64], [0.62, 0.68], [0.56, 0.75], [0.51, 0.82], [0.68, 0.93]],
  ];

  // 📁 2. READ PREREQUISITE UUID BLUEPRINTS
  const restaurantUuids_: string[] = readJsonFile("my_uuids/restaurant_uuids.json");
  // const foodUuids: string[] = readJsonFile("my_uuids/food_uuids.json");
  const menuUuids: string[] = readJsonFile("my_uuids/menu_uuids.json");

  // ✂️ Reducing amount of elements
  const logoImageKeys = logoImageKeys_.slice(0, 1);
  const restaurantUuids = restaurantUuids_.slice(0, 1);

  // 🚨 DATA VALIDATION SAFEGUARDS
  if (menuImageKeys.length !== dishesCoordinates.length) {
    throw new Error("🔴 Number of menus must equal the number of dish coordinate arrays.");
  }
  if (logoImageKeys.length !== restaurantUuids.length) {
    throw new Error("🔴 The restaurant UUID list size must match available logos.");
  }

  // 🪣 3. STREAM BINARY UPLOADS TO MOCK S3
  for (const [cloudPath, localPath] of Object.entries(sampleImagesMap)) {
    if (fs.existsSync(localPath)) {
      const fileBuffer = fs.readFileSync(localPath);
      await rawS3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: cloudPath,
          Body: fileBuffer,
        })
      );
      console.log(` ✅ Uploaded asset to S3: ${cloudPath}`);
    }
  }

  const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`

  console.log("\n⚡ Populating DynamoDB Single-Table Records...");

  // 🏪 4. CONSTRUCT RESTAURANTS & RECURSIVE SUB-RESOURCES
  for (let i = 0; i < logoImageKeys.length; i++) {
    const rid = restaurantUuids[i];
    const logoImageUrl = `${s3BaseUrl}/${logoImageKeys[i]}`;
    const dishImageUrlsToShow: string[] = [];

    const totalMenusForRestaurant = getRandomInt(2, 3);

    for (let mIdx = 0; mIdx < totalMenusForRestaurant; mIdx++) {
      const someMenuIndex = getRandomInt(0, menuUuids.length - 1);
      const menuImageUrl = `${s3BaseUrl}/${menuImageKeys[someMenuIndex]}`;
      const itsDishesCoordinates = dishesCoordinates[someMenuIndex] || dishesCoordinates[0];

      // Generate menu unique resource identifier
      const mid = crypto.randomUUID();

      // 📝 Push Menu Resource Row
      await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: {
          PK: `REST#${rid}`,
          SK: `RESOURCE#MENU#${mid}`,
          pageNumber: mIdx + 1,
          imageUrl: menuImageUrl,
        }
      }));

      // 🍽️ Generate Coordinates-linked Dishes
      for (const dishCoordinates of itsDishesCoordinates) {
        const did = crypto.randomUUID();
        const dishImageUrl = `${s3BaseUrl}/${getRandomItem(foodImageKeys)}`;

        if (Math.random() < 0.2) {
          dishImageUrlsToShow.push(dishImageUrl);
        }

        const dishName = `Special Dish ${getRandomInt(100, 999)}`;

        // 📝 Push Dish Resource Row
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            PK: `REST#${rid}`,
            SK: `RESOURCE#DISH#${did}`,
            dishName: dishName,
            imageUrl: dishImageUrl,
            prepTime: getRandomInt(10, 15),
            priceCents: getRandomInt(500, 4000), // Javascript numbers preserve floating points correctly inside DocumentClient
            isOutOfStock: false,
            menuPageId: mid,
            coordinateXInMenu: dishCoordinates[0],
            coordinateYInMenu: dishCoordinates[1],
            createdAt: Date.now(),
            description: "The most beautiful thing in a dish"
          }
        }));

        console.log(`✅🍽️  ${dishName} (${dishImageUrl}) mapped to page ${mIdx + 1} for restaurant: Gourmet Hub ${i}`);
      }
      console.log(`✅📇 Menu page ${mIdx + 1} (${menuImageUrl}) fully initialized.`);
    }

    if (dishImageUrlsToShow.length === 0) {
      console.log(`⚠️ No showcase dishes randomly hit for ${rid}.`);
    }

    // 📝 5. METADATA RECORD CREATION
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `REST#${rid}`,
        SK: "METADATA",
        name: `Gourmet Hub ${i}`,
        logoUrl: logoImageUrl,
        cityID: "NYC",
        latitude: -12.122,
        longitude: -77.028,
        openTime: "08:00",
        closeTime: "22:00",
        dishesToShow: dishImageUrlsToShow,
      }
    }));

    // 🔗 6. USER FEED GRAPH RELATION LINK
    const targetSection = getRandomItem(SECTIONS);
    await docClient.send(new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        PK: `USER#${STATIC_USER_ID}`,
        SK: `SEC#${targetSection}#${rid}`,
        addedDate: new Date().toISOString(),
      }
    }));

    console.log(`🏪 Restaurant Gourmet Hub ${i} (${logoImageUrl}) indexed into User Section -> [${targetSection}]\n`);
  }

  console.log("-----------------------------------------------------------");
  console.log("🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY!");
  console.log("-----------------------------------------------------------");
}

// Fire execution loop catch traps
seedData().catch((err) => {
  console.error("🔴 Fatal database seeding crash:", err);
  process.exit(1);
});