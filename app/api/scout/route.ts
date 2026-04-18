import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/utils/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const IP_AU_SEARCH_URL =
  "https://production.api.ipaustralia.gov.au/public/australian-trade-mark-search-api/v1/search/quick";

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

function decadeToRange(decade: string): { startDate: string; endDate: string } {
  const match = /^(\d{4})s$/.exec(decade);
  if (!match) throw new Error(`Invalid decade: ${decade}`);
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
  const body = {
    quickSearchType: "WORD",
    status: ["DEAD", "REMOVED", "CANCELLED"],
    niceClasses: [niceClass],
    lodgementDateFrom: startDate,
    lodgementDateTo: endDate,
    pageSize: 100,
    pageNumber: 0,
  };

  const res = await fetch(IP_AU_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`IP Australia search failed: ${res.status}`);
  }

  const data = (await res.json()) as { results?: IpAuHit[]; hits?: IpAuHit[] };
  return data.results ?? data.hits ?? [];
}

// Placeholder for a domain availability check.
// TODO: Wire up a real domain availability API (e.g. Domainr, WhoisXML, or
// auDA-accredited registrar API) to confirm .com.au and .com are unregistered.
// For now we optimistically pass every candidate through.
async function isDomainAvailable(_word: string): Promise<boolean> {
  // const r = await fetch(`https://api.domainr.com/v2/status?domain=${encodeURIComponent(_word)}.com.au&client_id=...`);
  // const j = await r.json();
  // return j.status?.[0]?.status?.includes("undelegated");
  return true;
}

async function enrichWithGemini(
  word: string,
  niceClass: number,
): Promise<EnrichedBrand | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `You are a vintage brand appraiser. Analyze this abandoned Australian trademark and its original product class. Output a JSON object with: 1. aesthetic_score (1-10, rating how premium it sounds) and 2. mood_board_prompt (A detailed, atmospheric image generation prompt to visually reboot this brand for high-end e-commerce. Focus on era-appropriate lighting and textures).

Trademark word: "${word}"
Nice Class: ${niceClass}

Respond with ONLY valid JSON in this exact shape:
{"aesthetic_score": <number 1-10>, "mood_board_prompt": "<string>"}`;

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro",
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
  try {
    const { decade, niceClass } = (await request.json()) as {
      decade: string;
      niceClass: number;
    };

    if (!decade || typeof niceClass !== "number") {
      return NextResponse.json(
        { success: false, error: "Missing decade or niceClass" },
        { status: 400 },
      );
    }

    const { startDate, endDate } = decadeToRange(decade);
    const hits = await fetchDeadTrademarks(niceClass, startDate, endDate);

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

    const survivors: string[] = [];
    for (const word of candidates) {
      if (await isDomainAvailable(word)) survivors.push(word);
    }

    const enriched: EnrichedBrand[] = [];
    for (const word of survivors) {
      try {
        const e = await enrichWithGemini(word, niceClass);
        if (e) enriched.push(e);
      } catch (err) {
        console.error(`Gemini enrichment failed for ${word}:`, err);
      }
    }

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
      if (error) throw error;
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
    console.error("Scout error:", err);
    return NextResponse.json(
      { success: false, error: (err as Error).message },
      { status: 500 },
    );
  }
}
