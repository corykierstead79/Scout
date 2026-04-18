# Zombie Brand Scout

An automated scout that surfaces abandoned Australian trademarks ripe for
revival, validates domain availability, enriches each surviving candidate with
Gemini 3, and persists the results to Supabase.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase SSR (`@supabase/ssr`)
- IPGOD (IP Australia open trademark data) staged in Supabase
- Google Gen AI SDK (`@google/genai`, Gemini 3)

## Setup

```bash
npm install
```

Populate `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://mzwzimkunbfblqutaacq.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_IyvjCB3YIvheAwwXiyikWQ_VSMCnv9m
GEMINI_API_KEY=your-google-gen-ai-key
```

In the Supabase SQL editor, run:

1. `supabase/schema.sql` — creates `ipgod_trademarks` and `zombie_brands_au`
   with the RLS policies the scout needs.
2. `supabase/seed.sql` — inserts 25 sample vintage trademarks across all
   decades and Nice classes so the scout returns results immediately.

For production, replace `seed.sql` with a real import of the IPGOD trademark
CSV from
[data.gov.au](https://data.gov.au/dataset/intellectual-property-government-open-data).

## Run

```bash
npm run dev
```

Visit [http://localhost:3000/scout](http://localhost:3000/scout), pick a decade
and product class, then hit **Run Scout**.

## How it works

1. `app/scout/page.tsx` POSTs `{ decade, niceClass }` to `/api/scout`.
2. `app/api/scout/route.ts` translates the decade to a lodgement date range
   and queries `public.ipgod_trademarks` for rows where
   `status in (DEAD, REMOVED, CANCELLED, LAPSED, EXPIRED)` and
   `nice_classes @> [selectedClass]`.
3. Each surviving trademark word is passed through a domain-availability check
   (currently a placeholder — see `isDomainAvailable`).
4. Survivors are enriched by Gemini 3 with an `aesthetic_score` and a
   `mood_board_prompt` suitable for an image model.
5. The enriched rows are upserted into `public.zombie_brands_au` via the
   Supabase server client.

On failure, `/api/scout` returns `{ success: false, step, error, detail }`
where `step` names the failing stage (`env_check`, `supabase_query`,
`gemini_enrich`, `supabase_insert`, …).
