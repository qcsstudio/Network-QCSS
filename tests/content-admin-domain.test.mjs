import assert from "node:assert/strict";
import test from "node:test";
import {
  assertContentPostAction,
  canRunContentPostAction,
  emptyContentPostStatusCounts,
  normalizeContentPostListQuery
} from "../src/lib/content-admin-domain.ts";

test("content list query normalization constrains search, paging, filters, and sorting", () => {
  assert.deepEqual(
    normalizeContentPostListQuery({
      format: "BLOG",
      page: "-4",
      pageSize: "500",
      q: "  Cisco   firewall  ",
      sort: "title-asc",
      status: "PUBLISHED"
    }),
    {
      format: "blog",
      page: 1,
      pageSize: 50,
      query: "Cisco firewall",
      sort: "title-asc",
      status: "published"
    }
  );

  assert.deepEqual(normalizeContentPostListQuery({ format: "video", sort: "random", status: "scheduled" }), {
    format: "all",
    page: 1,
    pageSize: 12,
    query: "",
    sort: "updated-desc",
    status: "all"
  });
});

test("editorial workflow only permits reviewed publication transitions", () => {
  assert.equal(canRunContentPostAction("draft", "approve"), true);
  assert.equal(canRunContentPostAction("draft", "publish"), false);
  assert.equal(canRunContentPostAction("approved", "publish"), true);
  assert.equal(canRunContentPostAction("published", "draft"), true);
  assert.equal(canRunContentPostAction("published", "save"), false);
  assert.equal(canRunContentPostAction("deleted", "restore"), true);
  assert.throws(() => assertContentPostAction("published", "save"), /Cannot save content in published status/);
});

test("status counters always expose every editorial state", () => {
  assert.deepEqual(emptyContentPostStatusCounts(), {
    draft: 0,
    approved: 0,
    published: 0,
    archived: 0,
    deleted: 0
  });
});
