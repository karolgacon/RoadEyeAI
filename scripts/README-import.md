# Import dróg Polski (OSM / Overpass)

Skrypt `import-poland-roads.mjs` pobiera drogi klas `motorway`, `trunk`, `primary`, `secondary` z Overpass API (siatka kafelków nad Polską) i zapisuje je do PostGIS (`roads`).

## Wymagania

- `DATABASE_URL` w `.env.local`
- uruchomione migracje `001` i `002`

## Uruchomienie

```bash
# szybki import (motorway + trunk + primary) — zalecany start
npm run import:roads

# pełniejszy zakres (+ secondary) — dłużej, więcej wierszy
npm run import:roads -- --include-secondary

# tylko wybrany kafelek / mniejszy obszar (test)
npm run import:roads -- --bbox=16,50,18,52
```

Źródło danych: OpenStreetMap via Overpass (ODbL).
