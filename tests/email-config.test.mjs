import assert from "node:assert/strict";
import test from "node:test";
import { buildEmailDeliveryConfig, emailDeliveryConfigured } from "../src/lib/email-config.ts";

test("Gmail SMTP is selected when its server-only credentials are complete", () => {
  const config = buildEmailDeliveryConfig({
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "sender@example.com",
    SMTP_PASSWORD: "app-password",
    EMAIL_FROM: "QCS Website <sender@example.com>"
  });
  assert.equal(config.provider, "smtp");
  assert.equal(config.provider === "smtp" && config.secure, true);
  assert.equal(config.from, "QCS Website <sender@example.com>");
});

test("Resend remains available when SMTP is not selected", () => {
  const config = buildEmailDeliveryConfig({
    EMAIL_PROVIDER: "resend",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "QCS Website <website@example.com>"
  });
  assert.equal(config.provider, "resend");
});

test("an explicitly selected incomplete SMTP setup does not silently switch providers", () => {
  const config = buildEmailDeliveryConfig({
    EMAIL_PROVIDER: "smtp",
    SMTP_HOST: "smtp.gmail.com",
    SMTP_USER: "sender@example.com",
    RESEND_API_KEY: "re_test",
    EMAIL_FROM: "QCS Website <sender@example.com>"
  });
  assert.equal(config.provider, null);
  assert.deepEqual(config.provider === null ? config.missing : [], ["SMTP_PASSWORD"]);
  assert.equal(emailDeliveryConfigured({ EMAIL_PROVIDER: "smtp" }), false);
});
