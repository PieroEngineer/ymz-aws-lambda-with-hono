import { getS3Client } from "../aws/clientFactory";
import { BUCKET_NAME } from "../k";
import { PresignedUrls } from "../types/s3Clients";
import { PutObjectCommand } from "@aws-sdk/client-s3"; // 📦 Native S3 actions
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // 🔑 Presign signing engines

const s3Client = getS3Client();


export async function generateS3PresignedUrl( s3Key: string ) : Promise<PresignedUrls> {
    // 🕒 CACHE BUSTING: Generate a standard Unix epoch timestamp (in seconds)
      const unixEpoch = Math.floor(Date.now() / 1000);
    
      // 🎯 COMBINED SOLUTION: The database saves the static path + the dynamic timestamp version parameter
      const s3BaseUrl = `http://localhost:4566/${BUCKET_NAME}`
      const publicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`;
    
      // 🛠️ ASSET SEPARATED HANDSHAKE CHECK: Craft a temporary cryptographic upload token signature URL
      const uploadUrl = await getSignedUrl(
        s3Client,
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: s3Key,
          ContentType: "image/webp" // Enforces binary media type constraints
        }),
        { expiresIn: 900 } // URL token token expires safely in 15 minutes
      );

      return {
        publicUrl,
        uploadUrl
      }
}