(async function scrapeLinkedInProfile() {
  try {
    const MAX_SCROLL_STEPS = 30;
    const MAX_ACTIVITY_ITEMS = 5;

    const q = (selector, root = document) => root.querySelector(selector);
    const qAll = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const text = (node) => node?.innerText?.replace(/\s+/g, " ").trim() || "";

    async function waitFor(selector, timeout = 10000) {
      const start = Date.now();
      while (Date.now() - start < timeout) {
        if (document.querySelector(selector)) return true;
        await sleep(300);
      }
      return false;
    }

    async function autoScroll() {
      let previousHeight = 0;
      for (let step = 0; step < MAX_SCROLL_STEPS; step += 1) {
        window.scrollBy(0, 600);
        await sleep(250);

        const currentHeight = document.body.scrollHeight;
        if (window.scrollY + window.innerHeight >= currentHeight && currentHeight === previousHeight) break;
        previousHeight = currentHeight;
      }
    }

    function firstText(root, selectors) {
      for (const selector of selectors) {
        const value = text(q(selector, root));
        if (value) return value;
      }
      return "";
    }

    function parseCount(value) {
      const normalized = String(value || "0").replace(/,/g, "").trim().toLowerCase();
      if (normalized.endsWith("k")) return Math.round(Number(normalized.slice(0, -1)) * 1000) || 0;
      if (normalized.endsWith("m")) return Math.round(Number(normalized.slice(0, -1)) * 1000000) || 0;
      return Number(normalized.replace(/[^\d]/g, "")) || 0;
    }

    function getAbout() {
      const hidden = text(q("div.inline-show-more-text--is-collapsed span.visually-hidden"));
      if (hidden.length > 10) return hidden;

      const visible = text(q("div.inline-show-more-text--is-collapsed span[aria-hidden='true']"));
      if (visible) return visible;

      const container = text(q("div.inline-show-more-text--is-collapsed"));
      if (container) return container.replace("…see more", "").trim();

      return qAll("div.inline-show-more-text--is-collapsed span")
        .map((span) => text(span))
        .filter((value) => value.length > 2)
        .join(" ");
    }

    async function scrapeExperienceDetails() {
      await waitFor("h1");
      await autoScroll();
      await sleep(1000);

      return qAll("li.pvs-list__paged-list-item")
        .filter((item) => !q("ul.pvs-list", item))
        .map((item) => {
          const title = firstText(item, [
            "div.hoverable-link-text span[aria-hidden='true']",
            "span[aria-hidden='true']"
          ]);
          const companyLine = firstText(item, [
            "span.t-14.t-normal span[aria-hidden='true']"
          ]);
          const [company = "", employmentType = ""] = companyLine.split("·").map((part) => part.trim());
          const metaLines = qAll("span.t-14.t-normal.t-black--light span[aria-hidden='true']", item).map(text);
          const duration = metaLines.find((line) => /present|yr|year|mo|month|\d{4}/i.test(line)) || "";
          const locationText = metaLines.find((line) => /remote|on-site|hybrid|india|united states|canada|uk|australia/i.test(line)) || "";
          const skillsText = text(q("strong", item)?.parentElement || null);
          const skills = skillsText.includes("Skills")
            ? skillsText.replace(/^Skills:\s*/i, "").split("·").map((skill) => skill.trim()).filter(Boolean)
            : [];

          if (!title && !company) return null;

          return {
            title,
            company,
            employmentType,
            duration,
            isCurrent: /present/i.test(duration),
            location: locationText,
            skills
          };
        })
        .filter(Boolean);
    }

    async function scrapeEducationDetails() {
      await waitFor("section");
      await autoScroll();
      await sleep(1000);

      return qAll("li.pvs-list__paged-list-item")
        .map((item) => {
          const school = firstText(item, ["div.hoverable-link-text span[aria-hidden='true']"]);
          const degree = firstText(item, ["span.t-14.t-normal span[aria-hidden='true']"]);
          const duration = firstText(item, ["span.pvs-entity__caption-wrapper[aria-hidden='true']"]);
          const description = firstText(item, ["div.t-14.t-normal.t-black span[aria-hidden='true']"]);

          if (!school) return null;

          return {
            school,
            institute: school,
            degree,
            duration,
            description
          };
        })
        .filter(Boolean);
    }

    async function scrapeSkillsDetails() {
      await waitFor("section");
      await autoScroll();
      await sleep(1000);

      return qAll("li.pvs-list__paged-list-item")
        .map((item) => firstText(item, ["div.hoverable-link-text span[aria-hidden='true']"]))
        .filter(Boolean);
    }

    async function scrapeActivity() {
      await waitFor("section");
      await autoScroll();
      await sleep(1000);

      const emptyText = text(q(".artdeco-empty-state__headline"));
      if (/nothing to see/i.test(emptyText)) return [];

      return qAll("div.feed-shared-update-v2, div.feed-shared-post")
        .slice(0, MAX_ACTIVITY_ITEMS)
        .map((post) => {
          const content = firstText(post, ["span.break-words", "div.feed-shared-text"]);
          if (!content) return null;

          return {
            type: "post",
            text: content,
            createdAtRaw: firstText(post, ["span.feed-shared-actor__sub-description"]),
            reactionsCount: parseCount(firstText(post, ["span.social-details-social-counts__reactions-count"])),
            commentsCount: parseCount(firstText(post, ["span.social-details-social-counts__comments"]))
          };
        })
        .filter(Boolean);
    }

    function scrapeLocation() {
      return firstText(document, [
        "section.artdeco-card span.text-body-small.inline.t-black--light.break-words"
      ]);
    }

    function getProfileImageFromTopCard() {
      const section = q("section.artdeco-card");
      if (!section) return "";

      return (
        q("img.profile-photo-edit__preview", section)?.src ||
        q("img[src*='profile-displayphoto']", section)?.src ||
        q("img.evi-image", section)?.src ||
        ""
      );
    }

    if (location.pathname.includes("/details/experience")) {
      return { experience: await scrapeExperienceDetails() };
    }

    if (location.pathname.includes("/details/education")) {
      return { education: await scrapeEducationDetails() };
    }

    if (location.pathname.includes("/details/skills")) {
      return { skills: await scrapeSkillsDetails() };
    }

    if (location.pathname.includes("/recent-activity/")) {
      return { activity: await scrapeActivity() };
    }

    await waitFor("h1");
    return {
      username: location.pathname.split("/").filter(Boolean).pop() || "",
      name: text(q("h1")),
      headline: text(q("div.text-body-medium")),
      location: scrapeLocation(),
      about: getAbout(),
      connections: qAll("span").find((span) => /connections/i.test(text(span)))?.innerText || "",
      profile_picture: getProfileImageFromTopCard()
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "LinkedIn scraper failed."
    };
  }
})();
