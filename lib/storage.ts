import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 (S3-compatible) — per the stack decision in
// AGENTS.md/CLAUDE1.md ("File storage: Cloudflare R2"). First real consumer:
// the tier2a_operator_signoff evidence-recording upload flow
// (lib/certificate-signoffs.ts, Sprint 4 Item 4). No other feature in this
// app does real file storage yet — training video/thumbnail URLs and
// listing image URLs are all string fields the caller supplies directly
// (matches the old app's "no real file upload" gap, CODEBASEAPI_SUMMARY.md
// §6), so there's no existing storage client to reuse.
//
// Uses presigned URLs (client uploads/downloads directly against R2, not
// proxied through this Next.js app) rather than a server-side upload
// endpoint — evidence recordings are video files, and proxying arbitrary
// video-sized request bodies through a Route Handler is both slower and
// more failure-prone than letting the client PUT straight to R2.
let client: S3Client | null = null;

function getClient(): S3Client {
  if (client) return client;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error(
      "R2 storage is not configured — set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY (see .env.example)."
    );
  }
  client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
  return client;
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured (see .env.example).");
  return bucket;
}

const UPLOAD_URL_EXPIRY_SECONDS = 10 * 60; // 10 minutes to complete the PUT
const VIEW_URL_EXPIRY_SECONDS = 15 * 60; // 15 minutes to view evidence

// Builds a per-(certificate, user) object key with a random, unguessable
// segment so a client can't overwrite another submission by predicting the
// key. Evidence is retained under this key for as long as the
// CertificateSignoffRequest row references it — no separate deletion path
// exists yet (matches this app's general "no delete beyond what's built"
// posture, e.g. no DELETE on listings either).
export function buildEvidenceRecordingKey(params: { certificateId: bigint; userId: string; filename: string }): string {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `signoff-evidence/${params.certificateId}/${params.userId}/${unique}-${safeName}`;
}

// Returns a presigned PUT URL the client uploads the recording to directly.
// The server never sees the file bytes.
export async function getEvidenceUploadUrl(params: { key: string; contentType: string }): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: getBucket(), Key: params.key, ContentType: params.contentType }),
    { expiresIn: UPLOAD_URL_EXPIRY_SECONDS }
  );
}

// Confirms the object actually landed in R2 before a submission is accepted
// as evidence — a client claiming `recordingKey` without having completed
// the presigned PUT must not be able to create a valid request.
export async function evidenceRecordingExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

// Short-lived, not a public URL — evidence recordings are kept for
// review/audit purposes, not public display (unlike training_videos.video_url).
export async function getEvidenceViewUrl(key: string): Promise<string> {
  return getSignedUrl(getClient(), new GetObjectCommand({ Bucket: getBucket(), Key: key }), {
    expiresIn: VIEW_URL_EXPIRY_SECONDS,
  });
}

// Sprint 6.12 addition — the everything-above-this-line pattern is built
// entirely for PRIVATE evidence (short-lived signed GET). Admin/supplier
// broadcast images (EDM popups, portal banners) need to be publicly
// viewable indefinitely, which is a genuinely different access shape, not
// something getEvidenceViewUrl's 15-minute signed URL should be reused for.
const PUBLIC_ASSET_UPLOAD_URL_EXPIRY_SECONDS = 10 * 60; // same 10-minute PUT window as evidence

// Mirrors buildEvidenceRecordingKey's shape (random unguessable segment so a
// re-upload can't collide with or overwrite a prior one by predicting the
// key) but scoped by feature area instead of certificate/user, since public
// assets aren't owned by a single user.
export function buildPublicAssetKey(params: { scope: "edm/admin" | "edm/supplier" | "banner"; filename: string; companyId?: bigint }): string {
  const safeName = params.filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-100);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const scopePath = params.companyId ? `${params.scope}/${params.companyId}` : params.scope;
  return `public-assets/${scopePath}/${unique}-${safeName}`;
}

export async function getPublicAssetUploadUrl(params: { key: string; contentType: string }): Promise<string> {
  return getSignedUrl(
    getClient(),
    new PutObjectCommand({ Bucket: getBucket(), Key: params.key, ContentType: params.contentType }),
    { expiresIn: PUBLIC_ASSET_UPLOAD_URL_EXPIRY_SECONDS }
  );
}

// NOT a signed URL, unlike everything else in this file — the R2 bucket
// must have public access enabled (or a bound custom domain) for this to
// actually resolve; see R2_PUBLIC_BASE_URL's own comment in .env.example.
// Confirms the object exists first, same discipline as
// evidenceRecordingExists — a caller-supplied key must not be trusted as a
// real uploaded asset until R2 confirms it landed.
export async function publicAssetExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: getBucket(), Key: key }));
    return true;
  } catch {
    return false;
  }
}

export function getPublicAssetUrl(key: string): string {
  const base = process.env.R2_PUBLIC_BASE_URL;
  if (!base) {
    throw new Error("R2_PUBLIC_BASE_URL is not configured (see .env.example).");
  }
  return `${base.replace(/\/$/, "")}/${key}`;
}
