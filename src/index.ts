import { Hono } from "hono";
import { getS3Client } from "./aws/clientFactory.js";
import { ListBucketsCommand } from "@aws-sdk/client-s3";

const app = new Hono();

// 🔌 Initialize our cloud clients seamlessly
const s3 = getS3Client();

/**
 * 🛰️ ROUTE: Get all local or cloud S3 buckets
 */
app.get("/buckets", async (c) => {
  try {
    // Execute command using our adapted client
    const response = await s3.send(new ListBucketsCommand({}));
    const bucketNames = response.Buckets?.map(b => b.Name) || [];
    
    return c.json({
      success: true,
      environment: process.env.NODE_ENV || "development",
      buckets: bucketNames,
    });
  } catch (error: any) {
    // 🚨 ERROR HANDLING: Clean up messages for the mobile client
    return c.json({ 
      success: false, 
      message: error.message 
    }, 500);
  }
});

export default app;