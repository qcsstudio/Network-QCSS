"""Verify actual HTTP/HTML/XML discovery contracts without publishing or scanning."""
import argparse
import json
import runpy
import urllib.parse
import xml.etree.ElementTree as ET
from pathlib import Path

audit = runpy.run_path(str(Path(__file__).with_name("public-site-audit.py")))
Page, fetch = audit["Page"], audit["fetch"]


def verify(origin):
    checks = []
    canonical = "https://www.qcsstudio.com"

    def page(path):
        status, _, headers, body, _ = fetch(origin + path)
        parsed = Page()
        parsed.feed(body)
        return status, {key.lower(): value for key, value in headers.items()}, parsed

    status, _, _, body, _ = fetch(origin + "/robots.txt")
    assert status == 200 and "Allow: /api/editorial-media/" in body
    assert "Disallow: /admin" in body and "Disallow: /api" in body
    assert f"Sitemap: {canonical}/sitemap.xml" in body
    checks.append("Public artwork allowed; admin and other API crawling still restricted")

    status, _, _, body, _ = fetch(origin + "/sitemap.xml")
    assert status == 200
    root = ET.fromstring(body)
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9", "image": "http://www.google.com/schemas/sitemap-image/1.1"}
    urls = [node.text for node in root.findall("s:url/s:loc", ns)]
    assert len(urls) == len(set(urls))
    assert not any(urllib.parse.urlsplit(url).path.startswith(("/admin", "/portal", "/api", "/verifygrid")) for url in urls)
    images = [node.text for node in root.findall("s:url/image:image/image:loc", ns)]
    assert images and "&v=" in images[0] and "&amp;" not in images[0]
    status, _, headers, _, _ = fetch(images[0].replace(canonical, origin), method="HEAD")
    assert status == 200 and any(key.lower() == "content-type" and value.startswith("image/") for key, value in headers.items())
    checks.append(f"Valid sitemap XML: {len(urls)} unique public URLs, {len(images)} real image URLs; first image returns 200")

    expected = {url for url in urls if "/security-advisories/" in url}
    found = []
    number = 1
    while number <= 100:
        path = "/security-advisories" + (f"?page={number}" if number > 1 else "")
        status, _, parsed = page(path)
        assert status == 200 and parsed.canonical == [canonical + path]
        schemas = [item for text in parsed.schemas for item in (json.loads(text) if isinstance(json.loads(text), list) else [json.loads(text)])]
        listing = next(item for item in schemas if item.get("@type") == "ItemList")
        items = listing["itemListElement"]
        assert len(items) <= 12
        found.extend(item["url"] for item in items)
        next_path = f"/security-advisories?page={number + 1}#latest-advisories"
        if next_path not in parsed.links:
            break
        number += 1
    assert set(found) == expected and len(found) == len(set(found))
    checks.append(f"All {len(found)} advisories reachable once across {number} server-rendered pages, each self-canonical")

    status, _, parsed = page("/resources?page=2")
    assert status == 200 and parsed.canonical == [canonical + "/resources?page=2"]
    checks.append("Resource page two has its own canonical")

    for path in ("/resources?q=network", "/security-advisories?vendor=Cisco"):
        status, _, parsed = page(path)
        assert status == 200 and parsed.meta.get("robots") == "noindex, follow"
    checks.append("Search/filter variants are noindex, follow")

    for path in ("/admin/login", "/portal/access", "/verifygrid/onboard"):
        status, headers, _ = page(path)
        assert status == 200 and "noindex" in headers.get("x-robots-tag", "")
    checks.append("Private entry points send noindex HTTP headers")

    for path in ("/security-advisories?page=999999", "/resources?page=999999", "/qcs-audit-nonexistent-page"):
        status, _, parsed = page(path)
        assert status == 404 or (status == 200 and "noindex" in parsed.meta.get("robots", ""))
    checks.append("Out-of-range and missing pages are not indexable")

    agents = ["Googlebot", "bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]
    for agent in agents:
        status, _, _, body, _ = fetch(origin + "/security-advisories?page=2", user_agent=agent)
        assert status == 200 and "<h1" in body
    checks.append("Five crawler user-agent probes receive public HTML (not a verification of real crawler IP access)")
    print(json.dumps({"origin": origin, "checks": checks, "passed": len(checks)}, indent=2), flush=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--origin", default="http://127.0.0.1:3057")
    args = parser.parse_args()
    verify(args.origin.rstrip("/"))
