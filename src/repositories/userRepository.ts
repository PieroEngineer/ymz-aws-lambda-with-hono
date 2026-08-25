import { PutCommand, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../docClient";
import { TABLE_NAME } from "../k";
import { PreferenceItem, PreferencePayload } from "../types/users";

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
