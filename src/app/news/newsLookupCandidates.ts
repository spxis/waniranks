const KANJI_REGEX = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF]/;
const KANA_REGEX = /[\u3040-\u309F\u30A0-\u30FFー]/;

type Segment = { kind: "kanji" | "other"; text: string };

export function buildLookupCandidates(segments: Segment[], index: number): string[] {
  const run = segments[index]?.text ?? "";
  if (!run) {
    return [];
  }

  const prevKana = trailingKana(segments[index - 1]?.kind === "other" ? segments[index - 1].text : "", 2);
  const nextKana = leadingKana(segments[index + 1]?.kind === "other" ? segments[index + 1].text : "", 3);
  const suffixVariants = kanaPrefixVariants(nextKana);

  const out: string[] = [run];
  for (const suffix of suffixVariants) {
    if (!suffix) {
      continue;
    }
    out.push(`${run}${suffix}`);
  }
  for (const suffix of suffixVariants) {
    out.push(`${prevKana}${run}${suffix}`);
    out.push(`${run}${suffix}`);
  }
  out.push(`${prevKana}${run}`);

  const normalized = Array.from(new Set(out.map((value) => value.trim()).filter((value) => value.length > 0)));
  return expandDictionaryCandidates(expandBySuffixShortening(normalized));
}

export function buildCandidatesFromSelectedText(raw: string): string[] {
  const value = raw.replace(/\s+/g, "").trim();
  if (!value || !KANJI_REGEX.test(value)) {
    return [];
  }

  const out = [value];
  const chars = Array.from(value);
  let tail = 0;
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    if (!KANA_REGEX.test(chars[i] ?? "")) {
      break;
    }
    tail += 1;
  }

  for (let drop = 1; drop <= tail; drop += 1) {
    const candidate = chars.slice(0, chars.length - drop).join("");
    if (!candidate || !KANJI_REGEX.test(candidate)) {
      continue;
    }
    out.push(candidate);
  }

  return Array.from(new Set(out));
}

function expandBySuffixShortening(base: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of base) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }

    const chars = Array.from(value);
    let tail = 0;
    for (let i = chars.length - 1; i >= 0; i -= 1) {
      if (!KANA_REGEX.test(chars[i] ?? "")) {
        break;
      }
      tail += 1;
    }

    for (let drop = 1; drop <= tail; drop += 1) {
      const candidate = chars.slice(0, chars.length - drop).join("");
      if (!candidate || seen.has(candidate) || !KANJI_REGEX.test(candidate)) {
        continue;
      }
      seen.add(candidate);
      out.push(candidate);
    }
  }

  return out;
}

function kanaPrefixVariants(nextKana: string): string[] {
  const chars = Array.from(nextKana);
  if (chars.length === 0) {
    return [""];
  }

  const out: string[] = [];
  for (let length = chars.length; length >= 1; length -= 1) {
    out.push(chars.slice(0, length).join(""));
  }
  out.push("");
  return out;
}

function expandDictionaryCandidates(base: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const value of base) {
    if (!seen.has(value)) {
      seen.add(value);
      out.push(value);
    }

    for (const derived of recoverDictionaryForms(value)) {
      if (seen.has(derived)) {
        continue;
      }
      seen.add(derived);
      out.push(derived);
    }
  }

  return out;
}

function recoverDictionaryForms(value: string): string[] {
  const out: string[] = [];
  const endings = ["たり", "た", "て", "ない", "ます", "ません", "れば", "よう", "ろ"];

  for (const ending of endings) {
    if (!value.endsWith(ending) || value.length <= ending.length) {
      continue;
    }
    const stem = value.slice(0, -ending.length);
    if (looksIchidanStem(stem)) {
      out.push(`${stem}る`);
    }
  }

  if (looksIchidanStem(value)) {
    out.push(`${value}る`);
  }

  return out;
}

function looksIchidanStem(value: string): boolean {
  if (!value || !KANJI_REGEX.test(value)) {
    return false;
  }

  const chars = Array.from(value);
  const last = chars[chars.length - 1] ?? "";
  if (!last || !KANA_REGEX.test(last)) {
    return false;
  }

  return /[いきぎしじちぢにひびぴみりえけげせぜてでねへべぺめれ]/.test(last);
}

function leadingKana(text: string, maxChars: number): string {
  const chars = Array.from(text);
  const out: string[] = [];
  for (const char of chars) {
    if (!KANA_REGEX.test(char)) {
      break;
    }
    out.push(char);
    if (out.length >= maxChars) {
      break;
    }
  }
  return out.join("");
}

function trailingKana(text: string, maxChars: number): string {
  const chars = Array.from(text);
  const out: string[] = [];
  for (let i = chars.length - 1; i >= 0; i -= 1) {
    const char = chars[i];
    if (!KANA_REGEX.test(char)) {
      break;
    }
    out.push(char);
    if (out.length >= maxChars) {
      break;
    }
  }
  return out.reverse().join("");
}
