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

## Water geven uit de agenda (september 2026)

Het zorgprofiel gaf water geven een interval van een paar dagen. Over een
seizoen zijn dat honderden regels, en die overstemden alles wat er verder te
doen was. Water geven is nu weer-gestuurd: de taak blijft op de plant staan met
het venster en de uitleg, maar hij verschijnt alleen als de droogteregel
aanslaat. Die regel geldt voor buitenplanten die droogtegevoelig zijn of een
waterbeurt in hun profiel hebben.

Binnen geldt geen enkele weerregel (§4.1), dus daar doet de kalender het:
kamerplanten krijgen één waterherinnering per week, het jaar rond. Wat iemand
zelf heeft ingesteld blijft staan — alleen taken uit een AI-profiel worden
omgeschreven.

## De agenda gaat over één dag (september 2026)

Het beginscherm toonde elke beurt die de maand ergens raakte. Bij een taak van
elke twee dagen zijn dat vijftien regels per maand voor één plant, en dan staat
dezelfde varen vijftien keer onder elkaar.

Nu:

- **Vandaag** toont per taak hooguit één beurt: de laatste waarvan het venster
  is begonnen. Daaronder staat **Binnenkort** ingeklapt, met wat er de komende
  zeven dagen begint.
- Beurten die daarvóór lagen en nooit gedaan zijn, krijgen de status
  `verlopen`. Je kunt gisteren niet meer water geven, en een stapel gemiste
  beurten helpt niemand. Ze staan nergens in beeld en tellen nergens mee — ze
  blijven alleen in de opslag staan zodat de generator ze niet opnieuw aanmaakt.
- Het rooster blijft vast liggen. Vink je een dag later af, dan schuift het
  ritme niet mee; de volgende beurt staat waar hij stond.
- Afvinken haalt de regel meteen uit de lijst. Bovenaan blijft één regel staan
  om het terug te draaien.
- De agenda-pagina heeft altijd een dag geselecteerd: vandaag, of de eerste van
  de maand waar je naartoe bladert.

Een taak met een lang venster (snoeien, 1× in maart–april) staat vanaf de eerste
dag van dat venster elke dag in beeld tot hij gedaan is, en heet daarna
achterstallig. Dat is met opzet: werk dat blijft liggen hoort zichtbaar te
blijven.

## Richting Kwekerij (september 2026)

Het ontwerp bleef te braaf. Van drie nieuwe voorstellen is "Kwekerij" gekozen
en een slag feller doorgevoerd:

- **Taakkaart met beeldtegel.** Links een vierkant van 62 px: de foto van de
  plant, of een kleurvlak in de taaktypekleur met het pictogram erin. Rechts
  een volle groene knop van 46 px in plaats van een dun cirkeltje — afvinken is
  de belangrijkste handeling op het scherm en ziet er nu ook zo uit.
- **Locatie als gekleurde pil** in plaats van een grijs kopje, met een vaste
  kleur per locatie. Daarmee vervielen de losse locatietegels: dubbelop.
- **Onderbalk met pictogrammen** en een zwevende cameraknop in het midden, de
  kortste weg naar een nieuwe plant. Vier bestemmingen passen daarnaast, dus
  Locaties is verhuisd naar Meer (bij Labels, Jaaroverzicht en Archief).
- **Weekstrook** op het beginscherm in plaats van de maandkalender: die past
  bij een agenda die over één dag gaat. De maand staat op /agenda.
- **Vorm als systeem:** een plant is een blob (plantenlijst, plantpagina), een
  taak is een afgeronde vierkant (takenlijst). De ene is een portret, de andere
  een afvinkregel.
- Is alles gedaan, dan staat er een groen vlak met een vinkje in plaats van een
  grijs kaartje.

## Inloggen met een eigen wachtwoord (september 2026)

De overdracht noemt Google en een inloglink per e-mail (§3). In de praktijk
liep dat vast: Resend mag zonder geverifieerd domein alleen naar het adres van
de accounthouder mailen, dus een uitnodiging en een inloglink naar de partner
kwamen niet aan.

Daarom een derde manier: een zelfgekozen wachtwoord.

- **Aanmelden kan alleen met een geldige uitnodiging.** Er is geen open
  registratie; de uitnodiging is het bewijs dat de tuineigenaar dit adres
  binnen wil hebben. De eigenaar deelt de link zelf, bijvoorbeeld via een
  berichtje.
- **Bestaat het adres al, dan gebeurt er niets.** Die persoon logt in zoals
  altijd en neemt de uitnodiging daarna aan. Anders zou wie de link in handen
  krijgt een bestaand account kunnen overnemen.
- **Hashen met scrypt** uit Node zelf (N=16384, r=8, p=1), met een eigen zout
  per wachtwoord en een vergelijking op vaste tijd. De hash staat onder een
  eigen sleutel, los van het profiel, zodat hij nooit kan meeliften met
  gebruikersgegevens die naar de browser gaan.
- **Minstens tien tekens**, en niet je eigen e-mailadres of iets uit een klein
  lijstje voor de hand liggende woorden. Lengte doet meer dan hoofdletters en
  leestekens.
- **Raden wordt afgeremd** met dezelfde limiet als de AI-endpoints: twintig
  pogingen per uur per e-mailadres, zestig per dag.
- Wie al binnen is kan onder Instellingen een wachtwoord zetten of wijzigen;
  wijzigen vraagt eerst om het huidige.

Wat er niet is: een wachtwoord vergeten-mail. Die zou over dezelfde mail lopen
die nu juist niet werkt. Kwijt betekent: de eigenaar nodigt opnieuw uit, of
inloggen met Google.
