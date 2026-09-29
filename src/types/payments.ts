import { OrderItemPayload } from "./orders.js"
import { PresignedUrls } from "./s3Clients.js"


// --- Input types ---

export interface PaymentConfirmationPayload {
    orderId: string                 // TODO: These should be generated in backend, not in the client                   
    requestId: string           //
    restaurantId: string
    userId: string
    userName: string
    arrivalTimeInMinutes: number
    groupSize: number
    orderSelections: OrderItemPayload[]
}

export interface FinalizeOrderPayload{
  orderId: string,
  restaurantId: string
}

// --- Output types ---
export interface PaymentConfirmationResponse{
    message: string
    orderId: string
    totalPriceInCents: number
    paymentImageReferences: PresignedUrls
}


export interface Order{ /// For now, it's practically "OrderResponse" // TODO: Try to divide all the types of all features in input, output and domain (mimic is valid between interfaces) 
    userId: string
    requestId: string
    orderId: string
    userName: string
    arrivalTimeInMinutes: number
    groupSize: number
    orderSelections: OrderItemPayload[]
    totalCostInCents: number
    // lastUpdateTimestamp: number
    onPaidTimeStamp: number
    paymentImageUrl: string
}

// --- Repository types ---

export interface dishPricesDbResponse {
    SK: string,
    priceCents: number
}

export type ConfirmedOrderItem = Omit<Order, 'orderId'> & {
    PK: string;
    SK: string;

    GSIPK: string;
    GSISK: string;
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