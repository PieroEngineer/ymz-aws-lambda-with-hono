import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../clients/docClient.js";
import { TABLE_NAME } from "../k.js";
import { FeedbackItem, FeedbackPayload, RestaurantContactPayload } from "../types/contacts.js";

export async function putFeedback(FeedbackPayload: FeedbackPayload){
    const currentTimestamp = new Date().toISOString();

    const newFeedbackItem: FeedbackItem = {
        PK: `FEEDBACK`,
        SK: `TIMESTAMP#${currentTimestamp}`,

        userId: FeedbackPayload.userId,
        requestId: FeedbackPayload.requestId,
        conformDegree: FeedbackPayload.conformDegree,
        description: FeedbackPayload.description
    }

    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newFeedbackItem,
    }));

}

export async function putRestaurantContact(restaurantContactPayload: RestaurantContactPayload){
    const currentTimestamp = new Date().toISOString();
    const newFinalContactItem = {   // TODO: Include a timestamp
        PK: `RCONTACT`,
        SK: `TIMESTAMP#${currentTimestamp}`,

        userId: restaurantContactPayload.userId,
        restaurantName: restaurantContactPayload.restaurantName,
        restaurantContact: restaurantContactPayload.restaurantContact,
        restaurantComment: restaurantContactPayload.restaurantComment
    }

    console.log('💽 Contact Item to save in DynamoDB', JSON.stringify(newFinalContactItem , null, 2));

    // Execute atomic database insertion (System of Record First!)
    await docClient.send(new PutCommand({
        TableName: TABLE_NAME,
        Item: newFinalContactItem,
    }));
}