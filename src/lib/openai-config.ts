export type OpenAIApiKeyStatus = {
  apiKey: string;
  configured: boolean;
  credentialIssue: "missing" | "malformed" | null;
};

export function validateOpenAIApiKey(value: string | undefined): OpenAIApiKeyStatus {
  const apiKey = value?.trim() || "";
  if (!apiKey) return { apiKey, configured: false, credentialIssue: "missing" };
  if (!apiKey.startsWith("sk-") || apiKey.length < 20) {
    return { apiKey, configured: false, credentialIssue: "malformed" };
  }
  return { apiKey, configured: true, credentialIssue: null };
}

export function openAIApiKeyStatus() {
  return validateOpenAIApiKey(process.env.OPENAI_API_KEY);
}

export function openAICredentialMessage(status: OpenAIApiKeyStatus) {
  return status.credentialIssue === "malformed"
    ? "OPENAI_API_KEY is malformed. Add the complete OpenAI secret key value beginning with sk-."
    : "OPENAI_API_KEY is not configured. Add a direct OpenAI API key.";
}
