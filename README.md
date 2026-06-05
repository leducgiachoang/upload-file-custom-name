# Upload File to S3 with Custom Folder — AWS Lambda + API Gateway

A lightweight **AWS Lambda function** that lets your frontend securely upload files and images to **Amazon S3** via **Presigned URLs** — no AWS credentials ever exposed to the client. File names are auto-generated using a timestamp + random string, and the storage folder is specified by the caller.

---

## Table of Contents

1. [How It Works](#1-how-it-works)
2. [Prerequisites](#2-prerequisites)
3. [Create an AWS Account](#3-create-an-aws-account)
4. [Create an S3 Bucket](#4-create-an-s3-bucket)
5. [Configure CORS on S3](#5-configure-cors-on-s3)
6. [Create a Lambda Function](#6-create-a-lambda-function)
7. [Grant IAM Permissions to Lambda](#7-grant-iam-permissions-to-lambda)
8. [Create an API Gateway](#8-create-an-api-gateway)
9. [Configure the Project](#9-configure-the-project)
10. [Deploy to Lambda](#10-deploy-to-lambda)
11. [Test the API](#11-test-the-api)
12. [Frontend Integration](#12-frontend-integration)
13. [Response Structure](#13-response-structure)

---

## 1. How It Works

```
Frontend
   │
   │  Step 1: GET ?type=image/png&folder=my-folder/06-2026
   ▼
API Gateway ──► Lambda Function
                    │
                    │  Generates a Presigned PUT URL
                    ▼
                Amazon S3
                    │
                    │  Returns { url, key, file_url }
                    ▼
Frontend
   │
   │  Step 2: PUT the file directly to S3 using the Presigned URL
   ▼
Amazon S3 (file saved)
```

**Why Presigned URLs?**
- The frontend **never needs** AWS credentials
- Files upload directly from the browser to S3, **bypassing Lambda** — no file size limits
- Presigned URLs expire in **60 seconds** — safe by design

---

## 2. Prerequisites

| Tool | Version | Download |
|---|---|---|
| Node.js | >= 18 | https://nodejs.org |
| AWS CLI | >= 2 | https://aws.amazon.com/cli |
| AWS Account | — | https://aws.amazon.com |

**Verify your setup:**
```bash
node -v
aws --version
```

---

## 3. Create an AWS Account

> Skip this step if you already have an AWS account.

1. Go to https://aws.amazon.com → click **"Create an AWS Account"**
2. Enter your email, set a password, and choose an account name
3. Enter a credit card (AWS has a **Free Tier** — 12 months free for most services)
4. Verify your phone number
5. Select the **Basic (Free)** support plan → complete signup

**Create an IAM User for the AWS CLI (avoid using the root account):**

1. Log in to the AWS Console → search for **IAM**
2. Go to **Users** → **Create user**
3. Set a username (e.g. `my-dev-user`) → Next
4. Choose **"Attach policies directly"** → check **AdministratorAccess** → Next → Create user
5. Open the user → go to the **Security credentials** tab → **Create access key**
6. Select **"Command Line Interface (CLI)"** → Next → **Create access key**
7. **Copy the Access Key ID and Secret Access Key** (shown only once!)

**Configure the AWS CLI:**
```bash
aws configure
```
Enter the following when prompted:
```
AWS Access Key ID: <paste your Access Key ID>
AWS Secret Access Key: <paste your Secret Access Key>
Default region name: ap-southeast-1
Default output format: json
```

---

## 4. Create an S3 Bucket

1. Go to the **AWS Console** → search for **S3**
2. Click **"Create bucket"**
3. Fill in the details:
   - **Bucket name**: choose a globally unique name, e.g. `my-upload-bucket-2026`
   - **AWS Region**: `Asia Pacific (Singapore) ap-southeast-1` (or the region closest to you)
4. Under **"Block Public Access settings"**:
   - **Public files** (anyone can view via direct URL): uncheck **"Block all public access"** → confirm
   - **Private files** (only accessible via presigned URL): leave it checked
5. Click **"Create bucket"**

> Note your bucket name and region — you'll need them in `configs.js` later.

---

## 5. Configure CORS on S3

> Required so browsers can PUT files directly to S3.

1. Open your bucket → go to the **Permissions** tab
2. Scroll down to **"Cross-origin resource sharing (CORS)"** → click **Edit**
3. Paste the following JSON:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "PUT", "POST"],
    "AllowedOrigins": ["*"],
    "ExposeHeaders": ["ETag"]
  }
]
```

> **Security tip:** In production, replace `"*"` in `AllowedOrigins` with your actual domain, e.g. `"https://myapp.com"`.

4. Click **Save changes**

**To make files publicly readable via direct URL**, add a Bucket Policy:

1. Still on the **Permissions** tab → scroll to **"Bucket policy"** → **Edit**
2. Paste the following (replace `YOUR-BUCKET-NAME` with your actual bucket name):

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

3. Click **Save changes**

---

## 6. Create a Lambda Function

1. Go to the **AWS Console** → search for **Lambda**
2. Click **"Create function"**
3. Select **"Author from scratch"**
4. Fill in the details:
   - **Function name**: `uploadFileCustomFolderName`
   - **Runtime**: `Node.js 22.x` (or the latest available)
   - **Architecture**: `x86_64`
5. Under **"Permissions"**:
   - Select **"Create a new role with basic Lambda permissions"**
   - Note the role name that gets created (e.g. `uploadFileCustomFolderName-role-xxxxxxxx`)
6. Click **"Create function"**

---

## 7. Grant IAM Permissions to Lambda

Lambda needs S3 permissions to generate Presigned URLs.

1. Go to the **AWS Console** → search for **IAM** → open **Roles**
2. Find and click the role created in Step 6 (starts with `uploadFileCustomFolderName-role-...`)
3. Click **"Add permissions"** → **"Attach policies"**
4. Search for **`AmazonS3FullAccess`** → check it → **"Add permissions"**

> **For production:** Create a custom policy that limits access to only `s3:PutObject` and `s3:GetObject` on your specific bucket instead of using `S3FullAccess`.

---

## 8. Create an API Gateway

1. Go to the **AWS Console** → search for **API Gateway**
2. Click **"Create API"** → select **"REST API"** → **Build**
3. Fill in:
   - **API name**: `uploadFileCustomFolderName-api`
   - **API endpoint type**: `Regional`
4. Click **"Create API"**

**Create a resource and method:**

5. Inside the new API → click **"Create resource"**
   - **Resource path**: `/` (use root, or set a custom path)
   - Check **"CORS"** → **Create resource**
6. Select the resource → click **"Create method"**
   - **Method type**: `GET`
   - **Integration type**: `Lambda function`
   - **Lambda function**: select region `ap-southeast-1` → search for `uploadFileCustomFolderName`
   - Check **"Lambda proxy integration"**
   - Click **"Create method"**

**Deploy the API:**

7. Click **"Deploy API"**
   - **Stage**: select `*New stage*`
   - **Stage name**: `prod`
8. Click **"Deploy"**
9. Copy the **Invoke URL** shown (format: `https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod`)

> This is the URL your frontend will call.

---

## 9. Configure the Project

Clone the repo:
```bash
git clone https://github.com/YOUR_USERNAME/upload-file-custom-name.git
cd upload-file-custom-name
```

Open [configs.js](configs.js) and update it with your values:

```js
const BUCKET_NAME = "YOUR-BUCKET-NAME";          // S3 bucket name from Step 4
const REGION = "ap-southeast-1";                  // Your bucket's region
const S3_ASSET_URL = "https://YOUR-BUCKET-NAME.s3.ap-southeast-1.amazonaws.com";

module.exports = { BUCKET_NAME, REGION, S3_ASSET_URL };
```

---

## 10. Deploy to Lambda

Run the deploy script (macOS / Linux):

```bash
chmod +x deploy.sh
./deploy.sh
```

The script automatically:
1. Removes the existing `node_modules`
2. Reinstalls dependencies compiled for Linux (required by Lambda)
3. Zips the project
4. Uploads the zip to the `uploadFileCustomFolderName` Lambda function

> **Windows users:** Run the commands in the script manually, or use WSL / Git Bash.

**Manual deploy (without the script):**
```bash
npm install --arch=x64 --platform=linux
zip -r uploadFileCustomFolderName.zip ./ -x "deploy.sh" -x "*.git*" -x "*.zip"
aws lambda update-function-code \
  --region "ap-southeast-1" \
  --function-name uploadFileCustomFolderName \
  --zip-file fileb://uploadFileCustomFolderName.zip
```

---

## 11. Test the API

**Open a browser** and visit your Invoke URL without any parameters to confirm the API is running:

```
https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod
```

Expected response:
```json
{
  "service": "Upload File Custom Folder Name",
  "version": "1.0.0",
  "status": "running",
  "usage": {
    "method": "GET",
    "params": {
      "type": "File MIME type (required). e.g. image/png, application/pdf",
      "folder": "Full folder path (required). e.g. abn-sfp-custom-field/06-2026"
    },
    "example": "?type=image/png&folder=abn-sfp-custom-field/06-2026"
  }
}
```

**Test getting a presigned URL:**
```
https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod?type=image/png&folder=my-folder/06-2026
```

Expected response:
```json
{
  "url": "https://YOUR-BUCKET.s3.amazonaws.com/my-folder/06-2026/1749123456789-k3m7xq2a.png?X-Amz-Signature=...",
  "key": "my-folder/06-2026/1749123456789-k3m7xq2a.png",
  "file_url": "https://YOUR-BUCKET.s3.ap-southeast-1.amazonaws.com/my-folder/06-2026/1749123456789-k3m7xq2a.png"
}
```

---

## 12. Frontend Integration

Uploading a file takes **2 steps**: request a presigned URL → PUT the file directly to S3.

### Plain JavaScript (Fetch API)

```html
<input type="file" id="fileInput" />
<button onclick="handleUpload()">Upload</button>
<img id="preview" style="max-width:300px" />

<script>
  const API_URL = "https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod";

  async function handleUpload() {
    const file = document.getElementById("fileInput").files[0];
    if (!file) return alert("Please select a file first.");

    try {
      // Step 1: Get the presigned URL from Lambda
      const params = new URLSearchParams({
        type: file.type,
        folder: "my-folder/06-2026",
      });
      const res = await fetch(`${API_URL}?${params}`);
      const { url, key, file_url } = await res.json();

      // Step 2: PUT the file directly to S3
      await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      console.log("Upload successful!");
      console.log("Key:", key);
      console.log("File URL:", file_url);

      // Show image preview
      document.getElementById("preview").src = file_url;

    } catch (err) {
      console.error("Upload failed:", err);
    }
  }
</script>
```

### React

```jsx
const API_URL = "https://xxxxxxxxxx.execute-api.ap-southeast-1.amazonaws.com/prod";

async function uploadToS3(file, folder = "my-folder/06-2026") {
  // Step 1: Get the presigned URL
  const params = new URLSearchParams({ type: file.type, folder });
  const res = await fetch(`${API_URL}?${params}`);
  const { url, key, file_url } = await res.json();

  // Step 2: Upload directly to S3
  await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  return { key, file_url };
}

// Usage inside a component:
function UploadButton() {
  const handleChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const { file_url } = await uploadToS3(file);
    console.log("File URL:", file_url);
  };

  return <input type="file" onChange={handleChange} />;
}
```

---

## 13. Response Structure

### GET (no params) — API info
```json
{
  "service": "Upload File Custom Folder Name",
  "version": "1.0.0",
  "status": "running",
  "usage": { "..." }
}
```

### GET `?type=...&folder=...` — success
```json
{
  "url": "https://...presigned-url-for-PUT...",
  "key": "my-folder/06-2026/1749123456789-k3m7xq2a.png",
  "file_url": "https://YOUR-BUCKET.s3.ap-southeast-1.amazonaws.com/my-folder/06-2026/1749123456789-k3m7xq2a.png"
}
```

| Field | Description |
|---|---|
| `url` | Presigned URL to **PUT** the file to S3 (valid for 60 seconds) |
| `key` | The file's path inside the S3 bucket — save this for future reference |
| `file_url` | Direct S3 URL to the file (requires public bucket access to view) |

### GET — missing params error
```json
{ "error": "Missing type or folder" }
```

---

## Query Parameters

| Param | Required | Description | Example |
|---|---|---|---|
| `type` | ✅ | File MIME type | `image/png`, `image/jpeg`, `application/pdf` |
| `folder` | ✅ | Full folder path in S3 | `my-folder/06-2026` |

---

## Project Structure

```
├── index.js       # Lambda handler
├── configs.js     # Bucket name, region, and base URL
├── deploy.sh      # Deploy script
├── package.json   # Dependencies
└── README.md
```

---

## Notes

- **Presigned URLs expire in 60 seconds** — the PUT must happen immediately after receiving the URL
- **File names are auto-generated** as `{timestamp}-{8-char-random}.{ext}` to prevent collisions
- The project uses Lambda's **IAM Role** to sign S3 requests — no AWS credentials in the code
- Files upload directly from the browser to S3, **not through Lambda** — no API Gateway 6 MB limit

---

## License

MIT
