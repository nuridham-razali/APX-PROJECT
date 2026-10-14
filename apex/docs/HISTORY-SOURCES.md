# On this day source policy

The HUD no longer downloads the first Wikipedia event. It displays only reviewed entries in `lib/history-service.mjs`, with institution attribution, a direct supporting link and a review date. The exact date and wording must be checked against the linked record before adding an entry. Source-reviewed means checked against that record; it is not a guarantee that any publisher is infallible.

Current coverage: 7 October, Luna 3's first photographs of the Moon's far side in 1959. NASA's linked record explicitly dates the first image to 7 October 1959; reviewed on 7 October 2026. Other dates show “No verified event available for this date.” There is no generated, unchecked-feed or different-date fallback, and no paid API is involved.

This is a limited curated catalogue, not a live news service or an automated fact-checker. Extend it through source review; do not label generated claims as verified.

Verification: `node --test tests/history.test.mjs` checks calendar validation, source provenance, unavailable dates, future-event exclusion and offline operation. The source itself was reviewed separately in a browser.
