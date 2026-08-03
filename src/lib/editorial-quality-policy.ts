export const editorialVisualQualityPolicy = {
  hero: { width: 1440, height: 810, maximumDisplayWidth: 720 },
  social: { width: 1200, height: 627, maximumDisplayWidth: 600 },
  minimumContrastRatio: 4.5,
  minimumInformationalFontSize: 18,
  minimumMicrocopyFontSize: 16,
  maximumLabelCharacters: 32,
  maximumLabelWords: 6,
  minimumReadingScore: 90
} as const;

export const editorialVisualQualityInstructions = [
  "- Retina and resize quality are mandatory: compose a sharp source that remains clear at one-half of its source width, including the 1200 x 627 LinkedIn derivative at a 600 CSS-pixel display width.",
  "- Keep one unmistakable focal story, strong edge separation, and at least 4.5:1 effective contrast for every essential subject or later QCS text overlay.",
  "- Preserve essential subjects within the safe crop and avoid fine details that disappear in a mobile feed or after platform compression.",
  "- Any later QCS informational label must use at least 18 px source type, no more than 32 characters or six words per line, generous padding, and plain language. Microcopy may use 16 px only when it is non-essential.",
  "- Treat blur, weak contrast, cramped labels, tiny text, dense copy, ambiguous hierarchy, and important detail lost after resizing as publication-blocking defects."
] as const;

export const editorialReadingQualityInstruction =
  "Keep explanatory prose easy to scan: prefer active voice, average sentences below 22 words, paragraphs of two to four sentences, and define unavoidable jargon at first use. Aim for a Flesch Reading Ease score of 60 or higher where technical accuracy permits; never simplify away an important qualification.";

type VisualTextSample = {
  background: string;
  fontSize: number;
  foreground: string;
  role?: "informational" | "microcopy";
  text: string;
};

function rgb(hex: string) {
  const value = hex.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(value)) throw new Error(`Invalid visual-quality color: ${hex}.`);
  return [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
}

function luminance(hex: string) {
  const [red, green, blue] = rgb(hex).map((channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

export function contrastRatio(foreground: string, background: string) {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

export function visualReadingAssessment(samples: VisualTextSample[]) {
  const violations: string[] = [];
  for (const sample of samples) {
    const text = sample.text.replace(/\s+/g, " ").trim();
    const minimumFontSize =
      sample.role === "microcopy"
        ? editorialVisualQualityPolicy.minimumMicrocopyFontSize
        : editorialVisualQualityPolicy.minimumInformationalFontSize;
    if (sample.fontSize < minimumFontSize) violations.push(`"${text}" uses ${sample.fontSize}px type; minimum is ${minimumFontSize}px`);
    if (text.length > editorialVisualQualityPolicy.maximumLabelCharacters) {
      violations.push(`"${text}" exceeds ${editorialVisualQualityPolicy.maximumLabelCharacters} characters`);
    }
    if (text.split(" ").filter(Boolean).length > editorialVisualQualityPolicy.maximumLabelWords) {
      violations.push(`"${text}" exceeds ${editorialVisualQualityPolicy.maximumLabelWords} words`);
    }
    const ratio = contrastRatio(sample.foreground, sample.background);
    if (ratio < editorialVisualQualityPolicy.minimumContrastRatio) {
      violations.push(`"${text}" has ${ratio.toFixed(2)}:1 contrast; minimum is ${editorialVisualQualityPolicy.minimumContrastRatio}:1`);
    }
  }
  return {
    score: Math.max(0, 100 - violations.length * 12),
    violations: [...new Set(violations)]
  };
}

export function assertRetinaVariantDimensions(variant: "hero" | "social", width: number, height: number) {
  const target = editorialVisualQualityPolicy[variant];
  if (width < target.width || height < target.height || width < target.maximumDisplayWidth * 2) {
    throw new Error(
      `Editorial ${variant} image is not Retina-ready: received ${width} x ${height}; require at least ${target.width} x ${target.height}.`
    );
  }
}
