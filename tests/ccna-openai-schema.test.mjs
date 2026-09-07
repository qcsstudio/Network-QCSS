import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { ccnaGeneratedLessonSchema, ccnaOpenAIResponseSchema } from "../src/lib/ccna-lesson-schema.ts";
import { ccnaLessonPartSchemas } from "../src/lib/ccna-lesson-writer.ts";
import { assertCcnaOpenAISchema } from "../src/lib/ccna-openai-schema.ts";

const urls = ["https://www.cisco.com/", "https://docs.gns3.com/docs/emulators/vpcs"];

test("every final writing schema is checked recursively and uses direct citation references", () => {
  for (const allowed of [undefined, [], urls, [...urls, urls[0]]]) {
    const schema = ccnaOpenAIResponseSchema(allowed);
    assert.doesNotThrow(() => assertCcnaOpenAISchema(schema));
    assert.equal(JSON.stringify(schema).includes('"allOf"'), false);
    const parts = ccnaLessonPartSchemas(schema);
    assert.deepEqual(parts.map((part) => part.name), ["lab", "teaching", "assessment"]);
    for (const { schema: part } of parts) assert.doesNotThrow(() => assertCcnaOpenAISchema(part));
    if (allowed?.length) {
      assert.deepEqual(schema.properties.sources.items.properties.url, { $ref: "#/$defs/verifiedSourceUrl" });
      assert.deepEqual(schema.properties.sections.items.properties.sourceUrls.items, { $ref: "#/$defs/verifiedSourceUrl" });
      assert.deepEqual(schema.$defs.verifiedSourceUrl, { type: "string", maxLength: 1000, enum: urls });
    } else assert.equal(schema.properties.sources.items.properties.url.maxLength, 1000);
  }
});

test("regression: Zod draft-7 callback references introduce the exact rejected allOf wrapper", () => {
  const broken = z.toJSONSchema(ccnaGeneratedLessonSchema.omit({ teachingPrelude: true }), { target: "draft-7", override: ({ jsonSchema }) => {
    if (jsonSchema.format === "uri") {
      delete jsonSchema.format; delete jsonSchema.type; delete jsonSchema.maxLength;
      jsonSchema.$ref = "#/$defs/verifiedSourceUrl";
    }
  } });
  broken.$defs = { verifiedSourceUrl: { type: "string", enum: urls } };
  assert.ok(broken.properties.sources.items.properties.url.allOf);
  assert.throws(() => assertCcnaOpenAISchema(broken), /sources\/items\/properties\/url: unsupported allOf/);
  assert.throws(() => ccnaLessonPartSchemas(broken), /unsupported allOf/);
});

test("preflight rejects unsupported clauses in every branch without dropping their constraints", () => {
  for (const keyword of ["allOf", "oneOf", "not", "dependentRequired", "dependentSchemas", "if", "then", "else"]) {
    const schema = ccnaOpenAIResponseSchema(urls);
    schema.properties.visualStory.properties.stages.items[keyword] = [];
    assert.throws(() => assertCcnaOpenAISchema(schema), new RegExp(`unsupported ${keyword}`));
    assert.ok(keyword in schema.properties.visualStory.properties.stages.items);
  }
});

test("preflight catches dangling references, permissive objects and missing required properties", () => {
  const schema = ccnaOpenAIResponseSchema(urls);
  delete schema.$defs.verifiedSourceUrl;
  schema.properties.lab.additionalProperties = true;
  schema.required = schema.required.slice(1);
  assert.throws(() => assertCcnaOpenAISchema(schema), (error) => /unresolved local reference/.test(error.message) && /additionalProperties must be false/.test(error.message));
});
