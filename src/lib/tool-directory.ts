export type DirectoryTool = { slug: string; title: string; description: string; category: string };

export function filterDirectoryTools(tools: readonly DirectoryTool[], query: string, category: string, order: string) {
  const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = tools.filter((tool) => {
    const text = `${tool.title} ${tool.description} ${tool.category} ${tool.slug}`.toLocaleLowerCase();
    return (!category || tool.category === category) && terms.every((term) => text.includes(term));
  });
  return order === "name" ? matches.sort((a, b) => a.title.localeCompare(b.title)) : matches;
}
