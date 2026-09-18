// --- Input types ---

export type FeedbackLevelToken =  'BAD' | 'NEUTRAL' | 'GOOD' | 'VERY_GOOD'

export interface FeedbackPayload{
    userId: string, 
    requestId: string, 
    conformDegree: FeedbackLevelToken, 
    description: string 
}

export interface RestaurantContactPayload{
    userId: string
    restaurantName: string
    restaurantContact: string
    restaurantComment: string
}



// --- Output types ---





// --- Repository types ---

export interface FeedbackItem{
    PK: string
    SK: string
    userId: string,
    requestId: string
    conformDegree: FeedbackLevelToken
    description: string
}
