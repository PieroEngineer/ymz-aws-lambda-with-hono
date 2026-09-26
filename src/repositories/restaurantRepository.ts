import {
    BatchGetCommand,
    GetCommand,
    PutCommand,
    QueryCommand,
    TransactWriteCommand,
    TransactWriteCommandInput,
    UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { docClient } from "../clients/docClient.js";
import { GSI2_TABLE_NAME, TABLE_NAME } from "../k.js";
import { DishSyncInput, RestaurantDataToUpdate, RestaurantMetadataData, TemporalFeedRestaurant } from "../types/restaurants.js";

type TransactItem = NonNullable<TransactWriteCommandInput["TransactItems"]>[number];

export async function putRestaurantMetadata(restaurantId: string, data: RestaurantMetadataData) {
    await docClient.send(
        new PutCommand({
            TableName: TABLE_NAME,
            Item: {
                PK: `REST#${restaurantId}`,
                SK: "METADATA", // TODO: Include the datetime of creation here or its location
                ...data // Unpacks and saves all incoming attributes
            }
        })
    );
}

export async function getRestaurantMetadata(restaurantId: string) {
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `REST#${restaurantId}`,
            SK: 'METADATA'
        },
        // Set to true only if you strictly need the absolute latest write
        ConsistentRead: false
    });

    const response = await docClient.send(command);
    return response.Item;
}

export async function updateRestaurantMetadata(restaurantId: string, dataToUpdate: RestaurantDataToUpdate) {
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
}

export async function queryUserFeedLinks(userId: string) {
    const feedLinksResponse = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
            ":pk": `USER#${userId}`,
            ":skPrefix": "SEC#",
        }
    }));

    return feedLinksResponse.Items || [];
}

export async function getTemporalRestaurantFeed(): Promise<TemporalFeedRestaurant[]> {
    const command = new QueryCommand({
        TableName: TABLE_NAME,
        IndexName: GSI2_TABLE_NAME,
        KeyConditionExpression: '#gsiPk = :gsiPkValue',
        ExpressionAttributeNames: {
            '#gsiPk': 'GSI2PK'
        },
        ExpressionAttributeValues: {
            ':gsiPkValue': 'RMETADATA'
        }
    });

    const response = await docClient.send(command);
    const items = (response.Items ?? []) as Array<{
        GSI2PK?: string;
        GSI2SK?: string;
    }>;

    return items.map((item) => ({
        restaurantId: item.GSI2SK?.replace('REST#', '') ?? ""
    }));
}

export async function batchGetRestaurantMetadata(restaurantIds: string[]) {
    const restaurantKeys = restaurantIds.map(rid => ({ PK: `REST#${rid}`, SK: "METADATA" }));
    
    if(TABLE_NAME === undefined){
        throw new Error("🚩📑  TABLE_NAME is undefined. Please check your environment configuration.");
    }
    
    // ⚡ Execute High-Speed Batch Read against DynamoDB Grid Core
    const batchResponse = await docClient.send(new BatchGetCommand({
        RequestItems: {
            [TABLE_NAME]: {
                Keys: restaurantKeys,
                ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
            }
        }
    }));

    return batchResponse.Responses?.[TABLE_NAME] || [];
}

export async function queryRestaurantMenuResources(restaurantId: string) {  // TODO: Type every output
    // ⚡ SINGLE-TABLE QUERY: Grabs both Dishes and Menu details in 1 fast DB request
    const response = await docClient.send(new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
            ":pk": `REST#${restaurantId}`,
            ":skPrefix": "RESOURCE#",
        }
    }));

    return response.Items || [];
}

export async function getRestaurantPaymentMetadata(restaurantId: string) {
    const response = await docClient.send(new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `REST#${restaurantId}`,
            SK: "METADATA",
        },
        ConsistentRead: false,
        ProjectionExpression: "phoneNumberToPay, phoneNumberToContact, paymentQrUrl",
    }));

    return response.Item;
}

export function buildMenuPageDeleteTransactItem(restaurantId: string, pageId: string): TransactItem {
    const sk = `RESOURCE#MENU#${pageId}`;

    return {
        Delete: {
            TableName: TABLE_NAME,
            Key: { PK: `REST#${restaurantId}`, SK: sk }
        }
    };
}

export function buildMenuPagePutTransactItem(
    restaurantId: string,
    pageId: string,
    pageNumber: number,
    publicUrl: string
): TransactItem {
    const sk = `RESOURCE#MENU#${pageId}`;

    return {
        Put: {
            TableName: TABLE_NAME,
            Item: {
                PK: `REST#${restaurantId}`,
                SK: sk,
                pageNumber: Number(pageNumber || 0), /// Take care with that "0"
                imageUrl: publicUrl // 🎯 Overwritten with the final public reading URL string destination
            }
        }
    };
}

export function buildMenuPageUpdateTransactItem(
    restaurantId: string,
    pageId: string,
    updatedFields: Record<string, unknown>,
    publicUrl: string
): TransactItem | null {
    const sk = `RESOURCE#MENU#${pageId}`;

    // 🧠 DYNAMIC COMPILER ENGINE
    // Map client field names to their specific DynamoDB attribute counterparts
    const fieldMapping: Record<string, string> = {
        imageUrl: "imageUrl",
        pageNumber: "pageNumber"
    };

    // Extract the target payload block (checks flat attributes first, falls back to an inner updatedFields map if structured that way)
    const payloadSource = updatedFields;

    const expressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};

    // Only add things to the update execution parameters if the client explicitly sent them
    for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
        if (payloadSource[clientKey] !== undefined) {
            expressions.push(`${dbField} = :${clientKey}`);

            // Ensure proper numeric cast primitives for numbers
            if (["pageNumber"].includes(clientKey)) {
                expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
            }
            else if (clientKey === "imageUrl") {
                expressionAttributeValues[`:${clientKey}`] = publicUrl;
            }
            else {
                expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
            }
        }
    }

    if (expressions.length === 0) {
        return null;
    }

    return {
        Update: {
            TableName: TABLE_NAME,
            Key: { PK: `REST#${restaurantId}`, SK: sk },
            UpdateExpression: `SET ${expressions.join(", ")}`,
            ExpressionAttributeValues: expressionAttributeValues
        }
    };
}

export function buildDishDeleteTransactItem(restaurantId: string, dishId: string): TransactItem {
    const sk = `RESOURCE#DISH#${dishId}`;

    return {
        Delete: {
            TableName: TABLE_NAME,
            Key: { PK: `REST#${restaurantId}`, SK: sk }
        }
    };
}

// TODO: Include types within these builders
export function buildDishPutTransactItem(restaurantId: string, dish: DishSyncInput): TransactItem {
    const sk = `RESOURCE#DISH#${dish.id}`;

    return {    
        Put: {
            TableName: TABLE_NAME,
            Item: { // Shape of what is going to be sent
                PK: `REST#${restaurantId}`,
                SK: sk,
                dishName: dish.name,
                availableComplementaryDishIds: dish.availableComplementaryDishIds,
                type: dish.type,
                priceCents: Number(dish.priceCents || 0),   // TODO: Shouldn't we remove these fallbacks
                prepTime: Number(dish.prepTime || 0),
                isOutOfStock: dish.isOutOfStock,
                menuPageId: dish.menuPageId,
                coordinateXInMenu: dish.coordinateXInMenu,
                coordinateYInMenu: dish.coordinateYInMenu,
                description: dish.description,
                createdAt: Date.now(),
                /**
                * 💡 HINT FOR SIGNED URL TRANSITION:
                * Strip down full path URLs to save only the relative storage object key identifiers
                * when moving to signed asset validation loops.
                */
                imageUrl: dish.imageUrl
            }
        }
    };
}

export function buildDishUpdateTransactItem(
    restaurantId: string,
    dishId: string,
    updatedFields: Record<string, unknown>
): TransactItem | null {
    const sk = `RESOURCE#DISH#${dishId}`;

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
        imageUrl: "imageUrl",
        createdAt: "createdAt",  /// Maybe it shouldn't be here because it'e never updated
        availableComplementaryDishIds: "availableComplementaryDishIds",
        type: "type"
    };

    // Extract the target payload block (checks flat attributes first, falls back to an inner updatedFields map if structured that way)
    const payloadSource = updatedFields;

    const expressions: string[] = [];
    const expressionAttributeValues: Record<string, unknown> = {};

    // Only add things to the update execution parameters if the client explicitly sent them
    for (const [clientKey, dbField] of Object.entries(fieldMapping)) {
        if (payloadSource[clientKey] !== undefined) {
            expressions.push(`${dbField} = :${clientKey}`);

            // Ensure proper numeric cast primitives for numbers
            if (["priceCents", "prepTime", "coordinateXInMenu", "coordinateYInMenu", "createdAt"].includes(clientKey)) { // TODO: Consider that it could be handled with "typeof"
                expressionAttributeValues[`:${clientKey}`] = Number(payloadSource[clientKey]);
            }
            else if (clientKey === "isOutOfStock") {
                expressionAttributeValues[`:${clientKey}`] = Boolean(payloadSource[clientKey]);
            }
            // else if (clientKey === "availableComplementaryDishIds") {
            //     expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
            // }
            else {
                expressionAttributeValues[`:${clientKey}`] = payloadSource[clientKey];
            }
        }
    }

    // Safety check: Avoid throwing errors if an update call was fired with an empty change block
    if (expressions.length === 0) {
        return null;
    }

    return {
        Update: {
            TableName: TABLE_NAME,
            Key: { PK: `REST#${restaurantId}`, SK: sk },
            UpdateExpression: `SET ${expressions.join(", ")}`,
            ExpressionAttributeValues: expressionAttributeValues
        }
    };
}

export async function executeMenuTransaction(transactionItems: TransactItem[]) {
    // ⚡ Execute all operations atomically in 1 single network trip
    await docClient.send(new TransactWriteCommand({
        TransactItems: transactionItems
    }));
}
