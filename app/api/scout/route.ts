import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-pro";

// IPGOD uses several status values for "dead" trademarks.
const DEAD_STATUSES = ["DEAD", "REMOVED", "CANCELLED", "LAPSED", "EXPIRED"];

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

// Placeholder for a domain availability check.
// TODO: Wire up a real domain availability API (e.g. Domainr, WhoisXML) to
// confirm .com.au and .com are unregistered.
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

    step = "supabase_query";
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { data: hits, error: queryError } = await supabase
      .from("ipgod_trademarks")
      .select("word, nice_classes, status, lodgement_date")
      .in("status", DEAD_STATUSES)
      .contains("nice_classes", [niceClass])
      .gte("lodgement_date", startDate)
      .lte("lodgement_date", endDate)
      .limit(100);

    if (queryError) {
      throw new StepError(
        step,
        `Supabase query failed: ${queryError.message}`,
        queryError,
      );
    }

    step = "dedupe_candidates";
    const seen = new Set<string>();
    const candidates = (hits ?? [])
      .map((h) => (h.word ?? "").trim())
      .filter((w): w is string => {
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
    const geminiErrors: { word: string; error: string }[] = [];
    for (const word of survivors) {
      try {
        const e = await enrichWithGemini(ai, word, niceClass);
        if (e) enriched.push(e);
        else geminiErrors.push({ word, error: "Gemini returned unparseable JSON" });
      } catch (err) {
        const message = (err as Error).message ?? String(err);
        console.error(`Gemini enrichment failed for ${word}:`, err);
        geminiErrors.push({ word, error: message });
      }
    }

    step = "supabase_insert";
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
        .upsert(rows, { onConflict: "word,nice_class", ignoreDuplicates: true })
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
      geminiErrors: geminiErrors.length > 0 ? geminiErrors : undefined,
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
