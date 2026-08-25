// --- Input types ---

export interface PreferencePayload {
    title?: string
    description?: string
    color?: string
    createdAt?: number | string
}



// --- Output types ---





// --- Repository types ---

export interface PreferenceItem {
    PK: string
    SK: string
    userId: string
    prefId: string
    title?: string
    description?: string
    color?: string
    createdAt?: number
}
