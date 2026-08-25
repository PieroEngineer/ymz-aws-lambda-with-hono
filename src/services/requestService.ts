import { putRequest as putRequest } from "../repositories/requestRepository";
import { RequestPayload } from "../types/requests";


export async function saveRequest( requestPayload: RequestPayload) {
    
    const requestTime =  Date.now()

    return await putRequest( requestPayload, requestTime )
} 