
// --- Input types ---

export interface TableRequestPayload{
    restaurantId: string
    requestId: string
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

// --- Output types ---

export interface TableRequestResponse {

    requestId: string
    userId: string
    userName: string
    groupSize: number
    onQueuedTimestamp: number
    state: string
    specifics: string[]
    arrivlaTime: number
}

export interface ActiveRequestStatus {
    requestId: string
    state: string
}

export interface CreateRequestResponse {
    message: string
    requestId: string
    realtimeNotified: boolean
}

export interface UpdateRequestResponse {
    message: string
    restaurantId: string
    requestId: string
    newState: string
    realtimeNotified: boolean
}

export interface ActiveRequestsResponse {
    statuses: ActiveRequestStatus[]
}

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

export interface RequestItem extends RequestItemData {
    PK: string
    SK: string
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
}

export interface RequestCancelClientPayload {
    requestId: string
}

export interface RequestStatusUpdateClientPayload {
    requestId: string
    newStatus: string
}

export interface RequestIdentificatorsPayload {
    restaurantId: string,
    requestId: string 
}