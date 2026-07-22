"use client";

import {
  Braces,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  LifeBuoy,
  LockKeyhole,
  Minus,
  Plus,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Smartphone,
  Wifi
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { trackBrowserEvent } from "@/lib/client-tracking";

type ScenarioId = "manager" | "privileged" | "legacy" | "wifi" | "passphrase" | "pin" | "recovery" | "token";
type GeneratorMode = "characters" | "passphrase" | "pin" | "recovery" | "token";
type TokenAlphabet = "base64url" | "base32" | "hex";

type CharacterOptions = {
  lowercase: boolean;
  uppercase: boolean;
  numbers: boolean;
  symbols: boolean;
  spaces: boolean;
  excludeAmbiguous: boolean;
  avoidAdjacent: boolean;
};

type GeneratorSettings = {
  scenario: ScenarioId;
  length: number;
  quantity: number;
  characterOptions: CharacterOptions;
  wordCount: number;
  separator: string;
  capitalizeWords: boolean;
  phraseNumber: boolean;
  phraseSymbol: boolean;
  pinLength: number;
  recoveryGroups: number;
  recoveryGroupSize: number;
  tokenLength: number;
  tokenPrefix: string;
  tokenAlphabet: TokenAlphabet;
};

type Scenario = {
  id: ScenarioId;
  label: string;
  fit: string;
  description: string;
  mode: GeneratorMode;
  icon: LucideIcon;
  min?: number;
  max?: number;
  presets?: number[];
  settings: Partial<GeneratorSettings> & { characterOptions?: CharacterOptions };
};

type GeneratedSecret = {
  value: string;
  bits: number;
  poolSize: number;
};

const FULL_SYMBOLS = "!@#$%^&*()-_=+[]{};:,.?/|~";
const SAFE_SYMBOLS = "!@#$%*-_+=?";
const BASE32_READABLE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const BASE64_URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
const HEX = "0123456789abcdef";

const adjectives = [
  "amber",
  "arctic",
  "bold",
  "bright",
  "calm",
  "cedar",
  "clear",
  "cobalt",
  "coral",
  "crisp",
  "delta",
  "eager",
  "ember",
  "frost",
  "golden",
  "grand",
  "green",
  "hidden",
  "indigo",
  "lively",
  "lunar",
  "modern",
  "noble",
  "polar",
  "quiet",
  "rapid",
  "silver",
  "steady",
  "swift",
  "urban",
  "vivid",
  "woven"
];

const nouns = [
  "anchor",
  "beacon",
  "bridge",
  "canyon",
  "cedar",
  "circuit",
  "cloud",
  "comet",
  "compass",
  "coral",
  "delta",
  "fabric",
  "forest",
  "gateway",
  "harbor",
  "island",
  "keystone",
  "lattice",
  "meadow",
  "meridian",
  "nimbus",
  "orbit",
  "prairie",
  "quartz",
  "radius",
  "ridge",
  "signal",
  "summit",
  "topaz",
  "valley",
  "vector",
  "zenith"
];

const defaultCharacters: CharacterOptions = {
  lowercase: true,
  uppercase: true,
  numbers: true,
  symbols: true,
  spaces: false,
  excludeAmbiguous: true,
  avoidAdjacent: true
};

const scenarios: Scenario[] = [
  {
    id: "manager",
    label: "Password manager",
    fit: "Manager-safe",
    description: "High-entropy unique password for routine accounts.",
    mode: "characters",
    icon: KeyRound,
    min: 12,
    max: 128,
    presets: [16, 24, 32, 64, 128],
    settings: { length: 24, quantity: 3, characterOptions: defaultCharacters }
  },
  {
    id: "privileged",
    label: "Privileged account",
    fit: "High-value",
    description: "Long secret for administrators, VPNs, and firewalls.",
    mode: "characters",
    icon: ShieldCheck,
    min: 15,
    max: 128,
    presets: [20, 32, 48, 64, 128],
    settings: { length: 32, quantity: 2, characterOptions: defaultCharacters }
  },
  {
    id: "legacy",
    label: "Legacy system",
    fit: "Compatibility",
    description: "Conservative character set for older platforms.",
    mode: "characters",
    icon: ServerCog,
    min: 12,
    max: 32,
    presets: [12, 16, 20, 24, 32],
    settings: { length: 16, quantity: 3, characterOptions: defaultCharacters }
  },
  {
    id: "wifi",
    label: "Wi-Fi key",
    fit: "WPA2 / WPA3",
    description: "Shareable ASCII key within the 8-63 character range.",
    mode: "characters",
    icon: Wifi,
    min: 12,
    max: 63,
    presets: [16, 24, 32, 48, 63],
    settings: { length: 32, quantity: 2, characterOptions: defaultCharacters }
  },
  {
    id: "passphrase",
    label: "Passphrase",
    fit: "Memorable",
    description: "Random compound words for a secret you must enter manually.",
    mode: "passphrase",
    icon: LockKeyhole,
    settings: { wordCount: 6, separator: "-", capitalizeWords: true, phraseNumber: true, phraseSymbol: true, quantity: 3 }
  },
  {
    id: "pin",
    label: "Device PIN",
    fit: "Local unlock",
    description: "Random digits for a rate-limited local device.",
    mode: "pin",
    icon: Smartphone,
    settings: { pinLength: 8, quantity: 3 }
  },
  {
    id: "recovery",
    label: "Recovery code",
    fit: "Grouped code",
    description: "Readable Base32 code with at least 64 random bits.",
    mode: "recovery",
    icon: LifeBuoy,
    settings: { recoveryGroups: 6, recoveryGroupSize: 4, quantity: 5 }
  },
  {
    id: "token",
    label: "API token",
    fit: "Service secret",
    description: "URL-safe random token for automation and integrations.",
    mode: "token",
    icon: Braces,
    settings: { tokenLength: 48, tokenPrefix: "tok", tokenAlphabet: "base64url", quantity: 3 }
  }
];

const initialSettings: GeneratorSettings = {
  scenario: "manager",
  length: 24,
  quantity: 3,
  characterOptions: defaultCharacters,
  wordCount: 6,
  separator: "-",
  capitalizeWords: true,
  phraseNumber: true,
  phraseSymbol: true,
  pinLength: 8,
  recoveryGroups: 6,
  recoveryGroupSize: 4,
  tokenLength: 48,
  tokenPrefix: "tok",
  tokenAlphabet: "base64url"
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function secureIndex(upperBound: number) {
  if (upperBound <= 0) throw new Error("A character set is required.");
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / upperBound) * upperBound;
  const sample = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(sample);
  } while (sample[0] >= limit);
  return sample[0] % upperBound;
}

function pick(source: string) {
  return source[secureIndex(source.length)];
}

function shuffled(values: string[]) {
  const output = [...values];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = secureIndex(index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex], output[index]];
  }
  return output;
}

function hasAdjacentRepeat(value: string) {
  return /(.)\1/.test(value);
}

function titleCase(value: string) {
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function passwordPools(settings: GeneratorSettings) {
  const options = settings.characterOptions;
  const lower = options.excludeAmbiguous ? "abcdefghijkmnpqrstuvwxyz" : "abcdefghijklmnopqrstuvwxyz";
  const upper = options.excludeAmbiguous ? "ABCDEFGHJKLMNPQRSTUVWXYZ" : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = options.excludeAmbiguous ? "23456789" : "0123456789";
  const symbolSet = settings.scenario === "legacy" ? SAFE_SYMBOLS : FULL_SYMBOLS;
  const required = [
    options.lowercase ? lower : "",
    options.uppercase ? upper : "",
    options.numbers ? numbers : "",
    options.symbols ? symbolSet : ""
  ].filter(Boolean);
  const pool = `${required.join("")}${options.spaces ? " " : ""}`;
  return { required, pool };
}

function makeCharacterPassword(settings: GeneratorSettings, profile: Scenario): GeneratedSecret {
  const { required, pool } = passwordPools(settings);
  if (!pool) throw new Error("Select at least one character set.");
  const length = clamp(settings.length, profile.min ?? 12, profile.max ?? 128);

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const values = required.map((source) => pick(source));
    while (values.length < length) values.push(pick(pool));
    const password = shuffled(values).join("");
    if (!settings.characterOptions.avoidAdjacent || !hasAdjacentRepeat(password)) {
      return { value: password, bits: length * Math.log2(pool.length), poolSize: pool.length };
    }
  }

  throw new Error("Unable to satisfy the repeat rule. Adjust the character set and try again.");
}

function makePassphrase(settings: GeneratorSettings): GeneratedSecret {
  const compounds: string[] = [];
  while (compounds.length < settings.wordCount) {
    const adjective = adjectives[secureIndex(adjectives.length)];
    const noun = nouns[secureIndex(nouns.length)];
    const compound = settings.capitalizeWords ? `${titleCase(adjective)}${titleCase(noun)}` : `${adjective}${noun}`;
    if (compound !== compounds.at(-1)) compounds.push(compound);
  }
  const suffixNumber = settings.phraseNumber ? String(secureIndex(90) + 10) : "";
  const suffixSymbol = settings.phraseSymbol ? pick(SAFE_SYMBOLS) : "";
  const suffix = `${suffixNumber}${suffixSymbol}`;
  const value = `${compounds.join(settings.separator)}${suffix ? `${settings.separator}${suffix}` : ""}`;
  const wordBits = settings.wordCount * (Math.log2(adjectives.length) + Math.log2(nouns.length));
  const suffixBits = (settings.phraseNumber ? Math.log2(90) : 0) + (settings.phraseSymbol ? Math.log2(SAFE_SYMBOLS.length) : 0);
  return { value, bits: wordBits + suffixBits, poolSize: adjectives.length * nouns.length };
}

function makePin(settings: GeneratorSettings): GeneratedSecret {
  const length = clamp(settings.pinLength, 6, 12);
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const value = Array.from({ length }, () => String(secureIndex(10))).join("");
    if (!/(.)\1{2}/.test(value) && !value.includes("0123") && !value.includes("1234") && !value.includes("9876")) {
      return { value, bits: length * Math.log2(10), poolSize: 10 };
    }
  }
  throw new Error("Unable to generate a suitable PIN. Try again.");
}

function makeRecoveryCode(settings: GeneratorSettings): GeneratedSecret {
  const groups = clamp(settings.recoveryGroups, 4, 10);
  const size = clamp(settings.recoveryGroupSize, 4, 8);
  const values = Array.from({ length: groups }, () => Array.from({ length: size }, () => pick(BASE32_READABLE)).join(""));
  return { value: values.join("-"), bits: groups * size * Math.log2(BASE32_READABLE.length), poolSize: BASE32_READABLE.length };
}

function tokenPool(alphabet: TokenAlphabet) {
  if (alphabet === "hex") return HEX;
  if (alphabet === "base32") return BASE32_READABLE;
  return BASE64_URL;
}

function makeToken(settings: GeneratorSettings): GeneratedSecret {
  const pool = tokenPool(settings.tokenAlphabet);
  const length = clamp(settings.tokenLength, 16, 128);
  const prefix = settings.tokenPrefix.trim().replace(/[^A-Za-z0-9_-]/g, "").slice(0, 16);
  const body = Array.from({ length }, () => pick(pool)).join("");
  return { value: prefix ? `${prefix}_${body}` : body, bits: length * Math.log2(pool.length), poolSize: pool.length };
}

function generateSecret(settings: GeneratorSettings, profile: Scenario) {
  if (profile.mode === "passphrase") return makePassphrase(settings);
  if (profile.mode === "pin") return makePin(settings);
  if (profile.mode === "recovery") return makeRecoveryCode(settings);
  if (profile.mode === "token") return makeToken(settings);
  return makeCharacterPassword(settings, profile);
}

function strengthFor(bits: number, mode: GeneratorMode) {
  if (mode === "pin") return { label: "Context-bound", score: Math.min(48, Math.round(bits)) };
  if (bits >= 128) return { label: "Exceptional", score: 100 };
  if (bits >= 90) return { label: "Very strong", score: 86 };
  if (bits >= 70) return { label: "Strong", score: 72 };
  if (bits >= 50) return { label: "Moderate", score: 54 };
  return { label: "Limited", score: 34 };
}

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }
  const field = document.createElement("textarea");
  field.value = value;
  field.style.position = "fixed";
  field.style.opacity = "0";
  document.body.appendChild(field);
  field.select();
  document.execCommand("copy");
  field.remove();
}

function Toggle({
  checked,
  disabled,
  label,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={`password-toggle ${disabled ? "disabled" : ""}`}>
      <input checked={checked} disabled={disabled} type="checkbox" onChange={(event) => onChange(event.target.checked)} />
      <span aria-hidden="true" />
      <strong>{label}</strong>
    </label>
  );
}

export function StrongPasswordGenerator() {
  const [settings, setSettings] = useState<GeneratorSettings>(initialSettings);
  const [outputs, setOutputs] = useState<GeneratedSecret[]>([]);
  const [showSecrets, setShowSecrets] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState("");
  const profile = scenarios.find((scenario) => scenario.id === settings.scenario) ?? scenarios[0];
  const ProfileIcon = profile.icon;

  const generate = useCallback(() => {
    try {
      const quantity = clamp(settings.quantity, 1, 10);
      setOutputs(Array.from({ length: quantity }, () => generateSecret(settings, profile)));
      setGenerationError("");
    } catch (error) {
      setOutputs([]);
      setGenerationError(error instanceof Error ? error.message : "Unable to generate this secret.");
    }
  }, [profile, settings]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(generate);
    return () => window.cancelAnimationFrame(frame);
  }, [generate]);

  const strength = strengthFor(outputs[0]?.bits ?? 0, profile.mode);
  const estimatedBits = Math.round(outputs[0]?.bits ?? 0);

  function selectScenario(scenario: Scenario) {
    setSettings((current) => ({
      ...current,
      ...scenario.settings,
      scenario: scenario.id,
      characterOptions: scenario.settings.characterOptions ? { ...scenario.settings.characterOptions } : current.characterOptions
    }));
  }

  function setCharacterOption(name: keyof CharacterOptions, value: boolean) {
    setSettings((current) => ({
      ...current,
      characterOptions: { ...current.characterOptions, [name]: value }
    }));
  }

  function regenerate() {
    generate();
    trackBrowserEvent("network_tool_run", {
      tool: "strong-password-generator",
      category: "Cybersecurity tools",
      scenario: settings.scenario,
      status: "ok"
    });
  }

  async function copy(value: string, key: string) {
    await copyText(value);
    setCopied(key);
    window.setTimeout(() => setCopied((current) => (current === key ? null : current)), 1800);
  }

  const length = clamp(settings.length, profile.min ?? 12, profile.max ?? 128);

  return (
    <div className="password-studio">
      <header className="password-studio-header">
        <div>
          <p className="eyebrow">Secure generation workspace</p>
          <h2>Generate for the system, not a generic rule.</h2>
          <p>Choose a real credential scenario and adjust only the controls that apply to it.</p>
        </div>
        <div className="password-local-status">
          <ShieldCheck size={20} />
          <span>
            <strong>Generated locally</strong>
            No secret leaves this browser
          </span>
        </div>
      </header>

      <div className="password-scenario-tabs" role="group" aria-label="Credential scenario">
        {scenarios.map((scenario) => {
          const Icon = scenario.icon;
          const active = scenario.id === settings.scenario;
          return (
            <button
              aria-pressed={active}
              className={active ? "active" : ""}
              key={scenario.id}
              type="button"
              onClick={() => selectScenario(scenario)}
            >
              <Icon size={19} />
              <span>
                <strong>{scenario.label}</strong>
                <small>{scenario.fit}</small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="password-studio-grid">
        <section className="password-control-panel" aria-label={`${profile.label} settings`}>
          <div className="password-panel-heading">
            <div>
              <p className="eyebrow">{profile.fit}</p>
              <h3>{profile.label}</h3>
            </div>
            <ProfileIcon size={28} aria-hidden="true" />
          </div>
          <p className="password-profile-description">{profile.description}</p>

          {profile.mode === "characters" && (
            <>
              <div className="password-control-group">
                <div className="password-label-row">
                  <label htmlFor="password-length">Character length</label>
                  <div className="password-stepper">
                    <button
                      aria-label="Reduce character length"
                      title="Reduce length"
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, length: clamp(length - 1, profile.min ?? 12, profile.max ?? 128) }))}
                    >
                      <Minus size={16} />
                    </button>
                    <input
                      aria-label="Character length"
                      id="password-length-number"
                      max={profile.max}
                      min={profile.min}
                      type="number"
                      value={length}
                      onChange={(event) =>
                        setSettings((current) => ({
                          ...current,
                          length: clamp(Number(event.target.value), profile.min ?? 12, profile.max ?? 128)
                        }))
                      }
                    />
                    <button
                      aria-label="Increase character length"
                      title="Increase length"
                      type="button"
                      onClick={() => setSettings((current) => ({ ...current, length: clamp(length + 1, profile.min ?? 12, profile.max ?? 128) }))}
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                </div>
                <input
                  aria-label="Password length slider"
                  id="password-length"
                  max={profile.max}
                  min={profile.min}
                  type="range"
                  value={length}
                  onChange={(event) => setSettings((current) => ({ ...current, length: Number(event.target.value) }))}
                />
                <div className="password-presets" aria-label="Length presets">
                  {profile.presets?.map((preset) => (
                    <button className={length === preset ? "active" : ""} key={preset} type="button" onClick={() => setSettings((current) => ({ ...current, length: preset }))}>
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              <div className="password-control-group">
                <span className="password-group-label">Character set</span>
                <div className="password-toggle-grid">
                  <Toggle checked={settings.characterOptions.lowercase} label="Lowercase" onChange={(value) => setCharacterOption("lowercase", value)} />
                  <Toggle checked={settings.characterOptions.uppercase} label="Uppercase" onChange={(value) => setCharacterOption("uppercase", value)} />
                  <Toggle checked={settings.characterOptions.numbers} label="Numbers" onChange={(value) => setCharacterOption("numbers", value)} />
                  <Toggle checked={settings.characterOptions.symbols} label="Symbols" onChange={(value) => setCharacterOption("symbols", value)} />
                  <Toggle
                    checked={settings.characterOptions.spaces}
                    disabled={settings.scenario === "wifi" || settings.scenario === "legacy"}
                    label="Allow spaces"
                    onChange={(value) => setCharacterOption("spaces", value)}
                  />
                  <Toggle checked={settings.characterOptions.excludeAmbiguous} label="Avoid Il1O0o" onChange={(value) => setCharacterOption("excludeAmbiguous", value)} />
                  <Toggle checked={settings.characterOptions.avoidAdjacent} label="No adjacent repeats" onChange={(value) => setCharacterOption("avoidAdjacent", value)} />
                </div>
              </div>
            </>
          )}

          {profile.mode === "passphrase" && (
            <div className="password-control-group password-parameter-grid">
              <label>
                Compound words
                <input
                  max={10}
                  min={4}
                  type="number"
                  value={settings.wordCount}
                  onChange={(event) => setSettings((current) => ({ ...current, wordCount: clamp(Number(event.target.value), 4, 10) }))}
                />
              </label>
              <label>
                Separator
                <select value={settings.separator} onChange={(event) => setSettings((current) => ({ ...current, separator: event.target.value }))}>
                  <option value="-">Dash</option>
                  <option value=" ">Space</option>
                  <option value="_">Underscore</option>
                  <option value=".">Period</option>
                </select>
              </label>
              <Toggle checked={settings.capitalizeWords} label="Capitalize" onChange={(value) => setSettings((current) => ({ ...current, capitalizeWords: value }))} />
              <Toggle checked={settings.phraseNumber} label="Number suffix" onChange={(value) => setSettings((current) => ({ ...current, phraseNumber: value }))} />
              <Toggle checked={settings.phraseSymbol} label="Symbol suffix" onChange={(value) => setSettings((current) => ({ ...current, phraseSymbol: value }))} />
            </div>
          )}

          {profile.mode === "pin" && (
            <div className="password-control-group password-parameter-grid">
              <label>
                PIN length
                <input
                  max={12}
                  min={6}
                  type="number"
                  value={settings.pinLength}
                  onChange={(event) => setSettings((current) => ({ ...current, pinLength: clamp(Number(event.target.value), 6, 12) }))}
                />
              </label>
              <p className="password-context-note">Use only with device lockout, retry limits, and remote-wipe controls.</p>
            </div>
          )}

          {profile.mode === "recovery" && (
            <div className="password-control-group password-parameter-grid two-column">
              <label>
                Groups
                <input
                  max={10}
                  min={4}
                  type="number"
                  value={settings.recoveryGroups}
                  onChange={(event) => setSettings((current) => ({ ...current, recoveryGroups: clamp(Number(event.target.value), 4, 10) }))}
                />
              </label>
              <label>
                Characters per group
                <input
                  max={8}
                  min={4}
                  type="number"
                  value={settings.recoveryGroupSize}
                  onChange={(event) => setSettings((current) => ({ ...current, recoveryGroupSize: clamp(Number(event.target.value), 4, 8) }))}
                />
              </label>
            </div>
          )}

          {profile.mode === "token" && (
            <div className="password-control-group password-parameter-grid two-column">
              <label>
                Token characters
                <input
                  max={128}
                  min={16}
                  type="number"
                  value={settings.tokenLength}
                  onChange={(event) => setSettings((current) => ({ ...current, tokenLength: clamp(Number(event.target.value), 16, 128) }))}
                />
              </label>
              <label>
                Prefix
                <input
                  autoComplete="off"
                  maxLength={16}
                  spellCheck={false}
                  type="text"
                  value={settings.tokenPrefix}
                  onChange={(event) => setSettings((current) => ({ ...current, tokenPrefix: event.target.value }))}
                />
              </label>
              <label className="full-width">
                Alphabet
                <select value={settings.tokenAlphabet} onChange={(event) => setSettings((current) => ({ ...current, tokenAlphabet: event.target.value as TokenAlphabet }))}>
                  <option value="base64url">Base64 URL-safe</option>
                  <option value="base32">Base32 readable</option>
                  <option value="hex">Hexadecimal</option>
                </select>
              </label>
            </div>
          )}

          <div className="password-control-footer">
            <label>
              Quantity
              <input
                max={10}
                min={1}
                type="number"
                value={settings.quantity}
                onChange={(event) => setSettings((current) => ({ ...current, quantity: clamp(Number(event.target.value), 1, 10) }))}
              />
            </label>
            <button className="button primary" type="button" onClick={regenerate}>
              <RefreshCw size={18} />
              Regenerate
            </button>
          </div>
        </section>

        <section className="password-output-panel" aria-label="Generated secrets">
          <div className="password-output-heading">
            <div>
              <p className="eyebrow">Generated output</p>
              <h3>{profile.fit} set</h3>
            </div>
            <div className="password-output-actions">
              <button aria-label={showSecrets ? "Hide generated secrets" : "Show generated secrets"} title={showSecrets ? "Hide values" : "Show values"} type="button" onClick={() => setShowSecrets((current) => !current)}>
                {showSecrets ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <button
                aria-label="Copy every generated secret"
                disabled={!outputs.length}
                title="Copy all"
                type="button"
                onClick={() => copy(outputs.map((output) => output.value).join("\n"), "all")}
              >
                {copied === "all" ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>
          </div>
          <p className="password-generation-status" role="status">
            {generationError || `${outputs.length} ${profile.label.toLowerCase()} values generated locally.`}
          </p>

          {generationError ? (
            <div className="password-generation-error" role="alert">
              <strong>Settings need attention</strong>
              <p>{generationError}</p>
            </div>
          ) : (
            <div className="password-output-list">
              {outputs.map((output, index) => (
                <div className="password-output-row" key={`${settings.scenario}-${index}`}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <input
                    aria-label={`Generated ${profile.label} ${index + 1}`}
                    autoComplete="off"
                    readOnly
                    spellCheck={false}
                    type={showSecrets ? "text" : "password"}
                    value={output.value}
                  />
                  <button aria-label={`Copy generated value ${index + 1}`} title="Copy" type="button" onClick={() => copy(output.value, String(index))}>
                    {copied === String(index) ? <Check size={17} /> : <Copy size={17} />}
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="password-strength-panel">
            <div className="password-strength-heading">
              <span>Random search-space estimate</span>
              <strong>{strength.label}</strong>
            </div>
            <div className="password-strength-track" aria-hidden="true">
              <span style={{ width: `${strength.score}%` }} />
            </div>
            <div className="password-strength-metrics">
              <span>
                <strong>{estimatedBits}</strong>
                estimated bits
              </span>
              <span>
                <strong>{outputs[0]?.poolSize ?? 0}</strong>
                choice pool
              </span>
              <span>
                <strong>{outputs[0]?.value.length ?? 0}</strong>
                output length
              </span>
            </div>
          </div>

          <p className="password-output-note">
            Estimate assumes an unedited Web Crypto output. Store passwords in a password manager, keep recovery codes offline, and rotate any secret exposed during handover.
          </p>
          <div className="password-handling-strip" aria-label="Secret handling checklist">
            <span>
              <Check size={16} />
              Unique per system
            </span>
            <span>
              <Check size={16} />
              Vault immediately
            </span>
            <span>
              <Check size={16} />
              Rotate after exposure
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}
