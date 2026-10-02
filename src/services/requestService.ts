import { transmitBatchPublishingViaAbly, transmitViaAbly } from "../clients/ablyClient.js";
import { ablyKeyWS } from "../k.js";
import { batchGetRequests, putRequest, queryActiveRequestsByRestaurant, updateBatchRequestsToDeactivate, updateRequestState, updateRequestToDeactivate } from "../repositories/requestRepository.js";
import {
    ActiveRequests,
    RequestCancelClientPayload,
    RequestCancelPayload,
    TableRequestPayload,
    RequestStatusUpdateClientPayload,
    RequestUpdatePayload,
    TableRequestResponse,
    RequestIdentificatorsPayload,
    TableRequest,
    BatchCancellationPayload,
    FilteredRequests,
    ActiveRequestsResponse,
    BatchCancellationItem,
} from "../types/requests.js";

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

export async function deactivateRequest(restaurantId: string, requestId: string) {  // TODO: Since it has different usages, add an extra paramter to know what it's for or the related data to the deactivation
    await updateRequestToDeactivate(restaurantId, requestId);
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

    const eventName = 'request-canceled';

    return await transmitViaAbly(channelName!, eventName, clientPayload);
}

export async function deactivateBatchRequests(
    cancelPayload: BatchCancellationPayload,
){
    await updateBatchRequestsToDeactivate(cancelPayload);
}

export async function transmitBatchRequestCancellationToRestaurants(
    cancelPayload: BatchCancellationPayload
) {

    const eventName = 'request-canceled';
    const batchPayload = cancelPayload.requestsToCancel.map((requestToRemove) => {
        return {    // TODO: Type this shape for the client
            // Targets the specific restaurant channel
            channels: [`restaurant:${requestToRemove.restaurantId}:ops`],
            // Attaches the custom RequestCancelClientPayload shape
            messages: [
                {
                    name: eventName, // Use your existing eventName variable here
                    data: {
                        requestId: requestToRemove.requestId
                    } as RequestCancelClientPayload
                }
            ]
        };
    });

    console.log(`🔎📡  Batch cancellation payload to transmit \n${JSON.stringify(batchPayload, null, 2)}`);

    await transmitBatchPublishingViaAbly(batchPayload);
}


export async function obtainRestaurantActiveRequests(restaurantId: string): Promise<FilteredRequests> {
    const rawItems = await queryActiveRequestsByRestaurant(restaurantId);

    console.log(`🔍 Raw data to respond the GET request \n${JSON.stringify(rawItems)} \nFor Restaurant: ${restaurantId}`);

    // 🧹 Filter for active requests and transform them to match "TableRequestPayload"
    const filteredRequests = processActiveRequests(rawItems)

    console.log(`1️⃣📩\nActive requests found\n ${JSON.stringify(filteredRequests.activeRequests)}\n Expired requests found:\n${filteredRequests.expiredRequestIds} \nFor Restaurant: ${restaurantId}`);

    return filteredRequests;
}

export async function updateRequestStatus(
    restaurantId: string,
    updatePayload: RequestUpdatePayload
): Promise<{ normalizedState: string; realtimeNotified: boolean }> {
    const normalizedState = String(updatePayload.newState); /// Necessary?

    // TODO: Check if it's a valid status
    // TODO: Before update, check that the status transition is valid

    // TODO: Check if the request didn't expired (for "QUEUED" and "ACCEPTED") 

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

    await updateRequestState(restaurantId, updatePayload.requestId, normalizedState);

    let realtimeNotified = false;

    if (ablyKeyWS) {
        console.log(`1️⃣📺  Channel to emit ${channelName}`);

        const clientPayload: RequestStatusUpdateClientPayload = {
            requestId: updatePayload.requestId,
            newStatus: normalizedState,
        };

        realtimeNotified = await transmitViaAbly(  // TODO: Create a another service for this
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
): Promise<ActiveRequests[]> {
    const requestItems = await batchGetRequests(requestsToUpdate);

    // Filter for active requests and transform them to match "TableRequestPayload"
    const mappedPayloads: ActiveRequests[] = requestItems
        .map((item) => {
            const requestId = item.SK.replace("REQ#", ""); // Strip the prefix back out to get the clean ID
            const restaurantId = item.PK.replace("REST#", ""); // Strip the prefix back out to get the clean ID

            // Return the exact structure matching your client-side type definitions
            return {
                requestId: requestId,
                restaurantId: restaurantId,
                state: item.state,
                userId: item.userId,
                // userName: item.userName,
                // groupSize: item.groupSize,
                onQueuedTimestamp: item.onQueuedTimestamp,
                // specifics: item.specifics,
                arrivalTimeInMinutes: item.arrivlaTime // TODO: Correct the name
            };
        });

    console.log(`1️⃣📦  Requested Table requests from the  \n${JSON.stringify(mappedPayloads)} \n`);

    return mappedPayloads;
}

function processActiveRequests(items: Record<string, any>[], expirationTimeMs = 1800000 /* (30 * 60 * 1000) */): FilteredRequests {    
    // Pre-allocate arrays to avoid dynamic resizing overhead during iteration
    const expiredRequestIds: BatchCancellationItem[] = [];
    const activeRequests: ActiveRequestsResponse[] = [];

    const now =  Date.now()
    
    // Single-pass classic for-loop (the fastest iteration method in V8/Node.js)
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        
        // Skip malformed records immediately if safety is a concern
        if (!item) continue; 

        // Compare timestamp and state
        const ageSinceCreation = now - (item.onQueuedTimestamp || 0);
        // TODO: const ageSinceAcceptance ... // assign a new age when we assign a "onContinueAcceptanceLocalTimestamp" in data
        const state = item.state;

        const requestId = item.SK.replace("REQ#", "")
        const restaurantId = item.PK.replace("REST#", "")

        if ((state === "QUEUED" || state === "ACCEPTED") && (ageSinceCreation) > expirationTimeMs) {   // TODO: Inlcude the "READY" and "PAID_TRIED" too later.
            expiredRequestIds.push({
                restaurantId: restaurantId,
                requestId: requestId
            });
        } else {
            activeRequests.push({
                requestId: requestId,
                userId: item.userId,
                userName: item.userName,
                groupSize: item.groupSize,
                onQueuedTimestamp: item.onQueuedTimestamp,
                state: item.state,
                specifics: item.specifics,
                arrivlaTime: item.arrivlaTime,
            });
        }
    }

    return { expiredRequestIds, activeRequests };
}