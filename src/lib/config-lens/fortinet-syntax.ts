// Fortinet strings can contain escaped quotes, spaces and physical newlines.
// Scan command boundaries before masking so payload text never becomes CLI syntax.
export function* fortinetCommandRanges(lines: string[]) {
  let start = 0, quote = "", continued = false;
  for (let index = 0; index < lines.length; index++) {
    if (!quote && !continued) {
      start = index;
      if (/^\s*(?:[!#:]|\[MASKED:)/.test(lines[index])) {
        yield { start, end: index };
        continue;
      }
    }
    continued = false;
    const text = lines[index];
    for (let offset = 0; offset < text.length; offset++) {
      const char = text[offset];
      if (char === "\\") {
        if (offset === text.length - 1) continued = true;
        else offset++;
      } else if (quote) {
        if (char === quote) quote = "";
      } else if (char === '"' || char === "'") quote = char;
    }
    if (!quote && !continued) yield { start, end: index };
  }
  if (quote || continued) throw new Error(`Unterminated Fortinet quoted value or line continuation starting at line ${start + 1}. Include the complete value; no partial analysis was produced.`);
}

export function fortinetWords(value: string) {
  const words: string[] = [];
  let word = "", quote = "", started = false;
  for (let index = 0; index < value.length; index++) {
    const char = value[index];
    if (char === "\\" && index + 1 < value.length) {
      word += value[++index]; started = true;
    } else if (quote) {
      if (char === quote) quote = "";
      else word += char;
    } else if (char === '"' || char === "'") {
      quote = char; started = true;
    } else if (/\s/.test(char)) {
      if (started) { words.push(word); word = ""; started = false; }
    } else { word += char; started = true; }
  }
  if (started) words.push(word);
  return words;
}
