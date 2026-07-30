import { OrderItemPayload } from "../types/orderTypes";

/**
 * Calculates total cost in cents with O(N + M) time complexity.
 */
export function calculateTotalCost(selectedDishes: OrderItemPayload[], dynamoDbResponsesWithPrices: Record<string, any>[]): number {
  const numDbItems = dynamoDbResponsesWithPrices.length;
  const numInputItems = selectedDishes.length;
  
  // 1. Index DB results into a native Map for O(1) lookups
  const priceMap = new Map<string, number>();
  
  for (let i = 0; i < numDbItems; i++) {
    const item = dynamoDbResponsesWithPrices[i];
    const dishId = item.SK.replace("RESOURCE#DISH#", "")

    if (item && dishId !== undefined && item.priceCents !== undefined) {
      priceMap.set(dishId, item.priceCents);
    }
  }

  let totalCents = 0;

  // 2. Compute total using a highly optimized, single-pass traditional loop
  for (let j = 0; j < numInputItems; j++) {
    const input = selectedDishes[j];
    const price = priceMap.get(input.dishId);
    
    if (price !== undefined) {
      totalCents += input.quantity * price;
    }
  }

  return totalCents;
}