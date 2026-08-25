import { BatchGetCommand, DeleteCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../docClient";
import { TABLE_NAME } from "../k";
import { RequestIdentificatorsPayload, RequestItem } from "../types/requests";

export async function putRequest(newRequestItem: RequestItem) {
    console.log('💽  Request Item to save in DynamoDB', JSON.stringify(newRequestItem , null, 2), '\nfor restaurant ', newRequestItem.PK.replace('REST#', ''));

    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newRequestItem,
    }));
}

export async function deleteRequest(restaurantId: string, requestId: string) {
    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;

    // TODO: Before removing, verify if the request status is removable.
    await docClient.send(new DeleteCommand({  // TODO: This is temporal  code and should be alternated with the commented code that is just above
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk },
    }));
}

export async function queryRequestsByRestaurant(restaurantId: string) {
    // 🔍 1. Query DynamoDB for everything matching this restaurant's requests partition
    const queryParams = {
        TableName: TABLE_NAME,
        KeyConditionExpression: "PK = :pk AND begins_with(SK, :skPrefix)",
        ExpressionAttributeValues: {
            ":pk": `REST#${restaurantId}`,
            ":skPrefix": "REQ#"
        }
    };

    const dbResult = await docClient.send(new QueryCommand(queryParams));

    return dbResult.Items || [];
}

export async function updateRequestState(restaurantId: string, requestId: string, normalizedState: string) {
    const pk = `REST#${restaurantId}`;
    const sk = `REQ#${requestId}`;

    await docClient.send(new UpdateCommand({  // TODO: Include the updating of the acceptance's timestamp too
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

export async function batchGetRequests(requestsToUpdate: RequestIdentificatorsPayload[]) {
    const formattedKeys = requestsToUpdate.map(item => ({
        PK: `REST#${item.restaurantId}`,
        SK: `REQ#${item.requestId}`
    }));

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
