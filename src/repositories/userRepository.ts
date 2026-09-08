import { PutCommand, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import { PreferenceItem, PreferencePayload, User, UserItem } from "../types/users.js";
import { docClient } from "../clients/docClient.js";
import { TABLE_NAME } from "../k.js";

export async function putPreference(userId: string, prefId: string, body: PreferencePayload) {
    const pk = `USER#${userId}`;
    const sk = `PREF#${prefId}`;

    // 📝 Prepare the single-table item schema matching Kotlin data models
    const preferenceItem: PreferenceItem = {
        PK: pk,
        SK: sk,
        userId: userId, // Redundant but useful for GSIs later
        prefId: prefId,
        title: body.title,
        description: body.description,
        color: body.color,
        createdAt: body.createdAt ? Number(body.createdAt) : undefined // Maps Kotlin Long timestamp cleanly
    };

    // ⚡ Execute Atomic Upsert (replaces entire object block if matching keys are targeted)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: preferenceItem
    }));
}

export async function deletePreference(userId: string, prefId: string) {
    const pk = `USER#${userId}`;
    const sk = `PREF#${prefId}`;

    // ⚡ Execute atomic delete operation against targeted key coordinate
    await docClient.send(new DeleteCommand({
        TableName: TABLE_NAME,
        Key: { PK: pk, SK: sk }
    }));
}

export async function putUser( newUser: User){
    const { userId, ...userData } = newUser

    const pk = `USER#${userId}`;
    const sk = 'METADATA';

    const userItem: UserItem = {
        PK: pk,
        SK: sk,

        ...userData
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: userItem
    }));
}

export async function getUserMetadata(userId: string): Promise<User>{
    const command = new GetCommand({
        TableName: TABLE_NAME,
        Key: {
            PK: `USER#${userId}`,
            SK: 'METADATA'
        },
        // Set to true only if you strictly need the absolute latest write
        ConsistentRead: false
    });

    const response = await docClient.send(command);
    const userItem = response.Item as UserItem;

    if (!userItem) {
        throw new Error(`User with ID ${userId} not found`);
    }
    else{
        const { PK, SK, ...userData } = userItem;
        return {
            userId: userId,
            ...userData
        }; 
    }
}
