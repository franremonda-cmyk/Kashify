# Kashify

**A personal finance ledger you talk to.** Dictate *"lunch 850"* to an iPhone
Shortcut and an AI agent ("Neo") parses it, categorizes it, and your web dashboard
updates seconds later. No forms, no app to open. Built for people who juggle two currencies
(ARS + USD) and think in Rioplatense Spanish.

> Private beta · multi-user with per-user data isolation

🔗 **[Live demo](https://kashify.vercel.app)** · 🎬 **[2-min walkthrough](https://TODO)**

---

## Why

Expense tracking dies on friction. Kashify removes it: the capture surface is the chat
app you already have open. Neo turns natural-language messages into structured
transactions — the web app is for *seeing your numbers*, not data entry.

## What it does

- **Dictated capture** — natural language → transactions via Neo (Claude), through an
  iPhone Shortcut hitting `/api/neo/atajo`. Handles `"café 1200"`, `"cobré 50 lucas"`,
  ARS/USD, income vs. expense. (A WhatsApp channel ran until 2026-10-31; Meta kept
  pulling the test number, so it was dropped and its worker deleted on 2026-11-05.)
- **Neo learns** — when it doesn't recognize a keyword it *asks* and remembers the
  keyword→category mapping (fuzzy-matched with Fuse.js) instead of guessing or burning
  tokens. A `NEO_LLM_FALLBACK=false` switch lets Neo run at zero LLM cost.
- **Multi-currency ledger** — ARS + USD side by side (the Argentine "dollar cushion"
  is a first-class concept, not an afterthought). The balance is *cash in hand*: money
  you lent out is tracked as debt, never subtracted from it (see
  `src/lib/ledger/balances.ts`).
- **Web dashboard** — balances, charts (Recharts), category breakdowns. PWA-installable.
- **Installments (cuotas)** — splits a purchase into scheduled monthly entries.
- **Budgets & savings goals** — period budgets and goal tracking.
- **Bulk import** — ingests monthly spreadsheets (xlsx/csv), including a
  category × month matrix that it unfolds into individual movements.
- **Persistent appearance** — per-user theme + icon prefs stored in the DB.

## Architecture

```
iPhone Shortcut (dictation)
        │  POST /api/neo/atajo (shared key)
        ▼
                         Next.js API (App Router)
                          ├─ Neo: parse / learn (Anthropic Claude)
                          ├─ Ledger logic (installments, budgets, import)
                          └─ Vercel Crons (signed: CRON_SECRET) for digests & reminders
                                        │
                                        ▼
                         Supabase (Postgres + Row-Level Security)
                          every query scoped to the user
```

One engine serves every channel (`src/lib/neo/engine`): the web chat and the Shortcut
are thin adapters over it.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres/RLS) ·
Anthropic Claude · Recharts · Fuse.js · Vercel

## Run locally

```bash
npm install
cp .env.local.example .env.local    # fill Supabase + Anthropic keys
# apply supabase/migrations/* to your Supabase project
npm run dev                         # → http://localhost:3000
```

The Shortcut is optional for local dev — the web app and Neo's parsing work without it.
See [`.env.local.example`](.env.local.example) for the full variable list.

## Status

Private beta (allowlisted users). Single-developer project — product, design, stack and
infra by [Francisco Remonda](https://www.linkedin.com/in/franciscoremonda).

Repo: [github.com/franremonda-cmyk/Kashify](https://github.com/franremonda-cmyk/Kashify)
