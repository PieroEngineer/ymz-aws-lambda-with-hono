import { BatchGetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../clients/docClient.js";
import { GSI_TABLE_NAME, TABLE_NAME } from "../k.js";
import { RequestIdentificatorsPayload, NewRequestItem, TableRequest, BatchCancellationPayload } from "../types/requests.js";

// export async function putRequest(restaurantId: string, requestId: string, requestData: RequestItemData) {
export async function putRequest(requestPayload: TableRequest) {
    const { restaurantId, requestId, ...requestData } = requestPayload

    const newRequestItem: NewRequestItem = {
        PK: `REST#${restaurantId}`,
        SK: `REQ#${requestId}`,
        
        GSIPK: `REST#${restaurantId}`,
        GSISK: `REQ#ACTIVE#${requestId}`,

        ...requestData
    };

    console.log('💽  Request Item to save in DynamoDB', JSON.stringify(newRequestItem , null, 2), '\nfor restaurant ', restaurantId);

    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newRequestItem,
    }));
}

//X
// export async function deleteRequest(restaurantId: string, requestId: string) {
//     const pk = `REST#${restaurantId}`;
//     const sk = `REQ#${requestId}`;

//     // TODO: Before removing, verify if the request status is removable.
//     await docClient.send(new DeleteCommand({  // TODO: This is temporal  code and should be alternated with the commented code that is just above
//         TableName: TABLE_NAME,
//         Key: { PK: pk, SK: sk },
//     }));
// }

export async function updateRequestToDeactivate(restaurantId: string, requestId: string) {  // TODO: Include a dyanmic timestamp attribute depending the raeson of the deactivation

    await docClient.send( new UpdateCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `REST#${restaurantId}`,
            SK: `REQ#${requestId}`
        },
        UpdateExpression: "REMOVE GSIPK, GSISK",  /* TODO SET #status = :status, canceledAt = :ts*/
        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
        ReturnValues: "NONE",
        // ExpressionAttributeNames: { '#status': 'status' },   // TODO: Include Status and datetime of the event
        // ExpressionAttributeValues: { ':status': 'canceled', ':ts': now }
    }))
}

export async function queryActiveRequestsByRestaurant(restaurantId: string) {
    // 🔍 1. Query DynamoDB for everything matching this restaurant's requests partition
    const queryParams = {
        TableName: TABLE_NAME,
        IndexName: GSI_TABLE_NAME, 
        KeyConditionExpression: "GSIPK = :pk AND begins_with(GSISK, :skPrefix)",
        ExpressionAttributeValues: {
            ":pk": `REST#${restaurantId}`,
            ":skPrefix": "REQ#ACTIVE#"
        }
    };

    const dbResult = await docClient.send(new QueryCommand(queryParams));

    return dbResult.Items || [];
}

export async function updateRequestState(restaurantId: string, requestId: string, normalizedState: string) {
    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;

    await docClient.send(new UpdateCommand({  // TODO: Include the updating of the event too
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
        UpdateExpression: "SET #state = :state",
        ExpressionAttributeNames: {
            "#state": "state",
        },
        ExpressionAttributeValues: {
            ":state": normalizedState,
        },
    }));
}

export async function updateBatchRequestsToDeactivate(cancelPayload: BatchCancellationPayload) {
    
    const itemsToUpdate = cancelPayload?.requestsToCancel ?? [];

    if (itemsToUpdate.length === 0) {
        return;
    }

    await Promise.all(
        itemsToUpdate
            .filter(({ restaurantId, requestId }) => Boolean(restaurantId && requestId))
            .map(async ({ restaurantId, requestId }) => {
                await docClient.send(
                    new UpdateCommand({
                        TableName: TABLE_NAME,
                        Key: {
                            PK: `REST#${restaurantId}`,
                            SK: `REQ#${requestId}`,
                        },
                        UpdateExpression: "REMOVE GSIPK, GSISK",
                        ConditionExpression: "attribute_exists(PK) AND attribute_exists(SK)",
                        ReturnValues: "NONE",
                    })
                );
            })
    );
}

export async function batchGetRequests(requestsToUpdate: RequestIdentificatorsPayload[]) {
    const formattedKeys = requestsToUpdate.map(item => ({
        PK: `REST#${item.restaurantId}`,
        SK: `REQ#${item.requestId}`
    }));
    
    if(TABLE_NAME === undefined){
        throw new Error("🚩📑  TABLE_NAME is undefined. Please check your environment configuration.");
    }
    
    // ⚡ Execute High-Speed Batch Read against DynamoDB Grid Core
    const batchResponse = await docClient.send(new BatchGetCommand({
        RequestItems: {
            [TABLE_NAME]: {
                Keys: formattedKeys,
                ConsistentRead: false, // CRITICAL: Keeps cost at 0.5 RCU per item (<4KB)
            },
        },
    }));

    // Extract results safely
    return batchResponse.Responses?.[TABLE_NAME] || [];
}
