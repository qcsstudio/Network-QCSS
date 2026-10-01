import sharp from "sharp";

// A compact difference hash catches reused compositions even when colour or compression changes.
export async function editorialPerceptualHash(source: Uint8Array) {
  const pixels = await sharp(source).flatten({ background: "white" }).resize(17, 16, { fit: "fill" }).greyscale().raw().toBuffer();
  let bits = "";
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) bits += pixels[y * 17 + x] > pixels[y * 17 + x + 1] ? "1" : "0";
  return Array.from({ length: 64 }, (_, index) => parseInt(bits.slice(index * 4, index * 4 + 4), 2).toString(16)).join("");
}

export function visuallyRepeated(hash: string, recent: string[], maximumDistance = 8) {
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Invalid image similarity hash.");
  return recent.some((other) => {
    if (!/^[a-f0-9]{64}$/.test(other)) return false;
    let distance = 0;
    for (let i = 0; i < hash.length; i++) distance += (parseInt(hash[i], 16) ^ parseInt(other[i], 16)).toString(2).replace(/0/g, "").length;
    return distance <= maximumDistance;
  });
}
