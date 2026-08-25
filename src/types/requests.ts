export interface RequestIdentificatorsPayload {
    restaurantId: string,
    requestId: string 
}

// --- Input types ---

export interface RequestPayload{
    restaurantId: string
    userId: string
    requestId: string
    groupSize: number
    userName: string
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

export interface TableRequestPayload {
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

export interface RequestItem {
    PK: string
    SK: string
    userId: string
    userName: string
    groupSize: number
    onQueuedTimestamp: number
    state: string
    specifics: string[]
    arrivlaTime: number
}

// --- Internal types ---

export interface RequestCancelClientPayload {
    requestId: string
}

export interface RequestStatusUpdateClientPayload {
    requestId: string
    newStatus: string
}
