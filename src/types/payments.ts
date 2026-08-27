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


export interface Order{ /// For now, it's practically "OrderResponse" // TODO: Try to divide all the types of all features in input, output and domain (mimic is valid between interfaces) 
    userId: string,
    requestId: string,
    userName: string,
    arrivalTimeInMinutes: number,
    groupSize: number,
    orderSelections: OrderItemPayload[],
    totalCostInCents: number,
    // lastUpdateTimestamp: number,
    onPaidTimeStamp: number,
    paymentImageUrl: string
}

// --- Repository types ---

export interface dishPricesDbResponse {
    SK: string,
    priceCents: number
}

export type ConfirmedOrderItem = Omit<Order, 'requestId'> & {
    PK: string;
    SK: string;
}

// --- Internal types ---

export interface ConfirmedOrder extends Order {
    restaurantId: string,
    paymentImageUrl: string
}



export interface dishPrice {
    dishId: string,
    priceCents: number
}