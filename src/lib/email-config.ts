export type EmailDeliveryProvider = "smtp" | "resend";

type EmailBaseConfig = {
  from: string;
  replyTo: string;
};

export type EmailDeliveryConfig =
  | (EmailBaseConfig & {
      provider: "smtp";
      host: string;
      port: number;
      secure: boolean;
      user: string;
      password: string;
    })
  | (EmailBaseConfig & {
      provider: "resend";
      token: string;
    })
  | (EmailBaseConfig & {
      provider: null;
      missing: string[];
    });

function value(env: NodeJS.ProcessEnv, name: string) {
  return env[name]?.trim() || "";
}

function port(value: string) {
  const parsed = Number(value || "465");
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65_535 ? parsed : 465;
}

function sender(env: NodeJS.ProcessEnv) {
  return value(env, "EMAIL_FROM") || value(env, "LEAD_ALERT_EMAIL_FROM") || value(env, "VERIFYGRID_EMAIL_FROM") || value(env, "SMTP_USER");
}

export function buildEmailDeliveryConfig(env: NodeJS.ProcessEnv = process.env): EmailDeliveryConfig {
  const requested = value(env, "EMAIL_PROVIDER").toLowerCase();
  const from = sender(env);
  const replyTo = value(env, "EMAIL_REPLY_TO") || value(env, "SMTP_USER") || from;
  const smtp = {
    host: value(env, "SMTP_HOST"),
    port: port(value(env, "SMTP_PORT")),
    user: value(env, "SMTP_USER"),
    password: value(env, "SMTP_PASSWORD")
  };
  const smtpReady = Boolean(smtp.host && smtp.user && smtp.password && from);
  const resendToken = value(env, "RESEND_API_KEY");
  const resendReady = Boolean(resendToken && from);

  if ((requested === "smtp" || !requested) && smtpReady) {
    return {
      provider: "smtp",
      ...smtp,
      secure: value(env, "SMTP_SECURE") ? value(env, "SMTP_SECURE").toLowerCase() === "true" : smtp.port === 465,
      from,
      replyTo
    };
  }

  if ((requested === "resend" || !requested) && resendReady) {
    return { provider: "resend", token: resendToken, from, replyTo };
  }

  const missing = requested === "resend"
    ? [!resendToken && "RESEND_API_KEY", !from && "EMAIL_FROM"].filter(Boolean) as string[]
    : [!smtp.host && "SMTP_HOST", !smtp.user && "SMTP_USER", !smtp.password && "SMTP_PASSWORD", !from && "EMAIL_FROM"].filter(Boolean) as string[];
  return { provider: null, from, replyTo, missing };
}

export function emailDeliveryConfigured(env: NodeJS.ProcessEnv = process.env) {
  return buildEmailDeliveryConfig(env).provider !== null;
}
