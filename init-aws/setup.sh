#!/usr/bin/env bash

# 1. Configuration Constants
TABLE_NAME="YummiziTable"
GSI_TABLE_NAME="YummiziGsiTable"
GSI2_TABLE_NAME="YummiziGsi2Table"
BUCKET_NAME="restaurant-assets"
REGION="us-east-1"
STAGE="prod"
API_NAME="YummiziREST_API"
LAMBDA_NAME="YummiziHonoBackend"

echo "🏗️  Starting Single-Table & REST API Proxy Construction (Free Tier Compliant)..."

# 2. Infrastructure: DynamoDB & S3 Creation
echo "📦 Creating DynamoDB Single-Table and the GSI table..."
awslocal dynamodb create-table \
    --table-name $TABLE_NAME \
    --attribute-definitions \
        AttributeName=PK,AttributeType=S \
        AttributeName=SK,AttributeType=S \
        AttributeName=GSIPK,AttributeType=S \
        AttributeName=GSISK,AttributeType=S \
        AttributeName=GSI2PK,AttributeType=S \
        AttributeName=GSI2SK,AttributeType=S \
    --key-schema \
        AttributeName=PK,KeyType=HASH \
        AttributeName=SK,KeyType=RANGE \
    --global-secondary-indexes \
        "[
            {
                \"IndexName\": \"$GSI_TABLE_NAME\",
                \"KeySchema\": [
                    {\"AttributeName\":\"GSIPK\",\"KeyType\":\"HASH\"},
                    {\"AttributeName\":\"GSISK\",\"KeyType\":\"RANGE\"}
                ],
                \"Projection\": {
                    \"ProjectionType\": \"ALL\"
                }
            },
            {
                \"IndexName\": \"$GSI2_TABLE_NAME\",
                \"KeySchema\": [
                    {\"AttributeName\": \"GSI2PK\", \"KeyType\": \"HASH\"},
                    {\"AttributeName\": \"GSI2SK\", \"KeyType\": \"RANGE\"}
                ],
                \"Projection\": {
                    \"ProjectionType\": \"KEYS_ONLY\"
                }
            }
        ]" \
    --billing-mode PAY_PER_REQUEST \
    --region $REGION

echo "🪣 Creating S3 Bucket for Assets..."
awslocal s3 mb s3://$BUCKET_NAME --region $REGION

echo "🔒 Applying CORS permissions to S3 Bucket..."
awslocal s3api put-bucket-cors \
  --bucket $BUCKET_NAME \
  --cors-configuration '{
    "CORSRules": [
      {
        "AllowedHeaders": ["*"],
        "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
        "AllowedOrigins": ["*"],
        "ExposeHeaders": ["ETag"]
      }
    ]
  }' \
  --region $REGION

# 3. Dummy Placeholder Lambda Creation
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

# 4. Gateway: REST API (v1) Configuration with a Greedy Proxy
echo "🌐 Launching REST API Gateway Catch-All Pipeline..."
API_ID=$(awslocal apigateway create-rest-api --name "$API_NAME" --query "id" --output text --region $REGION)
PARENT_ID=$(awslocal apigateway get-resources --rest-api-id $API_ID --query "items[0].id" --output text --region $REGION)

# 🚇 CREATE A GREEDY PROXY PATH ({proxy+}) TO CATCH ALL TRAFFIC FOR HONO
PROXY_RES_ID=$(awslocal apigateway create-resource \
    --rest-api-id $API_ID \
    --parent-id $PARENT_ID \
    --path-part "{proxy+}" \
    --query "id" \
    --output text \
    --region $REGION)

# Setup ANY HTTP method integration mapping directly to our Lambda
awslocal apigateway put-method \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RES_ID \
    --http-method ANY \
    --authorization-type "NONE" \
    --region $REGION

awslocal apigateway put-integration \
    --rest-api-id $API_ID \
    --resource-id $PROXY_RES_ID \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region $REGION

# 🚀 DEPLOYMENT: Create deployment stage
awslocal apigateway create-deployment --rest-api-id $API_ID --stage-name $STAGE --region $REGION

echo "-----------------------------------------------------------"
echo "✅ INFRASTRUCTURE CONSTRUCTION COMPLETE"
echo "📍 API ID: $API_ID"
echo "🔗 Unified Base URL: http://localhost:4566/_aws/execute-api/$API_ID/$STAGE/"
echo "💡 Use this Base URL for your mobile app! Add any route at the end: /feed, /requests, etc."
echo "-----------------------------------------------------------"

# Pastung the ID
echo "$API_ID" > /etc/localstack/init/ready.d/api_id.txt