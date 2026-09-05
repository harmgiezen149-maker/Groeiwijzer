# OVERDRACHT — Bloeiwijzer (tuinonderhoud-app) — versie 2

**Opdrachtgever:** Harm
**Uitvoerder:** Claude Code
**Datum:** 5 september 2026
**Status:** compleet. Alle openstaande keuzes zijn beantwoord; bouw kan starten.

> Versie 2 verwerkt het ingevulde keuzeformulier. De belangrijkste wijzigingen ten
> opzichte van versie 1 staan in §1.2 — lees die eerst als je versie 1 al kent.

---

## 1. Doel en uitgangspunten

### 1.1 Probleem

In de tuin staan tientallen planten, bomen en struiken, elk met eigen onderhoud in een
eigen periode van het jaar. Dat is niet te onthouden en ligt nergens vast. De app legt de
tuin vast, vertaalt elke plant naar concrete onderhoudstaken met periode en frequentie, en
zet die in één agenda die je afvinkt.

**Succescriterium:** in maart open ik de app en zie ik binnen 5 seconden welke planten deze
maand gesnoeid moeten worden, kan ik ze afvinken, en zijn ze dan weg uit de agenda.

**Naam:** Bloeiwijzer (definitief).

### 1.2 Wat er is gewijzigd ten opzichte van versie 1

| Onderwerp | Versie 1 | Versie 2 |
|---|---|---|
| Toegang | Eén tuin per account | **Tuin als eigen entiteit met leden en uitnodigingen**; Harm en partner hebben ieder een eigen account op dezelfde tuin |
| Notificaties | Alleen in-app | **Maandelijkse e-mail plus pushmeldingen bij vorst en urgent werk**, via geplande taken |
| Plantherkenning | Claude, PlantNet optioneel | **PlantNet verplicht als tweede bron**, Claude voor het zorgprofiel |
| Soorten | Bomen, struiken, vaste planten | **Alles**, inclusief moestuin, kruiden en kamerplanten → nieuw kenmerk `binnen/buiten` per locatie |
| Startlocaties | Leeg beginnen | **Vier standaardlocaties** bij een nieuwe tuin |
| Taakstatus | Open / gedaan / overgeslagen (aanname) | Bevestigd, inclusief **verplichte reden bij overslaan** |
| Foto's | Hoofdfoto plus extra (aanname) | Bevestigd, plus **foto bij het afvinken** |
| Weerregels | Voorstel van vijf | **Alle vijf aan** |
| QR-labels | Buiten scope | **In scope**, inclusief printvel |
| Jaaroverzicht en export | Later | **In scope** |
| Prijs- en kostenadministratie | Buiten scope | Blijft buiten scope |
| Aankoopdatum, boodschappenlijst tuinspullen | — | Later, niet in de eerste versies |
| Ontwerp | Palet in dit document | **Ontwerp volgt apart via Claude Design**; zie §11 |

### 1.3 Vastgestelde keuzes

| Onderwerp | Keuze |
|---|---|
| Datalaag | Upstash Redis (REST) |
| Hosting | Vercel, nieuwe Git-repo |
| Toegang | Publiek, eigen account per gebruiker, gedeelde tuin via uitnodiging |
| Omvang | 75 tot 150 planten per tuin |
| Weerlocatie | Vast: postcode 6866 EH, Heelsum (eenmalig omgezet naar coördinaten, ca. 51,977 N / 5,755 O) |
| Herinneringen | Maandelijkse e-mail plus push bij vorst en urgent werk |
| E-mailontvanger | Alle leden van de tuin; in elk geval jilldebeijer@kpnmail.nl |
| Startscherm | Lijst "deze maand" bovenaan, maandkalender eronder |

---

## 2. Techniek

| Laag | Keuze | Waarom |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript, React Server Components | Bekend uit Weekmenuplanner |
| Styling | Tailwind CSS v4 met tokens in `globals.css` | Ontwerp komt later, tokens moeten vervangbaar zijn |
| Data | Upstash Redis via `@upstash/redis` | Vastgesteld |
| Auth | Auth.js (NextAuth v5): Google plus magic link | Twee gebruikers, eigen accounts |
| Bestanden | Vercel Blob | Plantfoto's en afvinkfoto's |
| AI | Anthropic API, `claude-sonnet-4-6` | Zorgprofiel en URL-import |
| Herkenning | PlantNet API | Tweede bron voor de soortbepaling |
| Weer | Open-Meteo, model `knmi_seamless` | Gratis, geen sleutel, 2 km resolutie |
| E-mail | Resend | Maandbericht en uitnodigingen |
| Push | Web Push met VAPID (`web-push`) | Vorst- en urgentiemeldingen |
| Planning | Vercel Cron | Dagelijkse weercheck, maandbericht, jaarwissel |
| QR | `qrcode` (server-side SVG) | Printvel met labels |
| Beperking | `@upstash/ratelimit` | Kostenbeheersing op AI-endpoints |

**Niet gebruiken:** Trefle (gearchiveerd). Perenual is niet nodig: PlantNet levert de naam,
Claude het profiel.

---

## 3. Toegangsmodel: gebruiker, tuin, lidmaatschap

Dit is de grootste wijziging ten opzichte van versie 1 en raakt elke route en elke sleutel.
**Alle tuindata hangt aan een `gardenId`, niet aan een `userId`.**

```ts
export interface Garden {
  id: string;
  name: string;               // "Tuin Heelsum"
  ownerId: string;
  lat: number; lon: number;   // voor het weer
  postcode?: string;
  createdAt: string;
}

export interface Membership {
  gardenId: string;
  userId: string;
  role: 'eigenaar' | 'lid';
  joinedAt: string;
  notify: { email: boolean; push: boolean };   // per lid instelbaar
}

export interface Invite {
  token: string;              // willekeurig, 32 tekens
  gardenId: string;
  email: string;
  invitedBy: string;
  expiresAt: string;          // 14 dagen
  acceptedAt?: string;
}
```

**Regels:**

- Bij registratie krijgt een gebruiker automatisch een eigen tuin met de vier
  standaardlocaties (§4.1).
- Een uitnodiging is een e-mail met een link `/uitnodiging/{token}`. Accepteren voegt een
  `Membership` toe. Bestaat er nog geen account, dan eerst inloggen, daarna accepteren.
- Alle leden hebben dezelfde rechten op de tuindata. Alleen de eigenaar kan leden
  verwijderen en de tuin verwijderen.
- Een gebruiker kan lid zijn van meerdere tuinen. In de interface staat een tuinkiezer
  in de kop; de actieve tuin staat in een cookie, maar wordt **altijd** server-side
  getoetst aan het lidmaatschap.
- Afvinken registreert **wie** het deed (`doneBy`), zodat je in het logboek ziet wie wat
  gedaan heeft.

**Beveiligingsregel:** elke serveractie begint met `assertMember(session.userId, gardenId)`.
Een `gardenId` uit de request wordt nooit vertrouwd zonder die controle.

---

## 4. Domeinmodel

```
User ──< Membership >── Garden ──< Location ──< Plant ──< CareTask
                                                   │          └──< TaskOccurrence
                                                   ├──< PlantPhoto
                                                   └──< LogEntry
```

Het onderscheid tussen **CareTask** (sjabloon: "snoeien, februari–maart, 1× per jaar") en
**TaskOccurrence** (instantie: "snoeien 2027, venster 1 feb t/m 31 mrt, status open") is de
kern van de app. Afvinken raakt alleen de occurrence; het sjabloon genereert volgend jaar
een nieuwe.

### 4.1 Locatie

```ts
export interface Location {
  id: string;
  name: string;
  outdoor: boolean;                // NIEUW: bepaalt of weerregels gelden
  sun: 'zon' | 'halfschaduw' | 'schaduw';
  soil?: 'zand' | 'klei' | 'veen' | 'leem' | 'potgrond' | 'onbekend';
  notes?: string;
  sortOrder: number;
}
```

Standaardlocaties bij een nieuwe tuin: **Voortuin** (buiten, zon), **Achtertuin** (buiten,
halfschaduw), **Terras** (buiten, zon), **Binnen** (binnen, halfschaduw). Alles is te
hernoemen en te verwijderen; de opdrachtgever vult de definitieve indeling in de app zelf in.

`outdoor: false` betekent: **geen enkele weerregel geldt**. Een kamerplant krijgt nooit een
vorstwaarschuwing. Dit expliciet testen.

### 4.2 Plant

```ts
export interface Plant {
  id: string;
  locationId: string;
  commonName: string;
  scientificName?: string;
  cultivar?: string;
  category: 'boom' | 'struik' | 'haag' | 'vaste plant' | 'eenjarige' | 'bolgewas'
          | 'klimplant' | 'gras' | 'kruid' | 'groente' | 'fruit' | 'kamerplant' | 'overig';
  photoUrl?: string;
  quantity: number;
  plantedAt?: string;
  purchasedAt?: string;            // fase 6, veld nu al reserveren
  status: 'levend' | 'dood' | 'verwijderd';
  statusChangedAt?: string;
  statusReason?: string;
  hardiness?: string;
  frostSensitive: boolean;
  droughtSensitive: boolean;
  notes?: string;
  labelCode?: string;              // korte code voor het QR-label, bv. "K7F2"
  source: 'foto' | 'url' | 'handmatig';
  sourceUrl?: string;
  identification?: {               // NIEUW: uitkomst van beide bronnen
    plantnet?: { name: string; score: number }[];
    ai?: { name: string; confidence: number };
    confirmedBy: string;           // userId
  };
  createdAt: string;
  updatedAt: string;
}
```

Een plant met status `dood` of `verwijderd` verdwijnt uit de agenda en uit de standaardlijst,
maar blijft vindbaar via het filter "archief" en behoudt zijn logboek. Openstaande
occurrences worden bij statuswijziging verwijderd; afgevinkte blijven staan.

### 4.3 Zorgtaak en occurrence

```ts
export type TaskType =
  | 'snoeien' | 'bemesten' | 'verpotten' | 'water' | 'winterbescherming'
  | 'ziektecontrole' | 'delen' | 'oogsten' | 'planten' | 'overig';

export interface CareTask {
  id: string;
  plantId: string;
  type: TaskType;
  title: string;
  instructions: string;            // 2–5 zinnen, Nederlands, praktisch
  schedule: Schedule;
  weatherRules: WeatherRuleId[];
  importance: 'noodzakelijk' | 'aanbevolen' | 'optioneel';
  source: 'ai' | 'handmatig';
  enabled: boolean;
}

export type Schedule =
  | { kind: 'jaarvenster'; startMonth: Month; endMonth: Month; timesPerWindow: number }
  | { kind: 'interval'; startMonth: Month; endMonth: Month; intervalDays: number }
  | { kind: 'meerjaarlijks'; startMonth: Month; endMonth: Month; everyYears: number;
      anchorYear: number }
  | { kind: 'weer-gestuurd'; startMonth: Month; endMonth: Month };

export interface TaskOccurrence {
  id: string;                      // `${plantId}:${taskId}:${year}:${seq}` — deterministisch
  plantId: string;
  taskId: string;
  year: number;
  seq: number;
  windowStart: string;
  windowEnd: string;
  status: 'open' | 'gedaan' | 'overgeslagen';
  doneAt?: string;
  doneBy?: string;                 // userId — meerdere leden
  skipReason?: string;             // VERPLICHT bij overgeslagen
  note?: string;
  photoUrl?: string;               // foto bij het afvinken
  weatherFlag?: 'gunstig' | 'ongunstig' | 'urgent';
  generatedAt: string;
}
```

**Vensters over de jaargrens** (`startMonth 11`, `endMonth 2`) lopen door in het volgende
kalenderjaar. Expliciet testen.

---

## 5. Redis-sleutelschema

Alles per **tuin** geprefixt. Nooit een sleutel opbouwen zonder de helper
`keyFor(gardenId, ...)`.

```
user:{userId}                        HASH   profiel
user:byEmail:{email}                 STRING userId
user:{userId}:gardens                SET    gardenIds
garden:{gardenId}                    HASH   JSON(Garden)
garden:{gardenId}:members            HASH   userId → JSON(Membership)
invite:{token}                       STRING JSON(Invite), TTL 14 dagen

g:{gardenId}:locations               HASH   locationId → JSON(Location)
g:{gardenId}:plants                  HASH   plantId → JSON(Plant)
g:{gardenId}:loc:{locationId}:plants SET    plantIds
g:{gardenId}:label:{labelCode}       STRING plantId (voor QR-scan)
g:{gardenId}:plant:{plantId}:tasks   HASH   taskId → JSON(CareTask)
g:{gardenId}:occ:{year}              HASH   occurrenceId → JSON(TaskOccurrence)
g:{gardenId}:occ:{year}:open         SET    occurrenceIds met status open
g:{gardenId}:plant:{plantId}:log     LIST   JSON(LogEntry), nieuwste vooraan
g:{gardenId}:plant:{plantId}:photos  LIST   JSON({url, takenAt, caption})
g:{gardenId}:meta                    HASH   { lastGeneratedYear, lastWeatherSync, lastMonthlyMail }

push:{userId}                        SET    JSON(PushSubscription) per apparaat
weather:{lat}:{lon}                  STRING JSON forecast, TTL 6 uur
ratelimit:{userId}:{endpoint}        —      via @upstash/ratelimit
```

**Omvang:** bij 150 planten en gemiddeld 5 taken zijn er ruwweg 700 tot 1000 occurrences per
jaar. Eén `HGETALL` op `occ:{year}` blijft ruim onder de grens en is snel genoeg; geen
paginering nodig. Eén `HGETALL` per entiteitstype per pagina, geen losse calls per plant.

---

## 6. Plant toevoegen

### 6.1 Twee bronnen, één bevestiging

De opdrachtgever kiest voor maximale nauwkeurigheid. Daarom:

1. **PlantNet** bepaalt de soort uit de foto (gratis, sterk in determinatie). Levert een
   lijst kandidaten met een score.
2. **Claude** krijgt de foto *plus* de PlantNet-kandidaten en bepaalt de definitieve
   suggestie en het volledige onderhoudsprofiel in het Nederlands.
3. De gebruiker bevestigt of corrigeert.

Bouw dit achter één interface, zodat een bron kan uitvallen zonder de flow te breken:

```ts
interface PlantIdentifier {
  identify(input: { imageBase64?: string; url?: string; text?: string }):
    Promise<{ candidates: PlantCandidate[]; provider: string }>;
}
```

Valt PlantNet uit of is er geen sleutel, dan draait alleen Claude en toont de app een
subtiele melding dat de tweede controle niet beschikbaar was.

### 6.2 Flow: via foto

1. Foto maken of kiezen → client-side verkleinen naar maximaal 1600 px, JPEG 0,8.
2. `POST /api/plants/identify` → PlantNet en Claude parallel.
3. Bevestigingsscherm met de beste suggestie, de alternatieven van beide bronnen, en het
   voorgestelde zorgprofiel dat per taak aan- of uitgevinkt kan worden.
4. Opslaan: foto naar Blob, plant en taken naar Redis, occurrences genereren, labelcode
   toekennen.

**Stap 3 is verplicht.** Nooit automatisch opslaan: een verkeerde determinatie levert een
jaar lang verkeerde taken op.

### 6.3 Flow: via URL

`POST /api/plants/from-url` → pagina ophalen (timeout 8 s, alleen `text/html`, maximaal
2 MB), tekst strippen, naar Claude met hetzelfde uitvoerschema. Er zijn geen vaste
leveranciers opgegeven, dus de aanpak is generiek. Mislukt het ophalen, dan een nette
melding met een knop naar het handmatige formulier — geen doodlopende weg.

### 6.4 Flow: handmatig

Formulier met naam, categorie, locatie, aantal en optionele foto, plus de knop
**"Onderhoud voorstellen"** die hetzelfde profiel-endpoint aanroept op basis van alleen de
naam.

### 6.5 Prompt-contract voor het zorgprofiel

Vast in de systeeminstructie:

- Locatie Nederland, klimaatzone 8a/8b, gematigd maritiem.
- Uitsluitend JSON, geen inleiding, geen markdown-fences.
- Maanden als getal 1 tot en met 12, maximaal 8 taken per plant.
- `instructions` van 2 tot 5 zinnen in het Nederlands.
- Onbekend is `null`; niet gokken.
- **Bij een kamerplant of een locatie met `outdoor: false`: geen taken die op buitenweer
  slaan** (winterbescherming, vorst).

Valideren met Zod. Bij een schemafout één keer opnieuw proberen, daarna een leeg profiel dat
de gebruiker zelf invult, met melding. Nooit crashen.

```json
{
  "commonName": "Hortensia",
  "scientificName": "Hydrangea macrophylla",
  "category": "struik",
  "confidence": 0.86,
  "frostSensitive": true,
  "droughtSensitive": true,
  "hardiness": "winterhard tot ongeveer -15 °C",
  "tasks": [
    {
      "type": "snoeien",
      "title": "Uitgebloeide bloemen wegknippen",
      "instructions": "Knip in het voorjaar de oude bloemhoofden weg tot net boven het eerste gezonde knoppenpaar. Laat de bloemen in de winter staan als vorstbescherming.",
      "schedule": { "kind": "jaarvenster", "startMonth": 3, "endMonth": 4, "timesPerWindow": 1 },
      "weatherRules": ["geen-vorst"],
      "importance": "aanbevolen"
    }
  ]
}
```

---

## 7. Agenda, weer en afvinken

### 7.1 Occurrences genereren

`generateOccurrences(gardenId, year)`:

- Draait bij het eerste bezoek in een nieuw jaar (`meta.lastGeneratedYear`), na het
  toevoegen of wijzigen van een plant of taak, via een geplande taak op 1 januari, en via
  een knop in instellingen.
- Per actieve `CareTask` van elke **levende** plant:
  - `jaarvenster`: `timesPerWindow` occurrences, gelijk verdeeld over het venster.
  - `interval`: elke `intervalDays` binnen het venster.
  - `meerjaarlijks`: alleen als `(year - anchorYear) % everyYears === 0`.
  - `weer-gestuurd`: geen vooraf gegenereerde occurrences; die ontstaan uit §7.2.
- **Idempotent:** bestaande id overslaan, een `gedaan` of `overgeslagen` nooit overschrijven.

### 7.2 Weerregels — alle vijf actief

Eén call per tuin, zes uur gecached:

```
https://api.open-meteo.com/v1/forecast
  ?latitude=51.977&longitude=5.755
  &daily=temperature_2m_min,temperature_2m_max,precipitation_sum
  &past_days=7&forecast_days=14
  &models=knmi_seamless&timezone=Europe/Amsterdam
```

| Id | Regel | Effect |
|---|---|---|
| `geen-vorst` | minimum < 0 °C binnen 3 dagen | Snoeitaken krijgen vlag `ongunstig` met tekst "wacht tot de vorst voorbij is" |
| `nachtvorst-alarm` | minimum < 2 °C binnen 48 uur | Urgente taak "afdekken of binnenhalen" voor vorstgevoelige planten buiten, plus **pushmelding** |
| `droogte` | neerslag < 5 mm over 7 dagen en Tmax > 22 °C | Genereert watertaak voor droogtegevoelige planten buiten |
| `geen-hitte` | Tmax > 28 °C | Bemesten en verpotten krijgen vlag `ongunstig` |
| `groeiseizoen` | 5 dagen op rij Tmin > 5 °C in februari of maart | Informatieve banner op het startscherm |

Weerregels **blokkeren nooit**; ze markeren, sorteren en melden. Regels gelden uitsluitend
voor planten op een locatie met `outdoor: true`.

### 7.3 Afvinken

`POST /api/occurrences/{id}/complete` met optionele notitie en foto:

1. Status → `gedaan`, `doneAt` = nu, `doneBy` = de ingelogde gebruiker.
2. Verwijderen uit `occ:{year}:open`.
3. Foto naar Blob, verwijzing in de occurrence en in het logboek.
4. `LogEntry` toevoegen.
5. Optimistische UI met rollback bij fout.

`POST /api/occurrences/{id}/skip` vereist een `skipReason` van minimaal 3 tekens; de
interface biedt snelkeuzes ("geen tijd", "weer te slecht", "niet nodig") plus een vrij veld.
Ongedaan maken kan zolang de taak in beeld is.

---

## 8. Herinneringen

Twee kanalen, per lid aan en uit te zetten in `Membership.notify`.

### 8.1 Maandbericht per e-mail

- Geplande taak: de 1e van de maand, 08:00 Europe/Amsterdam.
- Per tuin één mail naar alle leden met `notify.email` (in elk geval het opgegeven adres).
- Inhoud: aantal open taken deze maand, gegroepeerd per locatie, maximaal 15 regels, plus
  een knop naar de app. Geen bijlagen.

### 8.2 Pushmeldingen

- Geplande taak: dagelijks 07:00. Weer ophalen, regels toepassen.
- Alleen versturen bij `nachtvorst-alarm` of bij een urgente taak; maximaal één melding per
  dag per gebruiker, en niet twee dagen achter elkaar dezelfde melding.
- Web Push met VAPID; abonnementen per apparaat in `push:{userId}`.
- Verlopen abonnementen (410 of 404 van de pushdienst) direct opruimen.

**Technische beperking:** op een iPhone werken pushmeldingen alleen als de app via
"Zet op beginscherm" is geïnstalleerd. Zet daarom bij het aanzetten van meldingen een
instructie in beeld en detecteer of de app in standalone-modus draait.

### 8.3 Geplande taken

```
vercel.json → crons:
  0 6 1 * *   /api/cron/maandbericht      (08:00 NL in de zomer, 07:00 in de winter)
  0 5 * * *   /api/cron/weer              (07:00 NL zomer)
  0 3 1 1 *   /api/cron/jaarwissel        (occurrences voor het nieuwe jaar)
```

Elke cron-route controleert de header `Authorization: Bearer ${CRON_SECRET}` en weigert
zonder. Tijdzone: Vercel draait cron in UTC — reken dat expliciet om en documenteer het in
de code.

---

## 9. QR-labels

Doel: bij een plant in de tuin je telefoon voor het label houden en meteen de juiste
plantpagina openen.

- Elke plant krijgt een korte `labelCode` van 4 tekens (hoofdletters en cijfers, zonder
  0/O en 1/I) die verwijst naar de plant binnen de tuin.
- QR-code bevat `https://{app}/q/{gardenId}/{labelCode}`. Die route zoekt de plant op en
  stuurt door naar de plantpagina. Zonder geldige sessie eerst inloggen, daarna doorsturen.
- Printvel: `/labels` toont een A4-raster met per plant een QR-code, de naam en de locatie.
  Selecteerbaar per locatie of per plant, met printstijlblad (`@page { size: A4 }`), zodat
  het op etiketvellen of stevig papier gedrukt kan worden.
- Advies in de app: gelamineerd printen of in een plantensteker; dit is geen weerbestendig
  product op zichzelf.

---

## 10. Schermen

| Route | Inhoud |
|---|---|
| `/login` | Google-knop en e-mailveld voor magic link |
| `/uitnodiging/[token]` | Uitnodiging accepteren, daarna naar de tuin |
| `/` | Weerbanner indien urgent; lijst "deze maand" gegroepeerd per locatie met afvinkknop; daaronder de maandkalender; daaronder "later dit jaar" |
| `/planten` | Raster met foto's. Filters: locatie, categorie, "heeft open taken", archief. Zoekveld |
| `/planten/[id]` | Foto's, kenmerken, zorgprofiel (bewerkbaar), taken van dit jaar, logboek, statusknop "dood of verwijderd", QR-label |
| `/planten/nieuw` | Drie ingangen: foto, link, zelf invullen |
| `/agenda` | Maandkalender met bolletjes per taaktype plus lijst; filters op taaktype en locatie; meerdere tegelijk afvinken |
| `/locaties` | Locaties beheren, inclusief binnen/buiten, met aantallen |
| `/jaar/[jaar]` | Jaaroverzicht: wat is er gedaan, per maand en per locatie, met de afvinkfoto's |
| `/labels` | Printvel met QR-codes |
| `/instellingen` | Tuinnaam en locatie, leden en uitnodigingen, meldingsvoorkeuren per lid, weerregels aan of uit, occurrences opnieuw genereren, export |

**Lege staten zijn instapmomenten:** een lege plantenlijst toont "Voeg je eerste plant toe"
met de drie ingangen eronder, niet alleen een mededeling.

---

## 11. Ontwerp

**Het definitieve ontwerp levert de opdrachtgever aan via Claude Design.** Bouw daarom in
twee stappen:

1. **Nu:** implementeer met voorlopige tokens in `globals.css`, zodat het ontwerp later in
   één bestand vervangen kan worden. Gebruik uitsluitend variabelen, nooit losse
   kleurwaarden in componenten.
2. **Zodra het ontwerp er is:** vervang de tokens en de componentstijlen; de structuur en de
   routes blijven staan.

Voorlopige tokens (vrolijk en bloemig, mag straks helemaal anders):

```css
--paper:      #FFFBF2;   /* achtergrond */
--ink:        #23372B;   /* tekst */
--dahlia:     #D6246E;   /* primaire actie */
--zinnia:     #FF8A3D;   /* urgentie */
--leaf:       #2F8F5B;   /* afgerond */
--cornflower: #4E7FD4;   /* water en weer */
```

**Eisen waaraan het ontwerp hoe dan ook moet voldoen:**

- Mobiel eerst. De app wordt staand in de tuin gebruikt, met natte handen: knoppen minimaal
  44 px hoog, met één hand bedienbaar, afvinken zonder in te zoomen.
- Elk taaktype heeft één vaste kleur, consequent in agenda, kalenderbolletjes en plantpagina.
  Kleur is informatie, geen decoratie.
- Contrast minimaal AA, zichtbare toetsenbordfocus, `prefers-reduced-motion` gerespecteerd.
- Eén opvallend moment: de afvinkanimatie. Verder rustig, geen scroll- of hover-effecten
  overal.
- Toon van de teksten: kort, actief, zonder uitroeptekens. "Gesnoeid", niet "Gelukt!".

---

## 12. API-routes

```
POST   /api/plants/identify           foto → PlantNet + Claude → kandidaten en profiel
POST   /api/plants/from-url           url  → kandidaten en profiel
POST   /api/plants/suggest-care       naam → profiel
GET    /api/plants                    lijst met filters
POST   /api/plants                    aanmaken (plant, taken, occurrences, labelcode)
GET    /api/plants/{id}
PATCH  /api/plants/{id}               inclusief status dood of verwijderd
DELETE /api/plants/{id}
POST   /api/plants/{id}/photos
GET    /api/tasks?plantId=   POST  PATCH  DELETE
GET    /api/agenda?year=&month=       occurrences met plant en weervlag
POST   /api/occurrences/{id}/complete
POST   /api/occurrences/{id}/skip     vereist reden
POST   /api/occurrences/{id}/reopen
POST   /api/occurrences/generate
GET    /api/locations  POST  PATCH  DELETE
GET    /api/weather                   gecachete verwachting plus actieve regels
GET    /api/year/{jaar}               jaaroverzicht
GET    /api/export                    volledige tuin als JSON, en CSV per onderdeel
GET    /api/labels                    QR-gegevens voor het printvel
GET    /q/{gardenId}/{labelCode}      doorverwijzing na scannen
POST   /api/garden/invite             uitnodiging versturen
POST   /api/garden/invite/accept
DELETE /api/garden/members/{userId}   alleen eigenaar
PATCH  /api/garden/notify             meldingsvoorkeuren van het ingelogde lid
POST   /api/push/subscribe   DELETE   pushabonnement
GET    /api/cron/maandbericht  /api/cron/weer  /api/cron/jaarwissel
```

Elke route: sessie via Auth.js, 401 zonder sessie, daarna `assertMember`. `gardenId` en
`userId` komen nooit ongecontroleerd uit de request.

---

## 13. Beveiliging en kosten

- Rate limiting op `identify`, `from-url` en `suggest-care`: 20 per uur, 60 per dag per
  gebruiker.
- Maximaal 300 planten per tuin, 20 foto's per plant, upload maximaal 5 MB, alleen JPEG,
  PNG en WebP, type controleren op magic bytes.
- `from-url`: alleen http en https, private IP-ranges blokkeren (SSRF), geen doorverwijzing
  naar interne adressen, responsgrootte begrenzen.
- Uitnodigingstokens: willekeurig, eenmalig te gebruiken, 14 dagen geldig, gebonden aan het
  e-mailadres.
- Sleutels van Anthropic, PlantNet en Resend uitsluitend server-side.
- Cron-routes achter `CRON_SECRET`.
- Elke Redis-actie via `keyFor(gardenId, ...)`.

---

## 14. Fasering

**Fase 0 — Fundament**
Repo, Next.js 15, TypeScript, Tailwind met voorlopige tokens, Vercel, Upstash, Auth.js met
Google en magic link, Garden- en Membership-model, standaardlocaties bij registratie,
basislayout en navigatie.

**Fase 1 — Tuin en planten**
Locaties met binnen/buiten, planten handmatig toevoegen, foto's naar Blob, plantenlijst met
filters, plantpagina, **uitnodiging versturen en accepteren** zodat er direct met z'n tweeën
gewerkt kan worden.

**Fase 2 — Zorgprofiel en agenda (minimaal bruikbaar product)**
`suggest-care` met Zod-validatie, taken bewerken, occurrence-generator inclusief jaargrens,
agenda met lijst en maandkalender, afvinken met foto en notitie, overslaan met reden,
logboek per plant.

**Fase 3 — Slim toevoegen**
PlantNet plus Claude op foto, URL-import, bevestigingsscherm met beide bronnen.

**Fase 4 — Weer en meldingen**
Open-Meteo met cache, de vijf regels, weerbanner, weer-gestuurde watertaken, cron voor weer
en maandbericht, Resend-mail, Web Push inclusief iOS-instructie.

**Fase 5 — Overzicht en labels**
Jaaroverzicht, export naar JSON en CSV, status dood of verwijderd met archieffilter,
QR-labels en printvel, PWA-installatie.

**Fase 6 — Ontwerp en afronding**
Ontwerp uit Claude Design doorvoeren, lege staten, toegankelijkheidscontrole, aankoopdatum
en boodschappenlijst voor tuinspullen als er ruimte is.

Na elke fase: deployen naar Vercel en op de telefoon testen.

---

## 15. Testscenario's

1. Plant met snoeivenster februari–maart → staat in de agenda van maart, niet in juni.
2. Afvinken in maart → weg uit de agenda, zichtbaar in het logboek met naam van de afvinker,
   komt volgend jaar terug.
3. Taak met venster november–februari → loopt correct door over de jaargrens.
4. Occurrences twee keer genereren → geen dubbelingen, afgevinkte taken blijven afgevinkt.
5. Overslaan zonder reden → wordt geweigerd; met reden → reden zichtbaar in het logboek.
6. Kamerplant op locatie `outdoor: false` → krijgt bij vorst geen enkele waarschuwing of taak.
7. Vorst voorspeld → snoeitaak `ongunstig`, vorstgevoelige buitenplant krijgt urgente taak
   plus één pushmelding, niet twee dagen achter elkaar dezelfde.
8. Zeven droge dagen en 25 °C → watertaak voor droogtegevoelige buitenplanten.
9. Tweede gebruiker accepteert een uitnodiging → ziet dezelfde tuin, kan afvinken, en het
   logboek toont wie wat deed.
10. Gebruiker zonder lidmaatschap vraagt een `gardenId` op → 403 op **elke** route.
11. Verlopen of hergebruikte uitnodigingstoken → nette foutmelding, geen toegang.
12. Maandbericht op 1 maart → één mail per lid met `notify.email`, met de juiste aantallen.
13. QR-label scannen zonder ingelogd te zijn → eerst inloggen, daarna direct de juiste plant.
14. Plant op status `dood` → verdwijnt uit de agenda, blijft in het archief met logboek.
15. Model geeft ongeldige JSON → één nieuwe poging, daarna leeg profiel met melding.
16. Volledige flow op een telefoon van 375 px breed, met één hand.

---

## 16. Omgevingsvariabelen

```
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
ANTHROPIC_API_KEY=
PLANTNET_API_KEY=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
AUTH_RESEND_KEY=
RESEND_API_KEY=
RESEND_FROM=
BLOB_READ_WRITE_TOKEN=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=
CRON_SECRET=
NEXT_PUBLIC_APP_URL=
```

---

## 17. Wat nog niet vastligt

Deze punten blokkeren de bouw niet:

1. **De locatie-indeling van de tuin.** De opdrachtgever vult die in de app zelf in; begin
   met de vier standaardlocaties.
2. **Websites voor URL-import.** Geen leveranciers opgegeven, dus de import blijft generiek.
   Loopt het in de praktijk stuk op een specifieke site, dan pas een uitzondering bouwen.
3. **Het uiteindelijke ontwerp** (zie §11).
4. **Aankoopdatum en boodschappenlijst voor tuinspullen:** gewenst, maar pas in fase 6.
5. **Prijzen en kosten:** expliciet niet gewenst. Niet bouwen, ook niet "vast een veldje".

---

## Bijlage — uitvoering (toegevoegd door Claude Code)

Dit document is de opdracht. Hoe hij is uitgevoerd staat in `README.md`;
hieronder alleen de plekken waar de bouw afwijkt of aanvult.

| Onderwerp | Wat er gebeurd is |
|---|---|
| Redis | Achter een smalle interface. Zonder `UPSTASH_*` schrijft de app naar `.dev-data/`, zodat er zonder sleutels te bouwen en te testen valt. Productie draait op Upstash. |
| Inloggen | Naast Google en magic link is er een ontwikkelaarslogin, alleen buiten productie (of met `ALLOW_DEV_LOGIN=1`). |
| Foto's | Zonder `BLOB_READ_WRITE_TOKEN` landen uploads in `public/uploads`. |
| Tuinregister | Er is een set `gardens:all` bijgekomen; zonder die lijst kunnen de cron-taken niet langs alle tuinen. Hij vult zichzelf aan voor oudere tuinen. |
| Weer-gestuurde taken | Krijgen een vaste taak-id (`weer-vorst`, `weer-droogte`) en een occurrence-id op basis van de dag, zodat één vorstnacht één taak oplevert hoe vaak de cron ook draait. |
| Weerregels uitzetten | `Garden.disabledWeatherRules` is toegevoegd; §10 vraagt om weerregels aan of uit in de instellingen. |
| Model | `ANTHROPIC_MODEL` is instelbaar. De standaard is `claude-sonnet-4-6` uit §2; er zijn inmiddels nieuwere modellen. |

### Testscenario's uit §15

| # | Onderwerp | Hoe gedekt |
|---|---|---|
| 1 | Snoeivenster feb–mrt staat in maart, niet in juni | unittest + live |
| 2 | Afvinken: weg uit agenda, in logboek met naam, volgend jaar terug | live |
| 3 | Venster nov–feb over de jaargrens | unittest + live |
| 4 | Twee keer genereren: geen dubbelingen | unittest + live |
| 5 | Overslaan zonder reden geweigerd | live |
| 6 | Kamerplant krijgt bij vorst niets | integratietest |
| 7 | Vorst: snoeien ongunstig, urgente taak, één melding | integratietest |
| 8 | Zeven droge dagen en 25 °C geeft een watertaak | integratietest |
| 9 | Tweede gebruiker accepteert, vinkt af, logboek toont wie | live, twee sessies |
| 10 | Vreemde `gardenId` geeft 403 op elke route | live |
| 11 | Verlopen of hergebruikt token | live |
| 12 | Maandbericht met de juiste aantallen per lid | live, via de cron-route |
| 13 | Label scannen zonder sessie | live |
| 14 | Plant op dood: weg uit agenda, blijft in archief | live |
| 15 | Ongeldige JSON: één nieuwe poging, dan leeg profiel | unittest met gemockt model |
| 16 | Volledige flow op 375 px met één hand | nog te doen op een echt toestel |

### Nog open

1. Het ontwerp uit Claude Design (§11, fase 6).
2. Scenario 16: zelf uitproberen op de telefoon.
3. `api.open-meteo.com` is in de bouwomgeving geblokkeerd; de live call is
   daar niet te verifiëren. De foutafhandeling wel: valt de dienst weg, dan
   gebruikt de app de laatste verwachting.
4. Aankoopdatum en boodschappenlijst (§17.4) — bewust nog niet gebouwd.
