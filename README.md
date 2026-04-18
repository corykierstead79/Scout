# Zombie Brand Scout

An automated scout that surfaces abandoned Australian trademarks ripe for
revival, validates domain availability, enriches each surviving candidate with
Gemini 3, and persists the results to Supabase.

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase SSR (`@supabase/ssr`)
- IP Australia Trade Mark Search API
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

Create the `zombie_brands_au` table by running `supabase/schema.sql` in the
Supabase SQL editor.

## Run

```bash
npm run dev
```

Visit [http://localhost:3000/scout](http://localhost:3000/scout), pick a decade
and product class, then hit **Run Scout**.

## How it works

1. `app/scout/page.tsx` POSTs `{ decade, niceClass }` to `/api/scout`.
2. `app/api/scout/route.ts` translates the decade to a lodgement date range,
   queries the IP Australia Quick Search API filtering by
   `status in (DEAD, REMOVED, CANCELLED)` and the selected Nice Class.
3. Each surviving trademark word is passed through a domain-availability check
   (currently a placeholder — see `isDomainAvailable`).
4. Survivors are enriched by Gemini 3 with an `aesthetic_score` and a
   `mood_board_prompt` suitable for an image model.
5. The enriched rows are written to `public.zombie_brands_au` via the Supabase
   server client.
