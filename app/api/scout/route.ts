import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IP_AU_SEARCH_URL =
  "https://production.api.ipaustralia.gov.au/public/australian-trade-mark-search-api/v1/search/quick";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-pro";

type IpAuHit = {
  wordsAndImages?: string;
  tradeMarkNumber?: string | number;
  lodgementDate?: string;
  status?: string;
  niceClasses?: number[];
};

type EnrichedBrand = {
  word: string;
  niceClass: number;
  aesthetic_score: number;
  mood_board_prompt: string;
};

class StepError extends Error {
  constructor(
    public step: string,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
  }
}

function decadeToRange(decade: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})s$/.exec(decade);
  if (!match) throw new StepError("parse_decade", `Invalid decade: ${decade}`);
  const start = parseInt(match[1], 10);
  return {
    startDate: `${start}-01-01`,
    endDate: `${start + 9}-12-31`,
  };
}

async function fetchDeadTrademarks(
  niceClass: number,
  startDate: string,
  endDate: string,
): Promise<IpAuHit[]> {
  const token = process.env.IP_AUSTRALIA_TOKEN;
  if (!token) {
    throw new StepError(
      "ip_australia_auth",
      "IP_AUSTRALIA_TOKEN is not set. Register at https://developer.ipaustralia.gov.au to get a JWT, then add it to Netlify env.",
    );
  }

  const body = {
    quickSearchType: "WORD",
    status: ["DEAD", "REMOVED", "CANCELLED"],
    niceClasses: [niceClass],
    lodgementDateFrom: startDate,
    lodgementDateTo: endDate,
    pageSize: 100,
    pageNumber: 0,
  };

  let res: Response;
  try {
    res = await fetch(IP_AU_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new StepError(
      "ip_australia_fetch",
      `Network error calling IP Australia: ${(e as Error).message}`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new StepError(
      "ip_australia_http",
      `IP Australia search returned ${res.status}`,
      text.slice(0, 500),
    );
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch (e) {
    throw new StepError(
      "ip_australia_parse",
      `IP Australia returned non-JSON: ${(e as Error).message}`,
    );
  }

  const d = data as { results?: IpAuHit[]; hits?: IpAuHit[] };
  return d.results ?? d.hits ?? [];
}

// Placeholder for a domain availability check.
// TODO: Wire up a real domain availability API (e.g. Domainr, WhoisXML, or
// auDA-accredited registrar API) to confirm .com.au and .com are unregistered.
async function isDomainAvailable(_word: string): Promise<boolean> {
  return true;
}

async function enrichWithGemini(
  ai: GoogleGenAI,
  word: string,
  niceClass: number,
): Promise<EnrichedBrand | null> {
  const prompt = `You are a vintage brand appraiser. Analyze this abandoned Australian trademark and its original product class. Output a JSON object with: 1. aesthetic_score (1-10, rating how premium it sounds) and 2. mood_board_prompt (A detailed, atmospheric image generation prompt to visually reboot this brand for high-end e-commerce. Focus on era-appropriate lighting and textures).

Trademark word: "${word}"
Nice Class: ${niceClass}

Respond with ONLY valid JSON in this exact shape:
{"aesthetic_score": <number 1-10>, "mood_board_prompt": "<string>"}`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      responseMimeType: "application/json",
    },
  });

  const text = response.text ?? "";
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();

  try {
    const parsed = JSON.parse(cleaned) as {
      aesthetic_score: number;
      mood_board_prompt: string;
    };
    return {
      word,
      niceClass,
      aesthetic_score: Number(parsed.aesthetic_score),
      mood_board_prompt: String(parsed.mood_board_prompt),
    };
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  let step = "init";
  try {
    step = "env_check";
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
      throw new StepError(step, "Supabase env vars are missing");
    }
    if (!process.env.GEMINI_API_KEY) {
      throw new StepError(step, "GEMINI_API_KEY is not set in this environment");
    }

    step = "parse_body";
    const { decade, niceClass } = (await request.json()) as {
      decade: string;
      niceClass: number;
    };
    if (!decade || typeof niceClass !== "number") {
      throw new StepError(step, "Missing decade or niceClass");
    }

    step = "parse_decade";
    const { startDate, endDate } = decadeToRange(decade);

    step = "ip_australia_fetch";
    const hits = await fetchDeadTrademarks(niceClass, startDate, endDate);

    step = "dedupe_candidates";
    const seen = new Set<string>();
    const candidates = hits
      .map((h) => (h.wordsAndImages ?? "").trim())
      .filter((w) => {
        if (!w) return false;
        const key = w.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    step = "domain_check";
    const survivors: string[] = [];
    for (const word of candidates) {
      if (await isDomainAvailable(word)) survivors.push(word);
    }

    step = "gemini_enrich";
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    const enriched: EnrichedBrand[] = [];
    for (const word of survivors) {
      try {
        const e = await enrichWithGemini(ai, word, niceClass);
        if (e) enriched.push(e);
      } catch (err) {
        console.error(`Gemini enrichment failed for ${word}:`, err);
      }
    }

    step = "supabase_insert";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const rows = enriched.map((b) => ({
      word: b.word,
      nice_class: b.niceClass,
      decade,
      lodgement_start: startDate,
      lodgement_end: endDate,
      aesthetic_score: b.aesthetic_score,
      mood_board_prompt: b.mood_board_prompt,
    }));

    let inserted = 0;
    if (rows.length > 0) {
      const { data, error } = await supabase
        .from("zombie_brands_au")
        .insert(rows)
        .select();
      if (error) {
        throw new StepError(
          "supabase_insert",
          `Supabase insert failed: ${error.message}`,
          error,
        );
      }
      inserted = data?.length ?? 0;
    }

    return NextResponse.json({
      success: true,
      candidates: candidates.length,
      survivors: survivors.length,
      inserted,
      brands: enriched,
    });
  } catch (err) {
    const stepErr = err instanceof StepError ? err : null;
    const payload = {
      success: false,
      step: stepErr?.step ?? step,
      error: (err as Error).message ?? String(err),
      detail: stepErr?.detail,
    };
    console.error("Scout error:", payload);
    return NextResponse.json(payload, { status: 500 });
  }
}
