"""Read-only public crawl audit. No forms, authenticated routes, or tool APIs run."""
import argparse
import concurrent.futures
import json
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from collections import Counter
from html.parser import HTMLParser
from pathlib import Path


class Page(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ""
        self.headings = []
        self.links = []
        self.images = []
        self.meta = {}
        self.canonical = []
        self.schemas = []
        self.capture = None
        self.buffer = ""
        self.lang = None
        self.main_count = 0

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "html":
            self.lang = attrs.get("lang")
        if tag == "main":
            self.main_count += 1
        if tag in ("title", "h1") or (tag == "script" and attrs.get("type") == "application/ld+json"):
            self.capture = tag
            self.buffer = ""
        if tag == "meta":
            self.meta[attrs.get("name", attrs.get("property", ""))] = attrs.get("content", "")
        if tag == "link" and "canonical" in attrs.get("rel", "").split():
            self.canonical.append(attrs.get("href", ""))
        if tag == "a" and attrs.get("href"):
            self.links.append(attrs["href"])
        if tag == "img":
            self.images.append(attrs)

    def handle_data(self, data):
        if self.capture:
            self.buffer += data

    def handle_endtag(self, tag):
        if self.capture != tag:
            return
        value = " ".join(self.buffer.split())
        if tag == "title":
            self.title = value
        elif tag == "h1":
            self.headings.append(value)
        else:
            self.schemas.append(self.buffer)
        self.capture = None


def fetch(url, method="GET", user_agent="QCS-Public-Audit/1.0"):
    start = time.monotonic()
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, method=method, headers={"User-Agent": user_agent, "Accept": "text/html,application/xml,text/plain"})
            with urllib.request.urlopen(request, timeout=40) as response:
                return response.status, response.geturl(), dict(response.headers), response.read().decode("utf-8", "replace"), round(time.monotonic() - start, 2)
        except urllib.error.HTTPError as error:
            if error.code in (429, 502, 503, 504) and attempt < 2:
                time.sleep(3 * (attempt + 1))
                continue
            return error.code, url, dict(error.headers), "", round(time.monotonic() - start, 2)
        except (OSError, TimeoutError) as error:
            if attempt < 2:
                time.sleep(2)
                continue
            return 0, url, {}, str(error), round(time.monotonic() - start, 2)


def inspect(url, origin, request_origin=None, indexable=True):
    request_url = url.replace(origin, request_origin or origin, 1)
    status, final, headers, body, elapsed = fetch(request_url)
    final = final.replace(request_origin or origin, origin, 1)
    row = {"url": url, "status": status, "final_url": final, "seconds": elapsed, "issues": [], "links": []}
    if status != 200:
        row["issues"].append(f"HTTP {status}")
        return row
    content_type = next((value for key, value in headers.items() if key.lower() == "content-type"), "")
    if "text/html" not in content_type:
        row["content_type"] = content_type
        return row
    page = Page()
    page.feed(body)
    row.update(title=page.title, description=page.meta.get("description"), canonical=page.canonical, h1=page.headings, robots=page.meta.get("robots"), x_robots=headers.get("X-Robots-Tag"), html_bytes=len(body.encode()), image_count=len(page.images))
    if final != url and indexable:
        row["issues"].append("Redirect in sitemap")
    if not page.title:
        row["issues"].append("Missing title")
    if not page.meta.get("description"):
        row["issues"].append("Missing description")
    if len(page.canonical) != 1:
        row["issues"].append("Expected one canonical")
    elif urllib.parse.urlsplit(page.canonical[0]).netloc != urllib.parse.urlsplit(origin).netloc:
        row["issues"].append("Canonical uses different host")
    elif indexable and page.canonical[0].rstrip("/") != url.rstrip("/"):
        row["issues"].append("Non-self canonical in sitemap")
    if len(page.headings) != 1:
        row["issues"].append(f"Expected one H1; found {len(page.headings)}")
    if not page.lang:
        row["issues"].append("Missing document language")
    if indexable and "noindex" in (page.meta.get("robots", "") + headers.get("X-Robots-Tag", "")).lower():
        row["issues"].append("Noindex URL in sitemap")
    if any("alt" not in img for img in page.images):
        row["issues"].append("Image missing alt attribute")
    for schema in page.schemas:
        try:
            json.loads(schema)
        except json.JSONDecodeError:
            row["issues"].append("Invalid JSON-LD")
    row["schema_count"] = len(page.schemas)
    row["assets"] = sorted({urllib.parse.urljoin(final, img.get("src", "")) for img in page.images if img.get("src")})
    if page.meta.get("og:image"):
        row["assets"].append(urllib.parse.urljoin(final, page.meta["og:image"]))
    for href in page.links:
        absolute = urllib.parse.urljoin(final, href)
        parsed = urllib.parse.urlsplit(absolute)
        if parsed.netloc == urllib.parse.urlsplit(origin).netloc and parsed.scheme in ("https", "http"):
            row["links"].append(urllib.parse.urlunsplit((parsed.scheme, parsed.netloc, parsed.path or "/", parsed.query, "")))
    row["links"] = sorted(set(row["links"]))
    return row


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="https://www.qcsstudio.com")
    parser.add_argument("--canonical-origin", default="https://www.qcsstudio.com")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    origin = args.canonical_origin.rstrip("/")
    request_origin = args.origin.rstrip("/")
    status, _, _, xml, _ = fetch(request_origin + "/sitemap.xml")
    if status != 200:
        raise SystemExit(f"Sitemap unavailable: {status}")
    root = ET.fromstring(xml)
    namespace = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = [node.text for node in root.findall("s:url/s:loc", namespace)]
    urls = list(dict.fromkeys(urls))
    _, _, _, robots, _ = fetch(request_origin + "/robots.txt")
    rows = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        jobs = [executor.submit(inspect, url, origin, request_origin) for url in urls]
        for future in concurrent.futures.as_completed(jobs):
            rows.append(future.result())
            if len(rows) % 25 == 0:
                print(f"Audited {len(rows)}/{len(urls)} URLs", flush=True)
    linked = {url.rstrip("/") for row in rows for url in row["links"]}
    public_links = sorted({url for row in rows for url in row["links"] if not urllib.parse.urlsplit(url).path.startswith(("/api/", "/admin", "/portal"))} - set(urls))
    # Verify additional public links, including pagination, without unbounded crawling.
    extras = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        for result in executor.map(lambda url: inspect(url, origin, request_origin, False), public_links[:100]):
            extras.append(result)
    titles = Counter(row.get("title") for row in rows if row.get("title"))
    report = {
        "origin": request_origin, "canonical_origin": origin, "audited_at_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "sitemap_urls": len(urls), "robots": robots,
        "status_counts": dict(Counter(str(row["status"]) for row in rows)),
        "duplicate_titles": {title: count for title, count in titles.items() if count > 1},
        "without_inbound_html_links": [url for url in urls if url.rstrip("/") not in linked],
        "pages": sorted(rows, key=lambda row: row["url"]), "additional_link_checks": extras,
        "limitations": ["HTTP crawl, not search-engine index coverage", "Elapsed times are audit observations, not Core Web Vitals", "No authenticated pages, forms, scans or publishing actions", "Visual accessibility requires separate browser checks"],
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps({"sitemap_urls": len(urls), "statuses": report["status_counts"], "pages_with_issues": sum(bool(row["issues"]) for row in rows), "without_inbound_links": len(report["without_inbound_html_links"]), "additional_links": len(extras), "report": str(output)}, indent=2))


if __name__ == "__main__":
    main()
