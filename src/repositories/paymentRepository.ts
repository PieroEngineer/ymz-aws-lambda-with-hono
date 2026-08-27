import { docClient } from "../docClient";
import { TABLE_NAME } from "../k";
import { OrderItemPayload } from "../types/orders";
import { ConfirmedOrder, ConfirmedOrderItem, dishPrice, dishPricesDbResponse, Order, PaymentConfirmationPayload } from "../types/payments";
import { BatchGetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";


export async function getAllOrders( restaurantId: string ): Promise<Order[]> {

    const queryParams = {
      TableName: TABLE_NAME,
      KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
      ExpressionAttributeValues: {
        ":pk": `REST#${restaurantId}`,
        ":skPrefix": "ORDER#",
      },
    }

    const dbResult = await docClient.send(new QueryCommand(queryParams));
    const rawItems = dbResult.Items || [];

    const mappedOrders = rawItems.map((item) => {
        const requestId = item.SK.replace("ORDER#", "");

        const order: Order = {
            requestId,
            userName: item.userName,
            // lastUpdateTimestamp: item.lastUpdateTimestamp,
            userId: item.userId,
            orderSelections: item.orderSelections,
            arrivalTimeInMinutes: item.arrivalTimeInMinutes,
            groupSize: item.groupSize,
            totalCostInCents: item.totalCostInCents,
            onPaidTimeStamp: item.onPaidTimeStamp,
            paymentImageUrl: item.paymentImageUrl
        }

      return order
    });

    return mappedOrders
}

export async function getSpecificDishesData( orderSelections: OrderItemPayload[], restaurantId: string ): Promise<dishPrice[]>{
    // Map your SKs into the required DynamoDB key structure
    const keys = orderSelections.map((selection) => ({
        PK: `REST#${restaurantId}`,
        SK: `RESOURCE#DISH#${selection.dishId}`,
    }));

    ///     const batchResponse = await docClient.send(new BatchGetCommand({
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

    const {restaurantId, requestId, ...data} = confirmationEvent

    const newConfirmationEvent: ConfirmedOrderItem = {
        PK: `REST#${restaurantId}`,
        SK: `ORDER#${requestId}`,   /// Perphaps it should be a new ID, not the request ID
        
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