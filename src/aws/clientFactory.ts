import { S3Client } from "@aws-sdk/client-s3";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

// 🔥 IMPORTANT: Detect if we are targeting local environment or live cloud
const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;

const awsRegion = process.env.AWS_REGION || "us-east-1";
const localstackUrl = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";

/**
 * 📦 MODULAR S3 CLIENT FACTORY
 * Automatically routes traffic to LocalStack or native AWS.
 */
export const getS3Client = (): S3Client => {
  if (isLocal) {
    // 🔌 CONFIG: LocalStack requires explicit endpoints and dummy credentials
    return new S3Client({
      endpoint: localstackUrl,
      region: awsRegion,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
      // ⚠️ CRITICAL: LocalStack relies on path-style routing for local S3 buckets
      forcePathStyle: true, 
    });
  }

  // 🚀 LIVE AWS: In production, AWS natively handles IAM roles and routing
  return new S3Client({ region: awsRegion });
};

/**
 * 📦 MODULAR DYNAMODB CLIENT FACTORY
 */
export const getDynamoDBClient = (): DynamoDBClient => {
  if (isLocal) {
    return new DynamoDBClient({
      endpoint: localstackUrl,
      region: awsRegion,
      credentials: {
        accessKeyId: "test",
        secretAccessKey: "test",
      },
    });
  }

  return new DynamoDBClient({ region: awsRegion });
};