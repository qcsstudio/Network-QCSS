export type SectionResult<T> =
  | { available: true; data: T }
  | { available: false; data: null };

// Read failures must not look like empty, healthy collections or grant access.
export async function loadSection<T>(name: string, read: () => Promise<T>): Promise<SectionResult<T>> {
  try {
    return { available: true, data: await read() };
  } catch (error) {
    console.error(`${name} is unavailable.`, error);
    return { available: false, data: null };
  }
}
