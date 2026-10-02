
// --- Input types ---

export interface BatchCancellationPayload {
    requestsToCancel: BatchCancellationItem[]
}

export interface BatchCancellationItem {
    restaurantId: string
    requestId: string
}

export interface TableRequestPayload{
    restaurantId: string
    requestId: string   // TODO: It shouldn't be here because the request ID should be generated here in the backend
    userId: string
    userName: string
    groupSize: number
    arrivalTime: number
}

export interface RequestCancelPayload {
    restaurantId: string
    userId: string
    actor: string
}

export interface RequestUpdatePayload {
    requestId: string
    newState: string
    userId: string
}

export interface ActiveRequestsPayload {
    requestsToUpdate: RequestIdentificatorsPayload[]
}

export interface RequestIdentificatorsPayload {
    restaurantId: string,
    requestId: string 
}

// --- Output types ---

export interface TableRequestResponse {
    requestId: string
    userId: string
    userName: string
    groupSize: number
    onQueuedTimestamp: number
    state: string   // TODO: Create a type token to uniformized this 
    specifics: string[]
    arrivlaTime: number
}

export interface ActiveRequests {
    requestId: string
    restaurantId: string
    state: string
    userId: string
    onQueuedTimestamp: number
    arrivalTimeInMinutes: number // TODO: Correct the name
}

export interface CreateRequestResponse {
    message: string
    requestId: string
    realtimeNotified: boolean
    onQueuedTimestamp: number
}

export interface UpdateRequestResponse {
    message: string
    restaurantId: string
    requestId: string
    newState: string
    realtimeNotified: boolean
}

export type ActiveRequestsResponse = Omit<TableRequest, 'restaurantId'>

// --- Repository types ---

export interface RequestItemData {
    userId: string
    userName: string
    groupSize: number
    onQueuedTimestamp: number
    state: string
    specifics: string[]
    arrivlaTime: number
}

export interface NewRequestItem extends RequestItemData {
    PK: string
    SK: string
    GSIPK: string
    GSISK: string
}

// --- Internal types ---

export interface TableRequest {
    restaurantId: string,
    requestId: string,
    userId: string,
    userName: string,
    groupSize: number,
    onQueuedTimestamp: number,
    state: string,  // TODO: Use a token for this
    specifics: string[],
    arrivlaTime: number,
    //onRemoveTimeStamp?: number // TODO
}

export interface RequestCancelClientPayload {
    requestId: string
}

export interface RequestStatusUpdateClientPayload {
    requestId: string
    newStatus: string
}


export interface FilteredRequests {
    expiredRequestIds: BatchCancellationItem[];
    activeRequests: ActiveRequestsResponse[];
}