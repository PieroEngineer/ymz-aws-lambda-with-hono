#!/usr/bin/env bash

# 1. Configuration Constants
TABLE_NAME="YummiziTable"
BUCKET_NAME="restaurant-assets"
REGION="us-east-1"
STAGE="prod"
API_NAME="YummiziHTTP_API"
LAMBDA_NAME="YummiziHonoBackend"

echo "🏗️  Starting Single-Table & HTTP API Proxy Construction..."

# 2. Infrastructure: DynamoDB & S3 Creation
echo "📦 Creating DynamoDB Single-Table..."
awslocal dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION

echo "🪣 Creating S3 Bucket for Assets..."
awslocal s3 mb s3://$BUCKET_NAME --region $REGION

# 3. Dummy Placeholder Lambda Creation
# 💡 NOTE: We create a structural placeholder so API Gateway has something to point to.
# We will overwrite this code directly from our Hono project workspace as we write the code!
echo "⚡ Provisioning Modular Lambda Routing Pipeline..."
mkdir -p /tmp/dummy-lambda
echo "exports.handler = async () => ({ statusCode: 200, body: 'Hono Pipeline Booting...' });" > /tmp/dummy-lambda/index.js
cd /tmp/dummy-lambda && zip -q handler.zip index.js && cd - > /dev/null

LAMBDA_ARN=$(awslocal lambda create-function \
    --function-name "$LAMBDA_NAME" \
    --runtime nodejs20.x \
    --role arn:aws:iam::000000000000:role/lambda-role \
    --handler index.handler \
    --zip-file "fileb:///tmp/dummy-lambda/handler.zip" \
    --query "FunctionArn" \
    --output text \
    --region $REGION)

rm -rf /tmp/dummy-lambda

# 4. Gateway: Cheap, High-Speed HTTP API (v2) Configuration
echo "🌐 Launching HTTP API Gateway V2 Pipeline..."
API_ID=$(awslocal apigatewayv2 create-api \
    --name "$API_NAME" \
    --protocol-type HTTP \
    --query "ApiId" \
    --output text \
    --region $REGION)

# 🛠️ INTEGRATION: Tie API Gateway to our single monolithic Hono Lambda function
INTEGRATION_ID=$(awslocal apigatewayv2 create-integration \
    --api-id "$API_ID" \
    --integration-type AWS_PROXY \
    --integration-uri "$LAMBDA_ARN" \
    --payload-format-version "2.0" \
    --query "IntegrationId" \
    --output text \
    --region $REGION)

# 🚇 GREEDY ROUTE: Capture ALL traffic ($default) and funnel it into the single Hono Router
awslocal apigatewayv2 create-route \
    --api-id "$API_ID" \
    --route-key "$default" \
    --target "integrations/$INTEGRATION_ID" \
    --region $REGION

# 🚀 DEPLOYMENT: Activate the environment stage
awslocal apigatewayv2 create-stage \
    --api-id "$API_ID" \
    --stage-name "$STAGE" \
    --auto-deploy \
    --region $REGION

echo "-----------------------------------------------------------"
echo "✅ INFRASTRUCTURE CONSTRUCTION COMPLETE"
echo "📍 API ID: $API_ID"
echo "🔗 Unified Base URL: http://localhost:4566/_aws/execute-api/$API_ID/$STAGE/"
echo "💡 The single proxy handles all variations: /feed, /requests, /users, etc."
echo "-----------------------------------------------------------"