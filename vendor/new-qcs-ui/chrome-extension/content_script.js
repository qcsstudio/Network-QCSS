const ALLOWED_HOSTNAMES = new Set([
  "www.qcsstudio.com",
  "qcsstudio.com",
  "localhost",
  "127.0.0.1"
]);
const EXTENSION_SOURCE = "LINKEDIN_AUDIT_EXT";

window.addEventListener("message", (event) => {
  if (!isAllowedPageEvent(event)) return;

  if (isPingMessage(event.data)) {
    postToPage(
      {
        from: EXTENSION_SOURCE,
        type: "QCS_LINKEDIN_AUDIT_STATUS",
        status: "EXTENSION_LOADED",
        message: "Extension loaded on QCS audit page."
      },
      event.origin
    );
    postToPage(
      {
        from: EXTENSION_SOURCE,
        type: "QCS_LINKEDIN_AUDIT_READY",
        extension: "QCS_LINKEDIN_AUDIT"
      },
      event.origin
    );
    return;
  }

  if (!event.data || event.data.type !== "START_SCRAPE") return;

  postToPage(
    {
      from: EXTENSION_SOURCE,
      type: "QCS_LINKEDIN_AUDIT_STATUS",
      status: "SCRAPE_REQUEST_SENT",
      message: "Scrape request sent to extension background worker."
    },
    event.origin
  );

  chrome.runtime.sendMessage(
    {
      type: "START_SCRAPE",
      url: event.data.url,
      role: event.data.role,
      accepted: event.data.accepted === true
    },
    (response) => {
      if (chrome.runtime.lastError) {
        postToPage(
          {
            from: EXTENSION_SOURCE,
            type: "SCRAPE_ERROR",
            error: chrome.runtime.lastError.message
          },
          event.origin
        );
        return;
      }

      if (response?.ok) {
        postToPage(
          {
            from: EXTENSION_SOURCE,
            type: "QCS_LINKEDIN_AUDIT_STATUS",
            status: "SCRAPE_COMPLETED",
            message: `Extension completed scraping and returned data via ${response.delivery?.via || "unknown delivery"}.`
          },
          event.origin
        );
      }

      if (response && response.ok === false) {
        postToPage(
          {
            from: EXTENSION_SOURCE,
            type: "SCRAPE_ERROR",
            error: response.error || "Unable to start LinkedIn audit."
          },
          event.origin
        );
      }
    }
  );
});

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg) return;

  if (msg.type === "QCS_LINKEDIN_AUDIT_STATUS") {
    postToPage({
      from: EXTENSION_SOURCE,
      type: "QCS_LINKEDIN_AUDIT_STATUS",
      status: msg.status,
      message: msg.message
    });
  }

  if (msg.type === "SCRAPE_RESULT") {
    postToPage({
      from: EXTENSION_SOURCE,
      type: "QCS_LINKEDIN_AUDIT_STATUS",
      status: "DATA_RECEIVED_FROM_EXTENSION",
      message: "Raw LinkedIn profile data received from extension."
    });
    postToPage({
      from: EXTENSION_SOURCE,
      type: "SCRAPE_RESULT",
      payload: msg.payload
    });
  }

  if (msg.type === "SCRAPE_ERROR") {
    postToPage({
      from: EXTENSION_SOURCE,
      type: "SCRAPE_ERROR",
      error: msg.error || "Unable to complete LinkedIn audit."
    });
  }
});

function isAllowedPageEvent(event) {
  if (event.source !== window) return false;

  try {
    return ALLOWED_HOSTNAMES.has(new URL(event.origin).hostname);
  } catch {
    return false;
  }
}

function isPingMessage(data) {
  return (
    data === "PING_EXTENSION" ||
    data?.type === "PING_EXTENSION" ||
    data?.type === "QCS_LINKEDIN_AUDIT_PING"
  );
}

function postToPage(message, targetOrigin = window.location.origin) {
  try {
    if (!ALLOWED_HOSTNAMES.has(new URL(targetOrigin).hostname)) return;
  } catch {
    return;
  }

  window.postMessage(message, targetOrigin);
}
