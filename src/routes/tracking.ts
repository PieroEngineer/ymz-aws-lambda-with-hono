import { Hono } from "hono";
import { obtainRestaurantRequestsOfAPeriod } from "../services/requestService.js";
import { obtainAvailableRestaurantIds } from "../services/restaurantService.js";
import { RestaurantIdentification } from "../types/restaurants.js";
import { ActiveRequests } from "../types/requests.js";
import { obtainRestaurantOrdersOfAPeriod } from "../services/paymentService.js";
import { Order } from "../types/payments.js";

export const trackingRouter = new Hono();

trackingRouter.get("/:from/:to/requests", async (c) => {    // TODO (#394)
    try{
        const from = c.req.param("from");
        const to = c.req.param("to");
        
        const availableRestaurants: RestaurantIdentification[] = await obtainAvailableRestaurantIds()

        if(availableRestaurants.length !== 0){
            const getRestaurantRequestPromises = availableRestaurants.map((restaurant) => obtainRestaurantRequestsOfAPeriod(restaurant.restaurantId, from, to));
            const collectedRestaurantRequests = await Promise.all(getRestaurantRequestPromises);

            // Create one flat array to hold everything
            const restaurantRequests: ActiveRequests[] = [];

            // Highly optimized by JS engines for pushing elements sequentially
            for (const batch of collectedRestaurantRequests) {
                restaurantRequests.push(...batch);
            }

            return c.json({
                restaurantRequests: restaurantRequests
            });
        }
        else{
            return c.json({ error: "No available restaurants" }, 404);
        }

    }
    catch(error: any){
        console.error(`🚨 TRACKED RESTAURANTS REQUESTS ERROR -> ${error.message}`);
        return c.json({ error: "Internal Server Error" }, 500);
    }
})

//
trackingRouter.get("/:restaurantId/:from/:to/requests", async (c) => {  // TODO (#394): Change it by a Query that we saw somewhere
    try{
    const restaurantId = c.req.param("restaurantId");
    const from = c.req.param("from");
    const to = c.req.param("to");
    
    if (!restaurantId) { return c.json({ error: "Missing restaurantId" }, 400); }

    const restaurantRequests = await obtainRestaurantRequestsOfAPeriod(restaurantId, from, to);
    console.log(`🔎✅ Fetching restaurant requests for restaurantId ${restaurantId} from ${from} to ${to}`);

    return c.json({
        restaurantRequests: restaurantRequests
    });

    }
    catch(error: any){
        console.error(`🚨 TRACKED RESTAURANT REQUESTS ERROR -> ${error.message}`);
        return c.json({ error: "Internal Server Error" }, 500);
    }
})


trackingRouter.get("/:from/:to/orders", async (c) => {
    try{
        const from = c.req.param("from");
        const to = c.req.param("to");
        
        const availableRestaurants: RestaurantIdentification[] = await obtainAvailableRestaurantIds()

        if(availableRestaurants.length !== 0){
            const getRestaurantOrderPromises = availableRestaurants.map((restaurant) => obtainRestaurantOrdersOfAPeriod(restaurant.restaurantId, from, to));
            const collectedRestaurantOrders = await Promise.all(getRestaurantOrderPromises);

            // Create one flat array to hold everything
            const restaurantOrders: Order[] = [];

            // Highly optimized by JS engines for pushing elements sequentially
            for (const batch of collectedRestaurantOrders) {
                restaurantOrders.push(...batch);
            }

            return c.json({ 
                restaurantOrders: restaurantOrders 
            });
        }
        else{
            return c.json({ error: "No available restaurants" }, 404);
        }
    }
    catch(error: any){
        console.error(`🚨 TRACKED RESTAURANTS ORDERS ERROR -> ${error.message}`);
        return c.json({ error: "Internal Server Error" }, 500);
    }
})


trackingRouter.get("/:restaurantId/:from/:to/orders", async (c) => {  // TODO (#394): Change it by a Query that we saw somewhere
    try{
    const restaurantId = c.req.param("restaurantId");
    const from = c.req.param("from");
    const to = c.req.param("to");
    
    if (!restaurantId) { return c.json({ error: "Missing restaurantId" }, 400); }

    const restaurantOrders = await obtainRestaurantOrdersOfAPeriod(restaurantId, from, to);
    console.log(`🔎✅ Fetching restaurant Orders for restaurantId ${restaurantId} from ${from} to ${to}`);

    return c.json({
        restaurantOrders: restaurantOrders
    });
    
    }
    catch(error: any){
        console.error(`🚨 TRACKED RESTAURANT ORDERS ERROR -> ${error.message}`);
        return c.json({ error: "Internal Server Error" }, 500);
    }
})