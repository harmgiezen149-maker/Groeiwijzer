# Ontwerp doorgevoerd — wat afwijkt en waarom

Bron: `bloeiwijzer-ontwerp.dc.html`, de handoff uit Claude Design
("Bloemenrijke app-ontwerp"). Alle acht mobiele schermen plus de twee
desktopvarianten zijn nagebouwd. Kleur, typografie, vorm en toon komen uit
dat bestand; de tokens staan in `src/app/globals.css`.

Op zeven punten wijkt de bouw bewust af. Zes daarvan komen uit §11 van de
overdracht, die eisen stelt waar een statische mockup niet aan toekomt.

## 1. Contrast van de grijsgroene tinten

Het ontwerp gebruikt `#8a9a8c` voor sectiekopjes en tweede regels, en
`#9aa596` voor de onderbalk. Op `#FFFBF2` halen die 2,9:1 en 2,5:1. §11 eist
minimaal AA, dus 4,5:1 voor tekst van deze grootte.

Vier tinten uit dezelfde familie, alle boven 4,5:1:

| Token | Was | Nu | Contrast |
|---|---|---|---|
| `--ink-soft` | #4f5f52 | #4f5f52 | 6,6:1 |
| `--ink-quiet` | #6b7a6e | #5b6b5d | 5,5:1 |
| `--ink-faint` | #8a9a8c | #657566 | 4,7:1 |
| `--ink-muted` | #9aa596 | #687868 | 4,5:1 |

## 2. Witte tekst op de oranje banner

`#fff` op `#FF8A3D` haalt 2,4:1. De banner houdt zijn volle oranje, maar de
tekst is `--ink`: 5,4:1. Het bolletje is om dezelfde reden donker.

## 3. Witte tekst op de groene knop

`#fff` op `#2F8F5B` haalt 4,0:1. De afvinkknop gebruikt `--leaf-dark`
(#246D45, 6,3:1). Het lichte groen blijft in gebruik als bolletje en vlak.

## 4. Afvinkknop 44 in plaats van 38 pixels

Het ontwerp tekent een cirkel van 38 px (42 op desktop). §11 eist minimaal
44 px: de app wordt staand in de tuin gebruikt, met natte handen. De cirkel
is 44 px; de rand en de kleur zijn ongewijzigd.

## 5. Invoervelden op 16 pixels

Het ontwerp zet 14,5–15 px op invoervelden. Onder 16 px zoomt iOS bij het
aanraken van een veld automatisch in. Alleen de tekstgrootte ín velden is
opgehoogd; labels en knoppen volgen het ontwerp.

## 6. Maandkalender op het startscherm

De mockup van `/` toont geen kalender. §1.3 en §10 van de overdracht vragen
er wel om: "lijst deze maand bovenaan, maandkalender eronder". De kalender
staat er, in de vorm van het agendascherm. Zeg het als je liever de mockup
volgt; het is één sectie weghalen.

## 7. Toevoegen vanuit de plantenlijst

De bottom-navigatie volgt het ontwerp: vandaag, planten, agenda, locaties,
instellingen. Daarmee verdween de plek om een plant toe te voegen, dus
onderaan `/planten` staat de gestippelde knop "+ Nieuwe plant", in dezelfde
vorm als "+ Nieuwe locatie" uit scherm 07.

## Nog te bouwen

Het ontwerp noemt het zelf: **het afvink-moment**. Er staat nu een korte
bloei-animatie op het vinkje plus een kaart die wegschuift
(`.bw-bloei`, `.bw-wegschuiven`). Dat is een eerste invulling, geen
uitgewerkte bloem-animatie. `prefers-reduced-motion` wordt gerespecteerd.

## Waar het ontwerp geen kleur voor gaf

De legenda noemt zeven taaktypen. De app kent er tien. Toegevoegd in dezelfde
familie: delen `#0F7C78`, planten `#7A9E3C`, overig `#8A8371`.

## Richting A — Bloemenveld (september 2026)

Het eerste ontwerp bleek in gebruik vlak: kleur zat alleen in bolletjes van
acht pixels. Richting A uit `docs/ontwerp/kleurrichtingen/` is doorgevoerd:

- **Kleur als vlak.** Locatietegels in pasteltinten met de telling erin, en per
  taak een bloemvorm in de kleur van het taaktype met het pictogram erin. Wit
  op de volle tinten haalt geen AA (leaf 3,9:1, cornflower 3,6:1), dus de
  tegels zijn pastel met een donkere inkt uit dezelfde familie (`--tint-*` en
  `--op-*`, alle boven 6:1).
- **Pictogram naast kleur.** Kleur is nu ook decoratie, dus elk taaktype heeft
  een eigen lijntekening — kleur alleen zou te weinig onderscheid geven (§11).
- **Displayletter.** Fraunces is vervangen door Bricolage Grotesque: dezelfde
  rol, meer karakter, en zwaarder gezet (800 in plaats van 600).
- **Bloesem op de achtergrond.** Een aquarel bovenaan de pagina, met een
  gradient die hem laat wegvloeien in het crème. Vast, dus hij schuift niet
  mee, en weg op papier. Twee maten (`bloesem-klein.webp` 12 kB tot 760 px,
  `bloesem.webp` 30 kB daarboven).
- **Kalender zonder tint.** In het voorstel kleurde elke dag met werk mee. Bij
  echte vensters van een hele maand kleurt dan de hele kalender; de stippen per
  taaktype dragen die informatie al. Alleen die zijn gebleven.

Meegenomen tijdens dezelfde ronde, want de meetlat van §11 gold er al voor:
de filterpillen op Agenda en Planten hadden een raakvlak van 34 px (het
onzichtbare keuzeveld lag op de pil, niet erachter), en de kalenderdagen op de
agenda 40 px. Beide staan nu op 44.
