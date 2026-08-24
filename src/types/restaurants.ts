export interface RestaurantDataToUpdate{
      name: string,
      logoUrl?: string,
      latitude: number,
      longitude: number,
      // openTime: openTime,
      // closeTime: closeTime,
      dishesToShowUrl1?: string,      
      dishesToShowUrl2?: string,
      dishesToShowUrl3?: string,
      phoneNumberToPay: string,
      phoneNumberToContact: string,
      paymentQrUrl?: string,
    }