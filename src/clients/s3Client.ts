import { getS3Client } from "../aws/clientFactory.js";
import { isLocal } from "../aws/clientFactory.js";
import { BUCKET_NAME } from "../k.js";
import { PresignedUrls } from "../types/s3Clients.js";
import { PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand } from "@aws-sdk/client-s3"; // 📦 Native S3 actions
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; // 🔑 Presign signing engines

const s3Client = getS3Client();


export async function generateS3PresignedUrl( s3Key: string ) : Promise<PresignedUrls> {
    // 🕒 CACHE BUSTING: Generate a standard Unix epoch timestamp (in seconds)
      const unixEpoch = Math.floor(Date.now() / 1000);
    
      if(!BUCKET_NAME) {
        throw new Error("🚩📑  BUCKET_NAME is undefined. Please check your environment configuration.");
      }

      // 🗺️ DYNAMIC S3 RESOLUTION: Switches seamlessly between LocalStack and AWS Cloud grids
      const s3BaseUrl = isLocal 
        ? `http://localhost:4566/${BUCKET_NAME}`
        : `https://${process.env.CDN_DOMAIN}/${s3Key}?v=${unixEpoch}`;
        // : `https://${process.env.BUCKET_NAME}.s3.us-east-1.amazonaws.com`;

      // 🎯 COMBINED SOLUTION: The database saves the static path + the dynamic timestamp version parameter
      //X const publicUrl = `${s3BaseUrl}/${s3Key}?v=${unixEpoch}`; // Redundant
      const publicUrl = s3BaseUrl;
    
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

/** Deletes a single object. Idempotent: succeeds even if the key doesn't exist. */
export async function deleteS3Object(s3Key: string): Promise<void> {
  // assertValidKey(s3Key);
  await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: s3Key }));
}

/** Deletes up to 1000 objects per request (one HTTP call per chunk). */
export async function deleteS3Objects(s3Keys: string[]): Promise<void> {  // TODO: It's 
  // s3Keys.forEach(assertValidKey);
  for (let i = 0; i < s3Keys.length; i += 1000) {
    const chunk = s3Keys.slice(i, i + 1000);
    const res = await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: BUCKET_NAME,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      })
    );
    if (res.Errors?.length) {
      throw new Error(`🚩 Failed to delete: ${JSON.stringify(res.Errors)}`);
    }
  }
}

export function temporalS3extractorFromUrl(url: string){
  // 1. Remove "https://" from the beginning
  let startIdx = url.startsWith("https://") ? 8 : 0;

  // 2. Find the first "/" after the protocol
  const firstSlashIdx = url.indexOf("/", startIdx);
  if (firstSlashIdx === -1) return ""; // No path found
  
  // Move index past the "/"
  startIdx = firstSlashIdx + 1;

  // 3. Find the first "?v=" after the path starts
  const queryIdx = url.indexOf("?v=", startIdx);
  
  // 4. Return the sliced result
  if (queryIdx === -1) {
    return url.slice(startIdx);
  }
  return url.slice(startIdx, queryIdx);
}

// const IMAGES_PREFIX = "images/";

// /** Extracts the S3 key from a stored public URL (works with or without ?v=). */
// export function s3KeyFromPublicUrl(publicUrl: string): string {
//   const key = decodeURIComponent(new URL(publicUrl).pathname.replace(/^\//, ""));
//   // LocalStack URLs look like /bucket-name/images/...; strip the bucket segment
//   return isLocal && BUCKET_NAME ? key.replace(new RegExp(`^${BUCKET_NAME}/`), "") : key;
// }

// function assertValidKey(s3Key: string): void {
//   if (!BUCKET_NAME) {
//     throw new Error("🚩 BUCKET_NAME is undefined. Please check your environment configuration.");
//   }
//   if (!s3Key.startsWith(IMAGES_PREFIX) || s3Key.includes("..")) {
//     throw new Error(`🚩 Refusing to delete key outside "${IMAGES_PREFIX}": ${s3Key}`);
//   }
// }