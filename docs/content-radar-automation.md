# QCS Content Radar Automation

## Publication flow

1. Vercel calls `/api/admin/content-radar` at `04:00 UTC` every Monday and Thursday.
2. The route scans all configured feeds in parallel and classifies each source as `authority`, `demand`, or `discovery`.
3. Google Trends and news discovery signals can increase the score of a matching authoritative topic, but unattended publication never uses them as the factual primary source.
4. The highest-ranked new authoritative topic becomes a complete structured article with source attribution, operational evidence, implementation steps, internal links, FAQ content, and image routing.
5. The article is validated, system-approved, published, added to the sitemap, and queued for LinkedIn.
6. A date and slug guard ensures a retry cannot publish a duplicate article.

Manual admin scans remain scan-only. An administrator can edit, preview, approve, publish, archive, restore, delete, or regenerate an incomplete historical radar draft from Content Studio.

## Source policy

- `authority`: government advisories, standards bodies, vendor advisories, vendor engineering, and primary threat research. Eligible for scheduled publication.
- `demand`: Google Trends feeds for India and the United States. Used only to measure current search interest.
- `discovery`: niche Google News searches and reputable security publications. Used to detect emerging coverage and corroborate demand.

The source registry lives in `src/lib/blog.ts`. Source failures remain visible in the admin Source Health list and every cron result is written to the audit log.

## Editorial controls

WhatsApp editorial approval is not part of this system. Manual content uses recorded admin approval. Scheduled content uses the protected cron identity and must pass the same schema and publication checks before it can become public.
