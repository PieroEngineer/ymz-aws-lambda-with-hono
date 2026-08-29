// --- Input types ---

export interface RestaurantInitializePayload {
    restaurantName: string
    latitude: number
    longitude: number
    dishesToShowUrlsRequired: [boolean, boolean, boolean]
    phoneNumberToPay: string
    phoneNumberToContact: string
}

export interface RestaurantUpdatePayload {
    restaurantName: string
    logoUrlRequired: boolean
    latitude: number
    longitude: number
    dishesToShowUrlsRequired: [boolean, boolean, boolean]
    phoneNumberToPay: string
    phoneNumberToContact: string
    paymentQrUrlsRequired: boolean
}

export interface MenuSyncPayload {
    menuPages: MenuPageSyncInput[]
    dishes: DishSyncInput[]
}

export interface MenuPageSyncInput {
    pageId: string
    action: string
    pageNumber?: number
    updatedFields?: Record<string, unknown>
}

export interface DishSyncInput {
    id: string
    action: string
    name?: string
    priceCents?: number
    prepTime?: number
    isOutOfStock?: boolean
    menuPageId?: string
    coordinateXInMenu?: number
    coordinateYInMenu?: number
    description?: string
    imageUrl?: string
    updatedFields?: Record<string, unknown>
}

// --- Output types ---

export interface PresignedUrlMapping {  // TODO: Move to interfaces
    pageId: string;
    uploadUrl: string; // Temporary token URL for client PUT request
    publicUrl: string; // The permanent public read URL saved in DB
}

export interface SyncDataFirstResponse {
    message: string;
    presignedUrls: PresignedUrlMapping[];
}

export interface RestaurantInfoResponse {
    restaurantId: string
    restaurantName: string
    logoUrl: string
    latitude: number
    longitude: number
    openTime?: string
    closeTime?: string
    dishesToShowUrls: string[]
    phoneNumberToPay: string
    phoneNumberToContact: string
    paymentQrUrl: string
    isInitialized: boolean
}

export interface RestaurantInitializeResponse {
    logoPresignedUrl: string
    dishesToShowPresignedUrls: string[]
    paymentQrPresignedUrl: string
}

export interface FeedItem {
    id: string
    name: string
    logoUrl: string
    sectionType: string
    dishesToShowUrls: string[]
    latitude: number
    longitude: number
    phoneNumberToContact: string
}

export interface MenuPage {
    pageId: string
    imageUrl: string
    pageNumber: number
}

export interface Dish {
    id: string
    name: string
    imageUrl: string
    priceCents: number
    prepTime: number
    isOutOfStock: boolean
    menuPageId: string
    coordinateXInMenu: number
    coordinateYInMenu: number
    createdAt: number
    description: string
}

export interface MenuResponse {
    menuPages: MenuPage[]
    dishes: Dish[]
}

export interface PaymentInfoResponse {
    phoneNumberToPay: string
    phoneNumberToContact: string
    paymentQrUrl: string
}

// --- Repository types ---

export interface RestaurantDataToUpdate {
    name: string,
    logoUrl?: string,
    latitude: number,
    longitude: number,
    // openTime: openTime,
    // closeTime: closeTime,
    dishesToShowUrl1?: string,
    dishesToShowUrl2?: string,
    dishesToShowUrl3?: string,
    phoneNumberToPay: string,
    phoneNumberToContact: string,
    paymentQrUrl?: string,
}

export interface RestaurantMetadataData {
    name: string
    logoUrl: string
    latitude: number
    longitude: number
    dishesToShowUrl1: string
    dishesToShowUrl2: string
    dishesToShowUrl3: string
    phoneNumberToPay: string
    phoneNumberToContact: string
    paymentQrUrl: string
    isOpen: boolean
    isInitialized: boolean
}
