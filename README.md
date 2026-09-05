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
| `UPSTASH_REDIS_REST_*` | Lokale store in `.dev-data/`, niet gedeeld |
| `AUTH_GOOGLE_*` / `AUTH_RESEND_KEY` | Alleen de ontwikkelaarslogin |
| `ANTHROPIC_API_KEY` | Geen zorgprofiel-voorstel; taken zelf invullen |
| `PLANTNET_API_KEY` | Herkenning draait alleen op Claude, met melding |
| `BLOB_READ_WRITE_TOKEN` | Foto's landen in `public/uploads` |
| `RESEND_API_KEY` | Geen maandbericht en geen uitnodigingsmail (link tonen) |
| `VAPID_*` | Geen pushmeldingen |

## Scripts

```bash
npm run dev        # ontwikkelserver
npm run build      # productiebouw
npm test           # vitest
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
```

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

Kleur, ruimte en vorm staan uitsluitend in `src/app/globals.css`. Componenten
gebruiken variabelen, nooit losse kleurwaarden, zodat het definitieve ontwerp
in één bestand vervangen kan worden.
