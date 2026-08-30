import { transmitViaAbly } from "../clients/ablyClient";
import { ablyKeyWS } from "../k";
import { batchGetRequests, deleteRequest, putRequest, queryRequestsByRestaurant, updateRequestState } from "../repositories/requestRepository";
import {
    ActiveRequestStatus,
    RequestCancelClientPayload,
    RequestCancelPayload,
    TableRequestPayload,
    RequestStatusUpdateClientPayload,
    RequestUpdatePayload,
    TableRequestResponse,
    RequestIdentificatorsPayload,
    TableRequest,
} from "../types/requests";

export async function saveRequest(requestPayload: TableRequestPayload, requestTime: number) {

    /// Mocks: They should be passed by the customer's request
    const mockUserSpecifics = ['special day', 'with vehicule'];
    // const mockUserSpecifics = {  // TODO: Research how to implement in this way when details are added in the specifications (Maybe every detail could be a object's keys like "groupSize" or "state", and their value)
    //     birthday: 'For julia',
    //     baby: '2 babies'
    //   }

    // TODO: Verify here that the arrival time is less than 20 minutes (or a small time that the restaurant set)

    // Base info
    const currentTableRequest: TableRequest = { // TODO: Use a mapper to do this and move it up
        restaurantId: requestPayload.restaurantId,
        requestId: requestPayload.requestId,
        userId: requestPayload.userId,
        userName: requestPayload.userName,
        groupSize: requestPayload.groupSize,
        onQueuedTimestamp: requestTime,
        state: "QUEUED",
        specifics: mockUserSpecifics,
        arrivlaTime: requestPayload.arrivalTime
    };

    // await putRequest(requestPayload.restaurantId, requestPayload.requestId, baseRequestInfo);
    await putRequest(currentTableRequest);

    return currentTableRequest;
}

export async function transmitTableRequest(requestPayload: TableRequestPayload, requestTime: number): Promise<boolean> {
    const channelName = `restaurant:${requestPayload.restaurantId}:ops`;
    const requestName = 'table-requested';

    const mockUserSpecifics = ['special day', 'with vehicule'];

    const requestToTransmit: TableRequestResponse = {
        requestId: requestPayload.requestId,
        userId: requestPayload.userId,
        userName: requestPayload.userName,
        groupSize: requestPayload.groupSize,
        onQueuedTimestamp: requestTime,
        state: "QUEUED",
        specifics: mockUserSpecifics,
        arrivlaTime: requestPayload.arrivalTime
    };

    return await transmitViaAbly(channelName, requestName, requestToTransmit);
}

export async function cancelRequest(restaurantId: string, requestId: string) {
    /**
     * 🛡️ ATOMIC CONDITIONAL UPDATE
     * 💡 HINT FOR FUTURE STATE-DRIVEN TODO FIX:
     * To change this condition to rely on your state machine flow instead of timestamp checking,
     * you can map the ConditionExpression to check against your allowed statuses:
     * e.g., ConditionExpression: "#stateAttr = :queuedState OR #stateAttr = :processingState"
     */
    // await docClient.send(new UpdateCommand({
    //   TableName: TABLE_NAME,
    //   Key: { PK: pk, SK: sk },
    //   UpdateExpression: "SET onCancellationTimestamp = :ts",
    //   ConditionExpression: "attribute_not_exists(onPaidTimestamp)",
    //   ExpressionAttributeValues: {
    //     ":ts": timestamp,
    //   }
    // }));

    await deleteRequest(restaurantId, requestId);
}

export async function transmitRequestCancellation(
    cancelPayload: RequestCancelPayload,
    requestId: string
): Promise<boolean> {
    const clientPayload: RequestCancelClientPayload = {
        requestId: requestId
    };

    // const channelName: Record<string, string> = {
    //   RESTAURANT: `request:${userId}`,
    //   USER: `restaurant:${restaurantId}:ops`,
    // }
    let channelName;
    switch (cancelPayload.actor) {
        case 'RESTAURANT':
            channelName = `request:${cancelPayload.userId}`;
        case 'USER':
            channelName = `restaurant:${cancelPayload.restaurantId}:ops`;
    }

    const requestName = 'request-canceled';

    return await transmitViaAbly(channelName!, requestName, clientPayload);
}

export async function obtainRestaurantRequests(restaurantId: string): Promise<TableRequestResponse[]> {
    const rawItems = await queryRequestsByRestaurant(restaurantId);

    console.log(`🔍 Raw data to respond the GET request \n${JSON.stringify(rawItems)} \nFor Restaurant: ${restaurantId}`);

    // 🧹 2. Filter for active requests and transform them to match "TableRequestPayload"
    const mappedPayloads = rawItems
        .map((item) => {
            const requestId = item.SK.replace("REQ#", ""); // Strip the prefix back out to get the clean ID

            // Return the exact structure matching your client-side type definitions
            return {
                requestId: requestId,
                userId: item.userId,
                userName: item.userName,
                groupSize: item.groupSize,
                onQueuedTimestamp: item.onQueuedTimestamp,
                state: item.state,
                specifics: item.specifics,
                arrivlaTime: item.arrivlaTime // TODO: Correct the name "arrivalTimeInMinunes"
            };
        });

    console.log(`1️⃣📦  Initialized UI state feed: Found \n${JSON.stringify(mappedPayloads)} \nFor Restaurant: ${restaurantId}`);

    return mappedPayloads;
}

export async function updateRequestStatus(
    restaurantId: string,
    updatePayload: RequestUpdatePayload
): Promise<{ normalizedState: string; realtimeNotified: boolean }> {
    const normalizedState = String(updatePayload.newState); /// Necessary?

    // TODO: Check if it's a valid status
    // TODO: Before update, check that the status transition is valid

    await updateRequestState(restaurantId, updatePayload.requestId, normalizedState);

    // TODO:
    // 1. Get the active requests of the user and separate them from the current request.
    // 2. Cancel those request in DynamoBD (In MVP, it's deleting them, but then is updating the attribute "onCancelTimestamp") 
    // 3. Use the batch publish of Ably to cancel the table request of the other restaurants (In claude "AWS expert" is the code ) 

    let channelName;
    switch (normalizedState) {
        case 'ACCEPTED':  // When the restaurant notifies that the customer's request is accepted
            channelName = `request:${updatePayload.userId}`;
            break;
        case 'READY':   // When the user notifies that they want to go to the restaurant
        case 'PAY_TRIED':   // When the user notifies that it's about to pay
            channelName = `restaurant:${restaurantId}:ops`;
            break;
    }

    let realtimeNotified = false;

    if (ablyKeyWS) {
        //X const channelName = `request:${userId}`;  // In mobile -> "request:$userId"
        console.log(`1️⃣📺  Channel to emit ${channelName}`);

        const clientPayload: RequestStatusUpdateClientPayload = {
            requestId: updatePayload.requestId,
            newStatus: normalizedState,
        };

        realtimeNotified = await transmitViaAbly(
            channelName!,
            "request-status-updated", /// Consider change Message's name by a code for security 
            clientPayload,
            1
        );

        if (!realtimeNotified) {
            console.warn(`⚠️ Failed to broadcast request status update to Ably`);
        }
    } else {
        console.warn("⚠️ ABLY_API_KEY is not defined; skipping realtime broadcast.");
    }

    return { normalizedState, realtimeNotified };
}

export async function obtainActiveRequestStatuses(
    requestsToUpdate: RequestIdentificatorsPayload[]
): Promise<ActiveRequestStatus[]> {
    const requestItems = await batchGetRequests(requestsToUpdate);

    // Filter for active requests and transform them to match "TableRequestPayload"
    const mappedPayloads = requestItems
        .map((item) => {
            const requestId = item.SK.replace("REQ#", ""); // Strip the prefix back out to get the clean ID
            // const restaurantId = item.PK.replace("REST#", ""); // Strip the prefix back out to get the clean ID

            // Return the exact structure matching your client-side type definitions
            return {
                requestId: requestId,
                // restaurantId: restaurantId,
                state: item.state,
                // userId: item.userId,
                // //X userName: item.userName,
                // groupSize: item.groupSize,
                // onQueuedTimestamp: item.onQueuedTimestamp,
                // specifics: item.specifics,
                // arrivlaTime: item.arrivlaTime // TODO: Correct the name
            };
        });

    console.log(`1️⃣📦  Requested Table requests from the  \n${JSON.stringify(mappedPayloads)} \n`);

    return mappedPayloads;
}
