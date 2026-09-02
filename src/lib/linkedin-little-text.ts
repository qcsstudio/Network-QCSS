const reservedCharacters = new Set(["|", "{", "}", "@", "[", "]", "(", ")", "<", ">", "#", "\\", "*", "_", "~"]);

function isHashtagCharacter(value: string) {
  return /^[A-Za-z0-9]$/.test(value);
}

export function encodeLinkedInLittleText(value: string) {
  let encoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const previous = value[index - 1] || "";
    const next = value[index + 1] || "";

    if (character === "#" && (!previous || /\s/.test(previous)) && isHashtagCharacter(next)) {
      let end = index + 1;
      while (end < value.length && isHashtagCharacter(value[end])) end += 1;
      encoded += value.slice(index, end);
      index = end - 1;
      continue;
    }

    encoded += reservedCharacters.has(character) ? `\\${character}` : character;
  }

  return encoded;
}

export function decodeLinkedInLittleText(value: string) {
  let decoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const next = value[index + 1] || "";
    if (character === "\\" && reservedCharacters.has(next)) {
      decoded += next;
      index += 1;
      continue;
    }
    decoded += character;
  }

  return decoded;
}

function normalizeForComparison(value: string) {
  return value.replace(/\r\n?/g, "\n").trim();
}

export function linkedInLittleTextMatches(liveCommentary: string, expectedCommentary: string) {
  const expected = normalizeForComparison(expectedCommentary);
  const live = normalizeForComparison(liveCommentary);
  return live === expected || normalizeForComparison(decodeLinkedInLittleText(live)) === expected;
}
