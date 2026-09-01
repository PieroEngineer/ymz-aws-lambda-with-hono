
// TODO: npm install dynamodb-geo-v3

// import { GeoDataManager, GeoDataManagerConfiguration } from "dynamodb-geo-v3";
// import { getDynamoDBClient } from "../aws/clientFactory";
// import { TABLE_NAME } from "../k";

// // 1. Initialize the standard AWS SDK v3 DynamoDB Client
// // In Lambda environments, it automatically picks up credentials from the IAM Role.

// const rawDynamo = getDynamoDBClient();
    
// // const ddbClient = new DynamoDBClient({ 
// //   region: process.env.AWS_REGION || "us-east-1" 
// // });


// // 3. Create the Geo Configuration
// const geoConfig = new GeoDataManagerConfiguration(rawDynamo as any, TABLE_NAME);    /// Check if the generic parsing works

// // 4. Map the configuration to work with your Single Table GSI Setup
// geoConfig.geohashIndexName = "geohash-index"; // The name of your GSI

// // Custom Attribute Mappings
// geoConfig.hashKeyAttributeName = "hashKey";   // The numeric grid bucket attribute name
// geoConfig.geohashAttributeName = "geohash";   // The unique geohash string attribute name
// geoConfig.geoJsonAttributeName = "geoJson";   // The geographic point metadata attribute name

// // 5. Set the Shape Control (The Sweet Spot for 1km - 10km radius searches)
// geoConfig.hashKeyLength = 5; 

// // 6. Instantiate the GeoDataManager
// export const geoManager = new GeoDataManager(geoConfig);
