const unsupported = new Set(["allOf", "oneOf", "not", "dependentRequired", "dependentSchemas", "if", "then", "else"]);

export function assertCcnaOpenAISchema(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value) || !("type" in value) || value.type !== "object" || "anyOf" in value) {
    throw new Error("CCNA OpenAI schema must have a strict object root.");
  }
  const root = value as Record<string, unknown>;
  const issues: string[] = [];
  function visit(schema: unknown, path: string) {
    if (!schema || typeof schema !== "object" || Array.isArray(schema)) return;
    const node = schema as Record<string, unknown>;
    for (const keyword of Object.keys(node)) if (unsupported.has(keyword)) issues.push(`${path}: unsupported ${keyword}`);
    if (node.format === "uri") issues.push(`${path}: unsupported uri format`);
    if ("$ref" in node) {
      let target: unknown = root;
      if (typeof node.$ref !== "string" || !node.$ref.startsWith("#/")) target = undefined;
      else for (const key of node.$ref.slice(2).split("/").map((key) => key.replace(/~1/g, "/").replace(/~0/g, "~"))) {
        target = target && typeof target === "object" && Object.hasOwn(target, key) ? (target as Record<string, unknown>)[key] : undefined;
      }
      if (!target || typeof target !== "object") issues.push(`${path}: unresolved local reference`);
    }
    if (node.type === "object" || Array.isArray(node.type) && node.type.includes("object")) {
      const keys = Object.keys((node.properties || {}) as object);
      const required = Array.isArray(node.required) ? node.required : [];
      if (node.additionalProperties !== false || required.length !== keys.length || new Set(required).size !== keys.length || keys.some((key) => !required.includes(key))) {
        issues.push(`${path}: every property must be required and additionalProperties must be false`);
      }
    }
    for (const name of ["properties", "$defs"]) {
      if (node[name] && typeof node[name] === "object") for (const [key, child] of Object.entries(node[name])) visit(child, `${path}/${name}/${key}`);
    }
    visit(node.items, `${path}/items`);
    if (Array.isArray(node.anyOf)) node.anyOf.forEach((child, index) => visit(child, `${path}/anyOf/${index}`));
  }
  visit(root, "schema");
  if (issues.length) throw new Error(`CCNA OpenAI schema preflight failed: ${issues.join("; ")}`);
}
