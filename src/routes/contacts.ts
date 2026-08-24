import { Hono } from "hono";
import { saveFeedback, saveRestaurantContact } from "../services/contactService.js";
import { FeedbackPayload, RestaurantContactPayload } from "../types/contacts.js";

export const contactsRouter = new Hono();

contactsRouter.post("/feedback", async (c) =>{
    try{
        const body: FeedbackPayload = await c.req.json().catch(() => ({}));

        await saveFeedback(body)    
        console.log('✅💽 Feedback Item saved in DynamoDB successfully');

        return c.json({
            message: "Feedback saved successfully", /// Put in an interface
        }, 201);

    }
    catch (error: any) {
        console.error(`🚨 SAVE FEEDBACK ERROR: ${error.message}`);
        return c.json({ error: error.message || "Internal Server Error" }, 500);
    }
})

contactsRouter.post("/restaurant", async (c) =>{
    try{
        const body: RestaurantContactPayload = await c.req.json().catch(() => ({}));

        await saveRestaurantContact(body)
        console.log('✅💽 Feedback Item saved in DynamoDB successfully');

      return c.json({
        message: "Contact saved successfully",
      }, 201);

    }
    catch (error: any) {
        console.error(`🚨 SAVE CONTACT ERROR: ${error.message}`);
        return c.json({ error: error.message || "Internal Server Error" }, 500);
    }
})