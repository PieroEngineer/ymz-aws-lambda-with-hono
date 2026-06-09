"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDynamoDBClient = exports.getS3Client = void 0;
const client_s3_1 = require("@aws-sdk/client-s3");
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
// 🔥 IMPORTANT: Detect if we are targeting local environment or live cloud
const isLocal = process.env.NODE_ENV === "development" || !!process.env.LOCALSTACK_ENDPOINT;
const awsRegion = process.env.AWS_REGION || "us-east-1";
const localstackUrl = process.env.LOCALSTACK_ENDPOINT || "http://localhost:4566";
/**
 * 📦 MODULAR S3 CLIENT FACTORY
 * Automatically routes traffic to LocalStack or native AWS.
 */
const getS3Client = () => {
    if (isLocal) {
        // 🔌 CONFIG: LocalStack requires explicit endpoints and dummy credentials
        return new client_s3_1.S3Client({
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
    return new client_s3_1.S3Client({ region: awsRegion });
};
exports.getS3Client = getS3Client;
/**
 * 📦 MODULAR DYNAMODB CLIENT FACTORY
 */
const getDynamoDBClient = () => {
    if (isLocal) {
        return new client_dynamodb_1.DynamoDBClient({
            endpoint: localstackUrl,
            region: awsRegion,
            credentials: {
                accessKeyId: "test",
                secretAccessKey: "test",
            },
        });
    }
    return new client_dynamodb_1.DynamoDBClient({ region: awsRegion });
};
exports.getDynamoDBClient = getDynamoDBClient;
