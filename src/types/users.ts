// --- Input types ---

export interface PreferencePayload {
    title?: string
    description?: string
    color?: string
    createdAt?: number | string
}

export type UserCreationPayload = Pick<User, 'username'>;

// --- Output types ---

export interface UserDataResponse {
    username: string
}

// --- Domain types ---

export interface User{
    userId: string,
    username: string,
    creationTimestamp: number
}


// --- Repository types ---

export type UserItem  = Omit<User, 'userId'> & {
    PK: string,
    SK: string
}

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
