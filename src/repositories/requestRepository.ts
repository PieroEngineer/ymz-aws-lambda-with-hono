import { docClient } from "../docClient";
import { TABLE_NAME } from "../k";
import { RequestPayload } from "../types/requests";
import { PutCommand } from "@aws-sdk/lib-dynamodb";


export async function putRequest( requestPayload: RequestPayload, requestTime: number ) {
    const {restaurantId, requestId, ...requestData } = requestPayload

    const newRequestItem = {
          PK: `REST#${restaurantId}`,
          SK: `REQ#${requestId}`,
    
          ...requestData
        };
    
        console.log('💽  Request Item to save in DynamoDB', JSON.stringify(newRequestItem , null, 2), '\nfor restaurant ', restaurantId);
        
        // Execute atomic database insertion (System of Record First!)
        await docClient.send(new PutCommand({
          TableName: TABLE_NAME,
          Item: newRequestItem,
        }));
}