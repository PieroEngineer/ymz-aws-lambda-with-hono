import { transmitViaAbly } from "../clients/ablyClient";
import { generateS3PresignedUrl } from "../clients/s3Client";
import { BUCKET_NAME } from "../k";
import { getAllOrders, getSpecificDishesData, putConfirmationEvent } from "../repositories/paymentRepository";
import { OrderItemPayload } from "../types/orders";
import { ConfirmedOrder, dishPrice, Order, PaymentConfirmationPayload } from "../types/payments";
import { PresignedUrls } from "../types/s3Clients";

export async function obtainAllOrders( restaurantId: string ): Promise<Order[]> {

  return await getAllOrders( restaurantId )
  
}

export async function obtainSpecificDishesData( orderSelections: OrderItemPayload[], restaurantId: string){ // TODO: Move it to restaurant service and its repo too

  return await getSpecificDishesData( orderSelections, restaurantId )
}


export async function obtainPaymentPresignedUrl( s3Key: string ) : Promise<PresignedUrls> {
  return await generateS3PresignedUrl(s3Key)
}


export async function saveConfirmationEvent( confirmationEvent:  ConfirmedOrder ){
  await putConfirmationEvent(confirmationEvent)
}

export async function transmitConfirmationToRestaurant( confirmationEvent:  ConfirmedOrder ){
  const channelName = `restaurant:${confirmationEvent.restaurantId}:ops`;
  const eventName = 'new-order-preselected'

  const { restaurantId, ...confirmationEventToTransmit } = confirmationEvent

  await transmitViaAbly(channelName, eventName, confirmationEventToTransmit)
}

/**
 * Calculates total cost in cents with O(N + M) time complexity.
 */
export function calculateTotalCost(selectedDishes: OrderItemPayload[], dishItems: dishPrice[]): number {
  const numDishItems = dishItems.length;
  const numInputItems = selectedDishes.length;
  
  // 1. Index DB results into a native Map for O(1) lookups
  const priceMap = new Map<string, number>();
  
  for (let i = 0; i < numDishItems; i++) {
    const item = dishItems[i];

    if (item.dishId !== undefined && item.priceCents !== undefined) {
      priceMap.set(item.dishId, item.priceCents);
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