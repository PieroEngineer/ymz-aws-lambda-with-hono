import { OrderItemPayload } from "./orders"
import { PresignedUrls } from "./s3Clients"


// --- Input types ---

export interface PaymentConfirmationPayload {
    restaurantId: string
    userId: string
    requestId: string
    userName: string
    arrivalTimeInMinutes: number
    groupSize: number
    orderSelections: OrderItemPayload[]
}

// --- Output types ---
export interface PaymentConfirmationResponse{
    message: string
    requestId: string
    totalPriceInCents: number
    paymentImageReferences: PresignedUrls
}


export interface Order{
    
    userId: string,
    requestId: string,
    userName: string,
    arrivalTimeInMinutes: number,
    groupSize: number,
    orderSelections: OrderItemPayload[],
    totalCostInCents: number,
    lastUpdateTimestamp: number,
    onPaidTimeStamp: number
}

// --- Repository types ---

export interface dishPricesDbResponse {
    SK: string,
    priceCents: number
}

export interface ConfirmationEventItem{
    PK: string,
    SK: string,

    lastUpdateTimestamp: number
    userName: string
    userId: string
    orderSelections: OrderItemPayload[]
    arrivalTimeInMinutes: number
    groupSize: number
    totalCostInCents: number
    onPaidTimeStamp: number
}


// --- Internal types ---

export interface ConfirmedOrder extends Order {
    restaurantId: string,
}

export interface dishPrice {
    dishId: string,
    priceCents: number
}