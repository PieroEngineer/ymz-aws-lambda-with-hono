# What is Yummizi (ymz)?
Yummizi was a foodtech startup project that allowed restaurants to prepare diners' food while they were on their way to the establishment. Although I didn't continue with the project due to validation issues, it taught me a lot about marketing, sales, and full-stack development.

I think that the best way to be grateful for what I have is to share it. Here, I share with you what I learned by building a stable, real-time platform that connects diners with restaurants the Yummizi way.

# Sub-systems of the platform
+ [AWS Lambda with hono](https://github.com/PieroEngineer/ymz-aws-lambda-with-hono) (TS) 
+ [AWS serverless configuration with AWS SAM](https://github.com/PieroEngineer/ymz-iac-with-aws-sam) (yaml) 
+ [Client for process observability](https://github.com/PieroEngineer/ymz-admin-client-with-python) (Python) 
+ [Landing page](https://github.com/PieroEngineer/ymz-landing-page) (HTML + JS + CSS) 
+ [Restaurant Web app](https://github.com/PieroEngineer/ymz-restaurant-client-side) (TS + Vite + React) 
+ [Diner Android app](https://github.com/PieroEngineer/ymz-diner-client-side) (Kotlin) 

# Yummizi Engine Backend

Yummizi Engine is a TypeScript backend for the Yummizi restaurant and ordering
platform. It uses [Hono](https://hono.dev/) for its HTTP API and AWS services
for persistence and asset storage:

- **Amazon DynamoDB** stores users, restaurants, menus, requests, and orders.
- **Amazon S3** stores restaurant and menu assets and supports presigned uploads.
- **Ably** broadcasts request and order updates in real time.
- **AWS Lambda and API Gateway** provide the serverless runtime.
- **LocalStack** supplies local AWS service emulation for development.

## Requirements

- Node.js and npm
- Docker with the Docker Compose plugin

## Getting started (Locally)

Install the project dependencies:

```sh
npm install
```

Start LocalStack. Its initialization script creates the local DynamoDB table,
S3 bucket, Lambda function, and API Gateway:

```sh
docker compose up -d
```

Start the API in development mode:

```sh
npm run dev
```

The development server listens at `http://localhost:3000`. Check that it is
running with:

```sh
curl http://localhost:3000/
```

The health endpoint returns a JSON object with `status: "healthy"`.

### Optional: load sample data

With LocalStack running, populate the local S3 bucket and DynamoDB table with
the repository's mock restaurant, menu, and image data:

```sh
npm run seed
```

The seed script reads image files from `my_images/` and ID lists from
`my_uuids/`; run it from the repository root.

## API

All routes are mounted at the root in local development. For example,
`GET /restaurants/feed` is available at
`http://localhost:3000/restaurants/feed`.

| Area | Method | Path | Purpose |
| --- | --- | --- | --- |
| Health | `GET` | `/` | Check API health |
| Users | `POST` | `/users/:userId/create` | Create a user |
| Users | `GET` | `/users/:userId` | Get user data |
| Users | `PUT` | `/users/:userId/preferences/:prefId` | Save a preference |
| Users | `DELETE` | `/users/:userId/preferences/:prefId` | Delete a preference |
| Restaurants | `POST` | `/restaurants/:restaurantId/info/initialize` | Initialize restaurant information |
| Restaurants | `GET` | `/restaurants/:restaurantId/info` | Get restaurant information |
| Restaurants | `POST` | `/restaurants/:restaurantId/info/update` | Update restaurant information |
| Restaurants | `GET` | `/restaurants/feed?userId=...` | Get a user's restaurant feed |
| Restaurants | `GET` | `/restaurants/:restaurantId/menu` | Get a restaurant menu |
| Restaurants | `POST` | `/restaurants/:restaurantId/menu` | Synchronize menu pages and dishes |
| Restaurants | `GET` | `/restaurants/:restaurantId/payment` | Get restaurant payment details |
| Requests | `POST` | `/requests/create` | Create a request |
| Requests | `POST` | `/requests/:requestId/cancel` | Cancel one request |
| Requests | `POST` | `/requests/cancel` | Cancel a batch of requests |
| Requests | `GET` | `/requests/:restaurantId` | Get a restaurant's active requests |
| Requests | `POST` | `/requests/:restaurantId/update` | Update a request's state |
| Requests | `POST` | `/requests/active` | Get active request statuses |
| Payments / orders | `POST` | `/payments/confirm` | Confirm an order and obtain payment image URLs |
| Payments / orders | `GET` | `/payments/:restaurantId` | Get active orders for a restaurant |
| Payments / orders | `POST` | `/payments/finalize` | Finalize an order |
| Contacts | `POST` | `/contacts/feedback` | Submit feedback |
| Contacts | `POST` | `/contacts/restaurant` | Submit a restaurant contact |
| Tracking | `GET` | `/tracking/:from/:to/requests` | Get requests across restaurants for a period |
| Tracking | `GET` | `/tracking/:restaurantId/:from/:to/requests` | Get requests for one restaurant and period |
| Tracking | `GET` | `/tracking/:from/:to/orders` | Get orders across restaurants for a period |
| Tracking | `GET` | `/tracking/:restaurantId/:from/:to/orders` | Get orders for one restaurant and period |

Request and response payload types are defined under `src/types/`. The API
currently uses JSON request bodies for its write operations.

## Local AWS resources

`docker-compose.yml` starts LocalStack on `http://localhost:4566`. The
initialization script in `init-aws/setup.sh` configures:

- DynamoDB table `YummiziTable` and its secondary indexes
- S3 bucket `restaurant-assets`
- Lambda function `YummiziHonoBackend`
- API Gateway stage `prod`

The LocalStack API Gateway base URL is printed by the initialization script
and follows this pattern:

```text
http://localhost:4566/_aws/execute-api/<api-id>/prod/
```

Append an API path to this base URL to call the Lambda-backed API.

## Build and local deployment

Build the Lambda bundle:

```sh
npm run build
```

The bundle is written to `dist/index.js`. To upload it to the Lambda function
in the running LocalStack container:

```sh
npm run deploy:local
```

This command builds the bundle, packages it, and updates the
`YummiziHonoBackend` function in the `localstack_yummizi` container.

## AWS configuration

Outside development and LocalStack, the AWS SDK clients use the standard AWS
credential provider chain. Configure AWS credentials and permissions for
DynamoDB, S3, Lambda, and API Gateway as appropriate for the deployment.

The live application configuration in `src/k.ts` reads:

- `TABLE_NAME` — DynamoDB table name
- `ENV` — used to form the `YummiziGsiTable-${ENV}` index name
- `BUCKET_NAME` — S3 bucket name
- `CDN_DOMAIN` — domain used to construct public asset URLs

For local scripts, `npm run dev` and `npm run seed` set the LocalStack endpoint
automatically. Local AWS clients use the `us-east-1` region.

## Project layout

```text
src/
  routes/        HTTP route definitions
  services/      Application/business logic
  repositories/  DynamoDB access
  clients/       AWS and realtime clients
  aws/           AWS client configuration
  scripts/       Development utilities, including sample-data seeding
  types/         Request and response types
  index.ts       Hono app and Lambda handler
  server.dev.ts  Local Node.js development server
init-aws/        LocalStack initialization script
my_images/       Mock images used by the seed script
my_uuids/        Sample entity IDs used by the seed script
```

## Author

Made with 💙 by **Piero Olivas Tuesta**
