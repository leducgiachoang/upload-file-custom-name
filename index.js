const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { BUCKET_NAME, REGION, S3_ASSET_URL } = require("./configs");

const s3Client = new S3Client({ region: REGION });

exports.handler = async (event) => {
  try {
    const queries = event.queryStringParameters || {};
    const type = queries.type;
    const folder = queries.folder;

    if (!type && !folder) {
      return {
        statusCode: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
        body: JSON.stringify({
          service: "Upload File Custom Folder Name",
          version: "1.0.0",
          status: "running",
          usage: {
            method: "GET",
            params: {
              type: "File MIME type (required). e.g. image/png, application/pdf",
              folder: "Full folder path (required). e.g. abn-sfp-custom-field/06-2026",
            },
            example: "?type=image/png&folder=abn-sfp-custom-field/06-2026",
          },
        }),
      };
    }

    if (!type || !folder) {
      return {
        statusCode: 400,
        headers: { "Access-Control-Allow-Origin": "*" },
        body: JSON.stringify({ error: "Missing type or folder" }),
      };
    }

    const ext = type.split("/")[1] || "bin";
    const random = Math.random().toString(36).slice(2, 10);
    const safeFileName = `${Date.now()}-${random}.${ext}`;
    const objectKey = `${folder}/${safeFileName}`;

    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: objectKey,
      ContentType: type,
    });

    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 60 });

    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        url: signedUrl,
        key: objectKey,
        file_url: `${S3_ASSET_URL}/${objectKey}`
      }),
    };

  } catch (error) {
    console.error("Error:", error);
    return {
      statusCode: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Failed to generate S3 presigned URL" })
    };
  }
};
