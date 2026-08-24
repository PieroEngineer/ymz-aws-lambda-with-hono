import { putFeedback, putRestaurantContact } from "../repositories/contactRepository";
import { FeedbackPayload, RestaurantContactPayload } from "../types/contacts";


export async function saveFeedback(body: FeedbackPayload){
    if (!body.userId) {
        throw new Error("Missing userId");
        // return c.json({ error: "Missing userId" }, 400);
    }

    await putFeedback(body)
}

export async function saveRestaurantContact(body: RestaurantContactPayload){
    // TODO: Check if it's empty

   await putRestaurantContact(body)

}
