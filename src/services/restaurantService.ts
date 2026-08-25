import { generateS3PresignedUrl } from "../clients/s3Client";
import {
    batchGetRestaurantMetadata,
    buildDishDeleteTransactItem,
    buildDishPutTransactItem,
    buildDishUpdateTransactItem,
    buildMenuPageDeleteTransactItem,
    buildMenuPagePutTransactItem,
    buildMenuPageUpdateTransactItem,
    executeMenuTransaction,
    getRestaurantMetadata,
    getRestaurantPaymentMetadata,
    putRestaurantMetadata,
    queryRestaurantMenuResources,
    queryUserFeedLinks,
    updateRestaurantMetadata,
} from "../repositories/restaurantRepository";
import {
    Dish,
    FeedItem,
    MenuPage,
    MenuResponse,
    MenuSyncPayload,
    PaymentInfoResponse,
    PresignedUrlMapping,
    RestaurantDataToUpdate,
    RestaurantInfoResponse,
    RestaurantInitializePayload,
    RestaurantInitializeResponse,
    RestaurantMetadataData,
    RestaurantUpdatePayload,
    SyncDataFirstResponse,
} from "../types/restaurants";
import { TransactWriteCommandInput } from "@aws-sdk/lib-dynamodb";

type TransactItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];

export async function initializeRestaurantInfo(
    restaurantId: string,
    payload: RestaurantInitializePayload
): Promise<RestaurantInitializeResponse> {
    // TODO: Do the same validation of the client-side to check if the mandatory fields are sent for the intitialization (For the urls, verify shape)

    console.log(`🔎🏪  Initialize restaurant info whose ID is ${restaurantId}\n`, JSON.stringify(payload, null, 2));

    // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
    const logoS3Key = `logo/${restaurantId}.webp`;

    const logoPresigned = await generateS3PresignedUrl(logoS3Key);
    console.log('🔎🖼️  Logo public Url', logoPresigned.publicUrl);
    console.log('✅🖼️  Logo Url generated');

    const dishImagePublicUrls: string[] = [];
    const dishesToUploadShowUrls: string[] = [];
    for (let i = 0; i < 3; i++) {

        if (payload.dishesToShowUrlsRequired[i]) { // TODO: Change it for blank checking

            // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
            const s3Key = `front/${i}/${restaurantId}.webp`;

            const dishPresigned = await generateS3PresignedUrl(s3Key);
            console.log(`🔎🖼️  dish ${i} to show image public Url`, dishPresigned.publicUrl);

            dishImagePublicUrls.push(dishPresigned.publicUrl);

            // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
            dishesToUploadShowUrls[i] = dishPresigned.uploadUrl;

            console.log('✅🖼️  Dish image upload Url');
        }
        else {
            dishImagePublicUrls.push('');
            dishesToUploadShowUrls.push('');
        }
    }

    // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
    const qrS3Key = `qr/${restaurantId}.webp`;

    const qrPresigned = await generateS3PresignedUrl(qrS3Key);
    console.log('🔎🖼️  QR public Url', qrPresigned.publicUrl);
    console.log('✅🖼️  QR Url generated');

    const dataToUpload: RestaurantMetadataData = {
        name: payload.restaurantName,
        logoUrl: logoPresigned.publicUrl,
        latitude: payload.latitude,
        longitude: payload.longitude,
        dishesToShowUrl1: dishImagePublicUrls[0],
        dishesToShowUrl2: dishImagePublicUrls[1],
        dishesToShowUrl3: dishImagePublicUrls[2],
        phoneNumberToPay: payload.phoneNumberToPay,
        phoneNumberToContact: payload.phoneNumberToContact,
        paymentQrUrl: qrPresigned.publicUrl,
        isOpen: true, //true
        isInitialized: true,
    };

    console.log(`🔎🏪  Initialize restaurant info whose ID is ${restaurantId}\n`, JSON.stringify(dataToUpload, null, 2));

    await putRestaurantMetadata(restaurantId, dataToUpload);

    console.log(`✅⤴️  restaurant info initialized: ${restaurantId}`);

    return {
        logoPresignedUrl: logoPresigned.uploadUrl,
        dishesToShowPresignedUrls: dishesToUploadShowUrls,
        paymentQrPresignedUrl: qrPresigned.uploadUrl,
    };
}

export async function obtainRestaurantInfo(restaurantId: string): Promise<RestaurantInfoResponse> {
    const restaurantItem = await getRestaurantMetadata(restaurantId);

    if (!restaurantItem) {
        console.log(`⚠️🏪  Restaurant (${restaurantId}) wasn't found. Returning an empty restaurant \n`);
        return { // Temporal shape for a restaurant that wasn't initialized in the table yet 
            restaurantId: '',
            restaurantName: '',
            logoUrl: '',
            latitude: 0,
            longitude: 0,
            // openTime: '',
            // closeTime: '',
            dishesToShowUrls: ['', '', ''],
            phoneNumberToPay: '',
            phoneNumberToContact: '',
            paymentQrUrl: '',
            // isOpen: true, // TODO
            isInitialized: false
        };
    }

    console.log(`🔎🏪  Restaurant info fetched for ID: ${restaurantId}\n`, restaurantItem);

    return {
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
        // isOpen: true, // TODO
        isInitialized: restaurantItem.isInitialized
    };
}

export async function updateRestaurantInfo(
    restaurantId: string,
    payload: RestaurantUpdatePayload
): Promise<RestaurantInitializeResponse> {
    // TODO: Include the "isOpen" when the dynamic update is done.

    console.log(`🔎🏪  Restaurant info received for ID: ${restaurantId}\n`, JSON.stringify(payload, null, 2));

    const dataToUpdate: RestaurantDataToUpdate = {
        name: payload.restaurantName,
        latitude: payload.latitude,
        longitude: payload.longitude,
        // openTime: openTime,
        // closeTime: closeTime,
        phoneNumberToPay: payload.phoneNumberToPay,
        phoneNumberToContact: payload.phoneNumberToContact
    };

    let logoUploadUrl;
    if (payload.logoUrlRequired) {

        // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
        const logoS3Key = `logo/${restaurantId}.webp`;

        const logoPresigned = await generateS3PresignedUrl(logoS3Key);
        console.log('🔎🖼️  Logo public Url', logoPresigned.publicUrl);

        // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
        logoUploadUrl = logoPresigned.uploadUrl;

        dataToUpdate.logoUrl = logoPresigned.publicUrl;

        console.log('✅🖼️  Logo upload Url');
    }
    else {
        logoUploadUrl = '';
    }

    const dishImageSelection = [
        (dishImageUrl: string) => { dataToUpdate.dishesToShowUrl1 = dishImageUrl; },
        (dishImageUrl: string) => { dataToUpdate.dishesToShowUrl2 = dishImageUrl; },
        (dishImageUrl: string) => { dataToUpdate.dishesToShowUrl3 = dishImageUrl; },
    ];

    const dishesToUploadShowUrls = new Array<string>(3);
    for (let i = 0; i < 3; i++) {

        if (payload.dishesToShowUrlsRequired[i] === true) {

            // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
            const s3Key = `front/${i}/${restaurantId}.webp`;

            const dishPresigned = await generateS3PresignedUrl(s3Key);
            console.log(`🔎🖼️  dish ${i} to show image public Url`, dishPresigned.publicUrl);

            dishImageSelection[i](dishPresigned.publicUrl);

            // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
            dishesToUploadShowUrls[i] = dishPresigned.uploadUrl;

            console.log('✅🖼️  Dish image upload Url');
        }
        else {
            dishesToUploadShowUrls[i] = '';
        }
    }

    let qrUploadUrl;
    if (payload.paymentQrUrlsRequired) {

        // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
        const qrS3Key = `qr/${restaurantId}.webp`;

        const qrPresigned = await generateS3PresignedUrl(qrS3Key);
        console.log('🔎🖼️  QR public Url', qrPresigned.publicUrl);

        dataToUpdate.paymentQrUrl = qrPresigned.publicUrl;

        // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
        qrUploadUrl = qrPresigned.uploadUrl;

        console.log('✅🖼️  QR upload Url');
    }
    else {
        qrUploadUrl = '';
    }

    await updateRestaurantMetadata(restaurantId, dataToUpdate);

    console.log(`✅⤴️ Updating restaurant info: ${restaurantId}`);

    return {
        logoPresignedUrl: logoUploadUrl,
        dishesToShowPresignedUrls: dishesToUploadShowUrls,
        paymentQrPresignedUrl: qrUploadUrl,
    };
}

export async function obtainPersonalizedFeed(userId: string): Promise<FeedItem[]> {
    console.log(`🔎😌  Fetching personalized feed for User: ${userId}`);

    console.log(`🔎😌 User ID was fown: ${userId}`);

    // 🗺️ DYNAMIC S3 RESOLUTION: Switches seamlessly between LocalStack and AWS Cloud grids
    // const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
    // const s3BaseUrl = isLocal 
    //   ? `http://localhost:4566/${BUCKET_NAME}`
    //   : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;

    // 2. STEP 1: Find the Section relation pointer records (SEC# rows)
    const feedLinks = await queryUserFeedLinks(userId);

    ///
    // if (feedLinks.length === 0) {
    //   return c.json([], 200);
    // }


    // Simulating a user already created with its restaurant in section
    const MOCK_USER_ID = '00000000-0000-4000-a000-000000000000';
    const MOCK_RESTAURANT_ID = '4258e0fa-6b3c-43bc-a6d8-82c5835d608d';
    const mockFeedLinks: Record<string, unknown>[] = [
        {
            PK: `USER#${MOCK_USER_ID}`,
            SK: `SEC#Popular#${MOCK_RESTAURANT_ID}`,
            addedDate: new Date().toISOString(),
        }
    ];

    console.log('🔎🏪  Mock data\n', mockFeedLinks, '\n🏪  seed data\n', feedLinks);

    // 3. STEP 2: Hydrate keys to prep for BatchGet
    const sectionMap: Record<string, string> = {}; // Remembers relationship groupings
    const restaurantIds: string[] = [];

    // for (const link of feedLinks) {
    for (const link of mockFeedLinks) {
        const parts = (link.SK as string).split("#"); // ["SEC", "Popular", "UUID"]
        const sectionName = parts[1];
        const rid = parts[2];

        restaurantIds.push(rid);
        sectionMap[rid] = sectionName;
    }

    console.log(`🔎🏪  restaurantIds: ${JSON.stringify(restaurantIds, null, 2)}`);
    console.log(`🔎🏪  sectionMap: ${JSON.stringify(sectionMap, null, 2)}`);

    const rawRestaurants = await batchGetRestaurantMetadata(restaurantIds);

    console.log(`🔎🏪  Fetched ${rawRestaurants.length} personalized feed items ${JSON.stringify(rawRestaurants, null, 2)}`);

    // 4. STEP 3: Format output layout matching your Kotlin mobile app Data Transfer Objects
    const formattedFeed = rawRestaurants.map((res) => {
        const rid = res.PK.replace("REST#", "");
        const originalDishes = [res.dishesToShowUrl1 || '', res.dishesToShowUrl2 || '', res.dishesToShowUrl3 || ''];

        return {
            id: rid,
            name: res.name,
            logoUrl: res.logoUrl || "",
            sectionType: sectionMap[rid] || "General",
            dishesToShowUrls: originalDishes
            //isOpen // TODO: When the restaurant is reay to open
            //isInitialized // FIXME: Only show restaurants that were initialized
        };
    });

    console.log(`✅🏪 Personalized feed items fetched and formatted for User: ${userId}\n`);
    console.log(`A sample of data is\n ${formattedFeed[0]}\n`);

    return formattedFeed;
}

export async function obtainRestaurantMenu(restaurantId: string): Promise<MenuResponse> {
    // 🗺️ DYNAMIC S3 RESOLUTION: Matches development environments vs production targets
    // const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
    // const s3BaseUrl = isLocal 
    //   ? `http://localhost:4566/${BUCKET_NAME}`
    //   : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;

    const items = await queryRestaurantMenuResources(restaurantId);

    const menuPages: MenuPage[] = [];
    const dishes: Dish[] = [];

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
            if ((item.priceCents ?? null) !== null && (item.prepTime ?? null) !== null) {
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
            } else {
                console.log(`🚨  There was an issue with the price or preparation time of ${sk.replace("RESOURCE#DISH#", "")} | Fallback: pin is not sent`);
                //TODO: Include a response's attribute that says what and why certain dishes were not saved remotely (Use a small "code" of the why to reduce the payload weight)
            }
        }
    }

    // Sort menu pages sequentially by page index number
    menuPages.sort((a, b) => a.pageNumber - b.pageNumber);

    console.log(`🔎📃  Menu info attached and mapped for Restaurant ID:\n${restaurantId}`);
    console.log('🔎  The menu menu pages are:', JSON.stringify(menuPages, null, 2));
    console.log('🔎  The menu dishes are:', JSON.stringify(dishes, null, 2));

    return {
        menuPages,
        dishes
    };
}

export async function synchronizeRestaurantMenu(
    restaurantId: string,
    payload: MenuSyncPayload
): Promise<SyncDataFirstResponse | { message: string }> {
    const menuPages = payload.menuPages || [];
    const dishes = payload.dishes || [];

    console.log('🍽️  dishes to update\n', dishes);

    // This array will assemble all atomic actions for the single-table transaction block
    const transactionItems: TransactItem[] = [];

    const presignedUrls: PresignedUrlMapping[] = [];

    // Resolve structural patterns targeting local environments vs live AWS
    // const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
    // const s3BaseUrl = isLocal 
    //   ? `http://localhost:4566/${BUCKET_NAME}`
    //   : `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com`;

    console.log(`🔎📃  Pages received:\n${JSON.stringify(menuPages, null, 2)}`);

    // 📃 PROCESS MENU PAGES
    for (const page of menuPages) {
        const pageId = page.pageId;
        const action = page.action; // Expects "save" (create/update) or "delete"

        if (action === "delete") {
            transactionItems.push(buildMenuPageDeleteTransactItem(restaurantId, pageId));
        } else if (action === "save" || action === "update") {  //TODO: Add checking to avoid to images with the same page number 
            // 🔒 SECURITY STRATEGY: Generate a secure, predictable key coordinate path inside S3
            // const s3Key = `restaurants/${rid}/menus/${pageId}.webp`;
            const s3Key = `menus/${pageId}.webp`;

            const pagePresigned = await generateS3PresignedUrl(s3Key);
            console.log('🔎  publicUrl', pagePresigned.publicUrl);
            console.log('🔎  uploadUrl', pagePresigned.uploadUrl);

            // Map token configurations to match your "SyncDataFirstResponse" response payload design
            presignedUrls.push({
                pageId,
                uploadUrl: pagePresigned.uploadUrl,
                publicUrl: pagePresigned.publicUrl
            });

            if (action === "save") {
                transactionItems.push(
                    buildMenuPagePutTransactItem(restaurantId, pageId, Number(page.pageNumber || 0), pagePresigned.publicUrl)
                );
            }
            else if (action === "update") {
                const updateItem = buildMenuPageUpdateTransactItem(
                    restaurantId,
                    pageId,
                    page.updatedFields || {},
                    pagePresigned.publicUrl
                );

                if (updateItem) {
                    transactionItems.push(updateItem);
                }
            }
        }
    }

    // 🍔 PROCESS INDIVIDUAL DISHES
    for (const dish of dishes) {  // Dishes from client
        const dishId = dish.id;
        const action = dish.action; // Expects "save" or "delete"

        if (action === "delete") {
            transactionItems.push(buildDishDeleteTransactItem(restaurantId, dishId));
        } else if (action === "save") { //TODO: Include a "update" condition. That includes code a diff logic in the client side.
            transactionItems.push(buildDishPutTransactItem(restaurantId, dish));
        }
        else if (action === "update") {
            const updateItem = buildDishUpdateTransactItem(restaurantId, dishId, dish.updatedFields || {});

            if (updateItem) {
                transactionItems.push(updateItem);
            }
        }
    }

    console.log(`🔎📃  Data to be transacted:\n${JSON.stringify(transactionItems, null, 2)}`);

    // Edge case: If client sent an empty mutation array package
    if (transactionItems.length === 0) {
        return { message: "No menu or dish mutations provided." };
    }

    // 🛑 Guard against DynamoDB structural limits
    if (transactionItems.length > 100) {
        throw new Error("Transaction block exceeds AWS limit of 100 items.");
    }

    await executeMenuTransaction(transactionItems);

    // 🎯 OUTPUT: Enforce formatting structure to output "SyncDataFirstResponse"
    const responsePayload: SyncDataFirstResponse = {
        message: "Menu state successfully synchronized atomically",
        presignedUrls
    };

    console.log(`✅⤴️ TransactWrite completed: Synchronized menu states for Restaurant: ${restaurantId}`);

    return responsePayload;
}

export async function obtainRestaurantPaymentInfo(restaurantId: string): Promise<PaymentInfoResponse> {
    // if (rid.length > 128 || !/^[A-Za-z0-9_-]+$/.test(rid)) {  /// Here an example of ID shape validation
    //   return c.json({ error: "Invalid restaurantId" }, 400);
    // }

    const metadata = await getRestaurantPaymentMetadata(restaurantId);

    if (!metadata) {
        throw new Error("🚩 Restaurant payment metadata not found");
    }

    const phoneNumberToPay = metadata.phoneNumberToPay;
    const phoneNumberToContact = metadata.phoneNumberToContact;
    const paymentQrUrl = typeof metadata.paymentQrUrl === "string" ? metadata.paymentQrUrl : "";

    // if ( /// Here an example of integer protection
    //   !Number.isSafeInteger(phoneNumberToPay) ||
    //   !Number.isSafeInteger(phoneNumberToContact) ||
    //   paymentQrUrl.length === 0
    // ) {
    //   console.error(`🚨 PAYMENT METADATA INVALID: ${rid}`);
    //   return c.json({ error: "Restaurant payment metadata is invalid" }, 500);
    // }

    return {
        phoneNumberToPay,
        phoneNumberToContact,
        paymentQrUrl,
    };
}
