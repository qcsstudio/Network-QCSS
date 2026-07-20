const baseUrl = (process.env.CONTENT_STUDIO_URL || "http://localhost:3000").replace(/\/$/, "");
const token = process.env.ADMIN_API_TOKEN;
const staticSlug = process.argv[2] || "cisco-roomos-security-hardening-release-july-2026";

if (!token) {
  console.error("ADMIN_API_TOKEN is required.");
  process.exit(1);
}

const headers = {
  "content-type": "application/json",
  "x-admin-token": token
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed with HTTP ${response.status}.`);
  return payload;
}

async function main() {
  const queue = await request("/api/admin/content-posts");
  let post = queue.posts.find((item) => item.slug === staticSlug);

  if (!post) {
    ({ post } = await request("/api/admin/content-posts", {
      method: "POST",
      body: JSON.stringify({ staticSlug })
    }));
    console.log(`Created ${post.slug} as ${post.status}.`);
  } else {
    console.log(`Found ${post.slug} as ${post.status}.`);
  }

  if (post.status === "draft") {
    ({ post } = await request(`/api/admin/content-posts/${post.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "approve" })
    }));
    console.log(`Approved ${post.slug}.`);
  }

  if (post.status === "approved") {
    ({ post } = await request(`/api/admin/content-posts/${post.id}`, {
      method: "PATCH",
      body: JSON.stringify({ action: "publish" })
    }));
    console.log(`Published ${post.slug}.`);
  }

  if (post.status !== "published") {
    throw new Error(`Article is ${post.status}; expected published.`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
