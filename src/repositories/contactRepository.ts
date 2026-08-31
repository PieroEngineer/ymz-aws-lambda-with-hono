import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { docClient } from "../clients/docClient";
import { TABLE_NAME } from "../k";
import { FeedbackItem, FeedbackPayload, RestaurantContactPayload } from "../types/contacts";

export async function putFeedback(FeedbackPayload: FeedbackPayload){
    const newFeedbackItem: FeedbackItem = {
        PK: `USER#${FeedbackPayload.userId}`,   // FIXME: I think is better to put the Feedback as partition key, because we look for set of feedbacks, not for specific user's feedback
        SK: `FEEDBACK#${crypto.randomUUID()}`,  // TODO: Try with timestamp instead of UUID

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
     const newFinalContactItem = {
        PK: `USER#${restaurantContactPayload.userId}`,
        SK: `RCONTACT#${crypto.randomUUID()}`,

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