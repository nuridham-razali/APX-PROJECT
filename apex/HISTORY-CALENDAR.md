APEX On This Day now covers all 366 month/day combinations, including February 29. The HUD uses the selected local timezone and requests a new entry when its date changes. No API key, LLM request, or network connection is required to display the bundled records.

The existing manually reviewed NASA, Smithsonian, NPS, and Chicago History Museum entries take precedence. Remaining dates use a snapshot of the official Naval History and Heritage Command calendar, retrieved on October 11, 2026:

https://www.history.navy.mil/year-at-a-glance.html

Its public calendar JSON, used by that page's own JavaScript:

https://www.history.navy.mil/content/history/nhhc/year-at-a-glance/jcr:content.getyearataglance.json?start=1&end=366

These are **institutional records**, not individually independently corroborated claims. Supporting links, when present, belong to the same institution. The API distinguishes this provenance from `source-reviewed`. Sources and provenance remain available in the backend/API; the HUD shows only the year and event text. The fallback calendar focuses on naval history, rather than global historical coverage.

A known conflict is excluded by the importer: the January 2 Weserland entry is labelled 1942 in the calendar, whereas the Naval Academy's archival action report identifies January 1944. The calendar uses the other published January 2 event instead. Exclusion evidence: https://www.usna.edu/Library/sca/man-findingaids/view.php?f=MS_416 . No corrected year is guessed.

The importer takes a short opening sentence directly from the source, decodes HTML entities, discards markup, and validates complete coverage before writing the snapshot. It does not generate or rewrite claims. Records later than a requested historical year are excluded; a date with no eligible record remains honestly unavailable.

To update the snapshot, download the public JSON into a local file and run:

```powershell
node scripts/import-history-calendar.mjs path/to/calendar.json
node --test tests/history.test.mjs
npm run build
```

Tests validate all 366 dates, local date-driven request compatibility, year rollover, leap day, offline operation, provenance, and rejection of unsupported records. They do not claim an independent historical audit of every official record.
