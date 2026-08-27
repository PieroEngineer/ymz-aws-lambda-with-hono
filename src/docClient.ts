import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { getDynamoDBClient } from "./aws/clientFactory";

const rawDynamo = getDynamoDBClient();

// 🚀 WRAP DYNAMODB CLIENT FOR COMFORTABLE PLAIN-JSON USAGE (Saves us from writing manual marshalling code)
export const docClient = DynamoDBDocumentClient.from(rawDynamo, {
  marshallOptions: { removeUndefinedValues: true },
});