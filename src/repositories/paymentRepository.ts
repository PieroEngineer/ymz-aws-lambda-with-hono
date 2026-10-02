import { docClient } from "../clients/docClient.js";
import { GSI_TABLE_NAME, TABLE_NAME } from "../k.js";
import { OrderItemPayload } from "../types/orders.js";
import { ConfirmedOrder, ConfirmedOrderItem, dishPrice, dishPricesDbResponse, Order } from "../types/payments.js";
import { BatchGetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";


export async function getAllActiveOrders( restaurantId: string ): Promise<Order[]> {

    const queryParams = {
      TableName: TABLE_NAME,
      IndexName: GSI_TABLE_NAME, 
      KeyConditionExpression: "GSIPK = :pk AND begins_with(GSISK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${restaurantId}`,
        ":skPrefix": "ORDER#ACTIVE#",
      },
    }

    const dbResult = await docClient.send(new QueryCommand(queryParams));
    const rawItems = dbResult.Items || [];

    const mappedOrders = rawItems.map((item) => {
        const orderId = item.SK.replace("ORDER#", "");
        // or const orderId = item.GSISK.replace("ORDER#ACTIVE#", "");

        const order: Order = {
            orderId: orderId,
            requestId: item.requestId ?? orderId,   // ANCHOR: Remove the fallback when publish the app
            userName: item.userName,
            // lastUpdateTimestamp: item.lastUpdateTimestamp,
            userId: item.userId,
            orderSelections: item.orderSelections,
            arrivalTimeInMinutes: item.arrivalTimeInMinutes,
            groupSize: item.groupSize,
            totalCostInCents: item.totalCostInCents,
            onPaidTimeStamp: item.onPaidTimeStamp,
            paymentImageUrl: item.paymentImageUrl,
            extraCommentaries: item.extraCommentaries ?? ""
        }

      return order
    });

    return mappedOrders
}



export async function getSpecificDishesData( orderSelections: OrderItemPayload[], restaurantId: string ): Promise<dishPrice[]>{ /// Maybe it should be in the restuarant route
    // Map your SKs into the required DynamoDB key structure
    const keys = orderSelections.map((selection) => ({
        PK: `REST#${restaurantId}`,
        SK: `RESOURCE#DISH#${selection.dishId}`,
    }));

    if(TABLE_NAME === undefined){
        throw new Error("🚩📑  TABLE_NAME is undefined. Please check your environment configuration.");
    }

    const response = await docClient.send(new BatchGetCommand({ /// Analyze if a transaction is more proper for this situation
        RequestItems: {
        [TABLE_NAME]: {
            Keys: keys,
            ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
            ProjectionExpression: "priceCents, SK", // Optional: Save bandwidth
        },
        },
    }));

    // Extract results safely
    const dishItems: dishPricesDbResponse[] = (response.Responses?.[TABLE_NAME] as dishPricesDbResponse[]) || [];

    const priceMap: dishPrice[] = []
  
    for (let i = 0; i < dishItems.length; i++) {
        const item = dishItems[i];
        const dishId = item.SK.replace("RESOURCE#DISH#", "")

        priceMap.push({
            dishId: dishId,
            priceCents: item.priceCents
        });
    }

    return priceMap

}



export async function putConfirmedOrder( confirmationEvent: ConfirmedOrder ){

    const {restaurantId, orderId, ...data} = confirmationEvent

    const newConfirmationEvent: ConfirmedOrderItem = {
        PK: `REST#${restaurantId}`,
        SK: `ORDER#${orderId}`,   /// Perphaps it should be a new ID, not the request ID
        
        GSIPK: `REST#${restaurantId}`,
        GSISK: `ORDER#ACTIVE#${orderId}`,

        ...data
    }
    
    console.log('💽  Order to save in DynamoDB', JSON.stringify(newConfirmationEvent , null, 2), '\nfor restaurant ', confirmationEvent.restaurantId);

    // TODO: Handle the situation where it's an update of the pre-selection and not only a new one (Perhaps in another router)

    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newConfirmationEvent,
    }));
}



export async function updateOrderToDeactivate(restaurantId: string, orderId: string){
    await docClient.send( new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `REST#${restaurantId}`,
            SK: `ORDER#${orderId}`
        },
        UpdateExpression: "REMOVE GSIPK, GSISK",  /* TODO SET #status = :status, completedAt = :ts*/
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        ReturnValues: "NONE",
        // ExpressionAttributeNames: { '#status': 'status' },   // TODO: Include Status and datetime of the event
        // ExpressionAttributeValues: { ':status': 'completed', ':ts': now }
    }))
}




// TODO: Handle the situation when a dish wasn't found. "BatchGet" doesn't notify that, so I leave this code as hint to handle it; continue the action to notify to the user and/or restaurant  /// If it's possible that the dish is not available, create the dish availability confirmation to the moment when the user go from menu selection to payment
// Inside your Hono handler...
// const requestedIds = ["123", "456", "789"];
// const dishesFromDb = await batchGetDishes(keysToFetch);

// // 1. Convert the DB array into a quick lookup Map using the clean Sort Key ID
// const dbMap = new Map(
//   dishesFromDb.map(item => [item.SK.replace("DISH#", ""), item])
// );

// // 2. Reconstruct the array matching the exact input order, inserting null for missing items
// const orderedResults = requestedIds.map(id => dbMap.get(id) || null);