# Bloeiwijzer

Tuinonderhoud-app: leg je tuin vast, laat elke plant zijn eigen onderhoudstaken
opleveren, en zie per maand in één lijst wat er te doen is.

> In maart de app openen en binnen 5 seconden zien welke planten deze maand
> gesnoeid moeten worden, ze afvinken, en ze zijn weg uit de agenda.

Volledige specificatie: `docs/OVERDRACHT.md`.

## Aan de praat krijgen

```bash
npm install
cp .env.example .env.local   # mag leeg blijven voor een eerste rondje
npm run dev
```

Zonder `UPSTASH_REDIS_REST_*` schrijft de app naar `.dev-data/redis.json` en is
er een ontwikkelaarslogin: vul een e-mailadres in en je bent binnen. Zodra de
Upstash-variabelen er zijn schakelt de app vanzelf om.

Ontbrekende sleutels zetten alleen het bijbehorende onderdeel uit — de app
blijft werken:

| Ontbreekt | Gevolg |
|---|---|
| `UPSTASH_REDIS_REST_*` (of `KV_REST_API_*`) | Lokale store in `.dev-data/`, niet gedeeld |
| `AUTH_GOOGLE_*` / `AUTH_RESEND_KEY` | Alleen de ontwikkelaarslogin |
| `ANTHROPIC_API_KEY` | Geen zorgprofiel-voorstel; taken zelf invullen |
| `PLANTNET_API_KEY` | Herkenning draait alleen op Claude, met melding |
| `BLOB_READ_WRITE_TOKEN` | Foto's landen in `public/uploads` |
| `RESEND_API_KEY` | Geen maandbericht en geen uitnodigingsmail (link tonen) |
| `VAPID_*` | Geen pushmeldingen |

## Live

De app draait op **https://bloeiwijzer.vercel.app** (Vercel-project
`bloeiwijzer`, gekoppeld aan deze repo). Elke push naar de productiebranch
deployt vanzelf.

### Wat er nog ingesteld moet worden

Zonder omgevingsvariabelen komt de app op `/login` met een lijstje van wat er
ontbreekt. Zet ze in Vercel onder **Settings → Environment Variables**, voor
Production en Preview.

Minimaal nodig om te kunnen inloggen en gegevens te bewaren:

| Variabele | Waar vandaan |
|---|---|
| `AUTH_SECRET` | `openssl rand -base64 32` |
| `UPSTASH_REDIS_REST_URL` en `UPSTASH_REDIS_REST_TOKEN` | Upstash-console, na het aanmaken van een Redis-database. Koppel je Upstash via de marktplaats van Vercel, dan heten ze `KV_REST_API_URL` en `KV_REST_API_TOKEN`; die worden ook herkend, je hoeft dan niets te dupliceren |
| `AUTH_GOOGLE_ID` en `AUTH_GOOGLE_SECRET` | Google Cloud Console → OAuth-client. Redirect-URI: `https://bloeiwijzer.vercel.app/api/auth/callback/google` |
| `NEXT_PUBLIC_APP_URL` | `https://bloeiwijzer.vercel.app` |

Daarna, per onderdeel:

| Variabele | Zet aan |
|---|---|
| `ANTHROPIC_API_KEY` | Het onderhoudsvoorstel en de plantherkenning |
| `PLANTNET_API_KEY` | De tweede bron bij herkenning op foto |
| `BLOB_READ_WRITE_TOKEN` | Foto's naar Vercel Blob (anders naar de schijf, en die is vluchtig) |
| `RESEND_API_KEY`, `AUTH_RESEND_KEY`, `RESEND_FROM` | Maandbericht, uitnodigingsmail, inloglink per e-mail |
| `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Pushmeldingen (`npx web-push generate-vapid-keys`) |
| `CRON_SECRET` | De geplande taken; zonder dit weigeren ze met 503 |

### Geplande taken

`vercel.json` bevat er twee, het maximum op het Hobby-plan:

- `0 5 * * *` → `/api/cron/weer` — weer ophalen, regels toepassen, en zo nodig
  de agenda van het nieuwe jaar klaarzetten
- `0 6 1 * *` → `/api/cron/maandbericht` — het maandbericht

`/api/cron/jaarwissel` bestaat nog wel, maar staat niet meer ingepland.

## Scripts

```bash
npm run dev        # ontwikkelserver
npm run build      # productiebouw
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint

# scenario 16: de hele flow op een telefoon van 375 px
npm run dev -- -p 3111
OUT=./schermschoten node scripts/telefoon-doorloop.mjs
```

## Wat er staat

| Fase | Onderwerp | Stand |
|---|---|---|
| 0 | Fundament, auth, tuin en lidmaatschap | klaar |
| 1 | Locaties, planten, foto's, uitnodigingen | klaar |
| 2 | Zorgprofiel, occurrence-generator, agenda, afvinken | klaar |
| 3 | PlantNet plus Claude op foto, URL-import | klaar |
| 4 | Weer, weerregels, maandbericht, pushmeldingen | klaar |
| 5 | Jaaroverzicht, export, QR-labels, PWA | klaar |
| 6 | Ontwerp uit Claude Design doorvoeren | klaar |

## Opbouw

```
src/lib/       domeinlogica: types, Redis-sleutels, planning, weer, AI
src/app/       routes (App Router); (app)/ is het ingelogde deel
src/components/ herbruikbare interface-onderdelen
```

Twee regels die overal gelden:

1. **Elke serveractie begint met `assertMember(userId, gardenId)`.** Een
   `gardenId` uit een request wordt nooit vertrouwd zonder die controle.
2. **Elke Redis-sleutel komt uit `src/lib/keys.ts`.** Nooit met de hand
   samenstellen.

### Schermen

`/` deze maand · `/agenda` maandkalender · `/planten` en `/planten/[id]` ·
`/planten/nieuw` (foto, link, zelf invullen) · `/locaties` · `/jaar/[jaar]` ·
`/labels` printvel · `/instellingen` · `/uitnodiging/[token]` ·
`/q/[gardenId]/[labelCode]` na het scannen van een label.

### Ontwerp

Kleur, ruimte en vorm staan uitsluitend in `src/app/globals.css`. Componenten
gebruiken variabelen, nooit losse kleurwaarden.

Het ontwerp komt uit Claude Design; de bron staat in
`docs/ontwerp/bloeiwijzer-ontwerp.dc.html`. Typografie is Fraunces (koppen,
met de WONK-as aan) en Karla (de rest), beide via `next/font` meegeleverd.
Waar de bouw van het ontwerp afwijkt — vrijwel altijd om de
toegankelijkheidseisen uit §11 te halen — staat dat in
`docs/ontwerp/AFWIJKINGEN.md`.
