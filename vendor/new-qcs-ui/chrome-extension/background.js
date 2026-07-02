const DETAILS_PAGES = ["experience", "education", "skills"];
const EXTENSION_NAME = "QCS_LINKEDIN_AUDIT";
const ALLOWED_PAGE_HOSTNAMES = new Set([
  "www.qcsstudio.com",
  "qcsstudio.com",
  "localhost",
  "127.0.0.1"
]);
const ALLOWED_ROLES = new Set([
  "Job Seeker",
  "Founder / CEO",
  "Sales / SDR / AE",
  "Consultant / Coach",
  "Recruiter / Talent"
]);

chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (!isAllowedExternalSender(sender)) {
    sendResponse({ ok: false, error: "Origin is not allowed." });
    return true;
  }

  if (msg?.type === "QCS_LINKEDIN_AUDIT_HEALTH_CHECK") {
    sendResponse(buildHealthCheckResponse());
    return true;
  }

  sendResponse({ ok: false, error: "Unsupported external message." });
  return true;
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "QCS_LINKEDIN_AUDIT_HEALTH_CHECK") {
    sendResponse(buildHealthCheckResponse());
    return true;
  }

  if (!msg || msg.type !== "START_SCRAPE") return false;

  (async () => {
    const targetTabId = sender.tab?.id;
    const openedTabIds = [];

    try {
      if (!targetTabId) throw new Error("Could not identify the audit tab.");
      if (!isAllowedContentScriptSender(sender)) throw new Error("Audit request origin is not allowed.");
      if (msg.accepted !== true) throw new Error("Terms and privacy consent is required before scraping.");
      if (!ALLOWED_ROLES.has(msg.role)) throw new Error("Selected role is not supported.");

      const profileUrl = normalizeLinkedInProfileUrl(msg.url);
      const role = msg.role;

      await sendStatusToAuditTab(targetTabId, "EXTENSION_FOUND", "Extension found and connected to the QCS audit page.");
      await sendStatusToAuditTab(targetTabId, "SCRAPING_PROFILE", "Extension is scraping the main LinkedIn profile.");

      const profileTab = await chrome.tabs.create({ url: profileUrl, active: false });
      openedTabIds.push(profileTab.id);
      await waitForTab(profileTab.id);

      const baseResult = await runScraper(profileTab.id);
      const finalData = {
        ...baseResult,
        role,
        url: profileUrl,
        accepted: true
      };

      for (const page of DETAILS_PAGES) {
        await sendStatusToAuditTab(targetTabId, "SCRAPING_DETAILS", `Extension is scraping LinkedIn ${page} data.`);
        const detailsUrl = `${profileUrl.replace(/\/$/, "")}/details/${page}/`;
        const tab = await chrome.tabs.create({ url: detailsUrl, active: false });
        openedTabIds.push(tab.id);
        await waitForTab(tab.id);

        const detailResult = await runScraper(tab.id);
        if (page === "experience") finalData.experience = detailResult.experience || [];
        if (page === "education") finalData.education = detailResult.education || [];
        if (page === "skills") finalData.skills = detailResult.skills || [];
      }

      await sendStatusToAuditTab(targetTabId, "SCRAPING_ACTIVITY", "Extension is scraping recent LinkedIn activity.");

      const activityUrl = `${profileUrl.replace(/\/$/, "")}/recent-activity/all/`;
      const activityTab = await chrome.tabs.create({ url: activityUrl, active: false });
      openedTabIds.push(activityTab.id);
      await waitForTab(activityTab.id);

      const activityResult = await runScraper(activityTab.id);
      finalData.activity = Array.isArray(activityResult.activity) ? activityResult.activity : [];

      await sendStatusToAuditTab(targetTabId, "DATA_READY", "Extension finished scraping and is sending raw data to QCS website.");

      const delivery = await sendToAuditTab(targetTabId, {
        type: "SCRAPE_RESULT",
        payload: finalData
      });

      sendResponse({
        ok: true,
        delivery,
        summary: summarizeScrape(finalData)
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to complete LinkedIn audit.";
      if (targetTabId) {
        await sendToAuditTab(targetTabId, {
          type: "SCRAPE_ERROR",
          error: message
        });
      }
      sendResponse({ ok: false, error: message });
    } finally {
      await closeOpenedTabs(openedTabIds);
    }
  })();

  return true;
});

function buildHealthCheckResponse() {
  return {
    ok: true,
    type: "QCS_LINKEDIN_AUDIT_READY",
    extension: EXTENSION_NAME,
    version: chrome.runtime.getManifest().version
  };
}

function isAllowedExternalSender(sender) {
  const hostname = sender.origin ? safeHostname(sender.origin) : safeHostname(sender.url);
  return ALLOWED_PAGE_HOSTNAMES.has(hostname);
}

function isAllowedContentScriptSender(sender) {
  const hostname = sender.origin ? safeHostname(sender.origin) : safeHostname(sender.url);
  return ALLOWED_PAGE_HOSTNAMES.has(hostname);
}

function safeHostname(rawUrl) {
  try {
    return rawUrl ? new URL(rawUrl).hostname : "";
  } catch {
    return "";
  }
}

function normalizeLinkedInProfileUrl(rawUrl) {
  const parsed = new URL(String(rawUrl || "").trim());
  if (parsed.protocol !== "https:") throw new Error("LinkedIn URL must use HTTPS.");
  if (parsed.hostname !== "www.linkedin.com") throw new Error("Only www.linkedin.com profile URLs are supported.");

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] !== "in" || !parts[1]) throw new Error("Please enter a valid LinkedIn profile URL.");

  parsed.pathname = `/in/${parts[1]}/`;
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

async function waitForTab(tabId, timeoutMs = 600000) {
  const currentTab = await chrome.tabs.get(tabId);
  if (currentTab.status === "complete") {
    await sleep(1500);
    return;
  }

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.tabs.onUpdated.removeListener(listener);
      reject(new Error("LinkedIn page took too long to load within the 10-minute audit window."));
    }, timeoutMs);

    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") {
        clearTimeout(timeout);
        chrome.tabs.onUpdated.removeListener(listener);
        setTimeout(resolve, 1500);
      }
    };

    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function runScraper(tabId) {
  const result = await chrome.scripting.executeScript({
    target: { tabId },
    files: ["linkedin_scraper.js"]
  });

  return result?.[0]?.result || {};
}

async function sendStatusToAuditTab(tabId, status, message) {
  return sendToAuditTab(tabId, {
    type: "QCS_LINKEDIN_AUDIT_STATUS",
    status,
    message
  });
}

async function sendToAuditTab(tabId, message) {
  try {
    await chrome.tabs.sendMessage(tabId, message);
    return { delivered: true, via: "tabs.sendMessage" };
  } catch (error) {
    return deliverToAuditPage(tabId, message, error);
  }
}

async function deliverToAuditPage(tabId, message, originalError) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: (payload) => {
      window.postMessage({
        from: "LINKEDIN_AUDIT_EXT",
        ...payload
      }, window.location.origin);
    },
    args: [message]
  });

  return {
    delivered: true,
    via: "scripting.executeScript",
    originalError: originalError?.message || "tabs.sendMessage failed",
    injectionResult: results?.[0]?.result
  };
}

function summarizeScrape(data) {
  return {
    hasName: Boolean(data.name),
    hasHeadline: Boolean(data.headline),
    experienceCount: Array.isArray(data.experience) ? data.experience.length : 0,
    educationCount: Array.isArray(data.education) ? data.education.length : 0,
    skillsCount: Array.isArray(data.skills) ? data.skills.length : 0,
    activityCount: Array.isArray(data.activity) ? data.activity.length : 0
  };
}

async function closeOpenedTabs(tabIds) {
  const uniqueTabIds = [...new Set(tabIds.filter(Boolean))];
  await Promise.all(
    uniqueTabIds.map(async (tabId) => {
      try {
        await chrome.tabs.remove(tabId);
      } catch {
        // The tab may already be closed by the user or Chrome.
      }
    })
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
