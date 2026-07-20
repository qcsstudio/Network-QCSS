import crypto from "node:crypto";

function encryptionKey() {
  const secret = process.env.LINKEDIN_TOKEN_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("LINKEDIN_TOKEN_ENCRYPTION_KEY must contain at least 32 characters.");
  }
  return crypto.createHash("sha256").update(secret).digest();
}
export function encryptIntegrationSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptIntegrationSecret(value: string) {
  const [version, ivValue, tagValue, encryptedValue] = value.split(".");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("The stored integration credential has an unsupported format.");
  }
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivValue, "base64url"));
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64url")), decipher.final()]).toString("utf8");
}

export function secureDigest(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function randomActionToken() {
  return crypto.randomBytes(24).toString("base64url");
}
