
// --- Internal types ---


// --- Input types ---

export interface OrderItemPayload{ 
  dishId: string
  dishName: string  // TODO: Change by "selectionName"
  quantity: number
  historicalUnitPriceInCents: number /// Necessary?
  complementaryDishId: string
}


// --- output types ---
