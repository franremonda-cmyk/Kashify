# Kashify

**A personal finance ledger you talk to.** Send a WhatsApp message — *"lunch 850"* —
and an AI agent ("Neo") parses it, categorizes it, and your web dashboard updates
seconds later. No forms, no app to open. Built for people who juggle two currencies
(ARS + USD) and think in Rioplatense Spanish.

> Private beta · multi-user with per-user data isolation

🔗 **[Live demo](https://kashify.vercel.app)** · 🎬 **[2-min walkthrough](https://TODO)**

---

## Why

Expense tracking dies on friction. Kashify removes it: the capture surface is the chat
app you already have open. Neo turns natural-language messages into structured
transactions — the web app is for *seeing your numbers*, not data entry.

## What it does

- **WhatsApp capture** — natural language → transactions via Neo (Claude). Handles
  `"café 1200"`, `"cobré 50 lucas"`, ARS/USD, income vs. expense.
- **Neo learns** — when it doesn't recognize a keyword it *asks* and remembers the
  keyword→category mapping (fuzzy-matched with Fuse.js) instead of guessing or burning
  tokens. A `NEO_LLM_FALLBACK=false` switch lets Neo run at zero LLM cost.
- **Multi-currency ledger** — ARS + USD side by side (the Argentine "dollar cushion"
  is a first-class concept, not an afterthought).
- **Web dashboard** — balances, charts (Recharts), category breakdowns. PWA-installable.
- **Installments (cuotas)** — splits a purchase into scheduled monthly entries.
- **Budgets & savings goals** — period budgets and goal tracking.
- **Bulk import** — ingests monthly spreadsheets (xlsx/csv), including a
  category × month matrix that it unfolds into individual movements.
- **Persistent appearance** — per-user theme + icon prefs stored in the DB.

## Architecture

```
WhatsApp (Meta Cloud API)
        │  webhook
        ▼
Cloudflare Worker ──fast ACK──►  Vercel Cron (signed: CRON_SECRET)
                                        │
                                        ▼
                         Next.js API (App Router)
                          ├─ Neo: parse / learn (Anthropic Claude)
                          └─ Ledger logic (installments, budgets, import)
                                        │
                                        ▼
                         Supabase (Postgres + Row-Level Security)
                          every query scoped to the user
```

A Cloudflare Worker absorbs the WhatsApp webhook and the heavy work runs off a Vercel
Cron, so Meta always gets a fast `200` while parsing happens out of band.

## Stack

Next.js 16 · React 19 · TypeScript · Tailwind v4 · Supabase (Postgres/RLS) ·
Anthropic Claude · Cloudflare Workers · WhatsApp Cloud API · Recharts · Fuse.js · Vercel

## Run locally

```bash
npm install
cp .env.local.example .env.local    # fill Supabase, Anthropic, WhatsApp keys
# apply supabase/migrations/* to your Supabase project
npm run dev                         # → http://localhost:3000
```

WhatsApp is optional for local dev — the web app and Neo's parsing work without it.
See [`.env.local.example`](.env.local.example) for the full variable list.

## Status

Private beta (allowlisted users). Single-developer project — product, design, stack and
infra by [Francisco Remonda](https://www.linkedin.com/in/franciscoremonda).

Repo: [github.com/franremonda-cmyk/Kashify](https://github.com/franremonda-cmyk/Kashify)
