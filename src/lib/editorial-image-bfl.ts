const bflApiBase = "https://api.bfl.ai/v1";

type BflSubmission = {
  id?: string;
  polling_url?: string;
};

type BflResult = {
  status?: string;
  result?: { sample?: string };
  error?: string;
};

function env(name: string) {
  return process.env[name]?.trim() || "";
}

export function bflImageConfiguration() {
  return {
    configured: Boolean(env("BFL_API_KEY")),
    model: env("EDITORIAL_BFL_MODEL") || "flux-2-max"
  };
}

function timeoutMs() {
  const configured = Number(env("EDITORIAL_IMAGE_TIMEOUT_MS"));
  if (Number.isFinite(configured) && configured >= 30_000) return Math.min(Math.floor(configured), 300_000);
  return 180_000;
}

async function responseError(response: Response, label: string) {
  const body = await response.text().catch(() => "");
  return new Error(`${label} failed (${response.status}): ${body.slice(0, 800) || response.statusText}`);
}

export async function generateBflEditorialImage(prompt: string) {
  const config = bflImageConfiguration();
  const apiKey = env("BFL_API_KEY");
  if (!apiKey) throw new Error("BFL_API_KEY is not configured.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs());
  try {
    const submissionResponse = await fetch(`${bflApiBase}/${config.model}`, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-key": apiKey
      },
      body: JSON.stringify({
        prompt,
        width: 1440,
        height: 800,
        output_format: "png",
        prompt_upsampling: false,
        safety_tolerance: 2
      }),
      signal: controller.signal
    });
    if (!submissionResponse.ok) throw await responseError(submissionResponse, "FLUX image submission");
    const submission = (await submissionResponse.json()) as BflSubmission;
    if (!submission.id || !submission.polling_url) throw new Error("FLUX returned an incomplete generation response.");

    while (true) {
      await new Promise((resolve) => setTimeout(resolve, 1_200));
      const resultResponse = await fetch(submission.polling_url, {
        headers: { accept: "application/json", "x-key": apiKey },
        signal: controller.signal
      });
      if (!resultResponse.ok) throw await responseError(resultResponse, "FLUX result polling");
      const result = (await resultResponse.json()) as BflResult;
      if (result.status === "Ready") {
        const imageUrl = result.result?.sample;
        if (!imageUrl) throw new Error("FLUX completed without a downloadable image.");
        const imageResponse = await fetch(imageUrl, { signal: controller.signal });
        if (!imageResponse.ok) throw await responseError(imageResponse, "FLUX image download");
        const contentLength = Number(imageResponse.headers.get("content-length") || 0);
        if (contentLength > 20_000_000) throw new Error("FLUX image exceeded the 20 MB safety limit.");
        const source = Buffer.from(await imageResponse.arrayBuffer());
        if (source.length < 20_000) throw new Error("FLUX returned an unexpectedly small image.");
        return { model: config.model, source };
      }
      if (result.status === "Error" || result.status === "Failed") {
        throw new Error(`FLUX image generation failed: ${result.error || result.status}`);
      }
    }
  } finally {
    clearTimeout(timer);
  }
}
