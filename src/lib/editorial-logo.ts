import { readFile } from "node:fs/promises";
import path from "node:path";

let cachedLogo: string | null = null;

export async function qcsEditorialLogo() {
  if (cachedLogo) return cachedLogo;
  const logo = await readFile(path.join(process.cwd(), "public", "brand", "quantumcrafters-logo.png"));
  cachedLogo = `data:image/png;base64,${logo.toString("base64")}`;
  return cachedLogo;
}
