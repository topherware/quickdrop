# QuickDrop redesign verification

Historical verification of the first Pearl Glass iteration. The current
reference-driven dark design is documented in UI_UX_NIGHT_GLASS.md.

11 October 2026. Implemented the user-approved Pearl Glass direction with ui-ux-pro-max guidance. The original UI_UX_AUDIT.md remains the baseline; its recommendation to retain the original palette was superseded by the user's authorization to redesign colors and typography.

## Changes

| Audit area | Implemented improvement | Evidence |
| --- | --- | --- |
| Layout and hierarchy | Flexible desktop tracks, stack at 1000 px, shorter mobile intro, concrete ready-state copy, independent mode symbols | Screenshots and responsive browser assertions |
| Spacing | Consistent field/help/error groups, generous touch controls, compact mobile picker | Initial primary action ends at y=766.69 at both 320 and 360 CSS px |
| Typography | Self-hosted Manrope headings and DM Sans body; important helper text at least 12 px | CSS/source inspection and rendered screenshots; tiny illustration text is decorative and hidden from assistive technology |
| Color | Pearl/ice background, ink text, cobalt actions, mint status; frosted outer surfaces with opaque inputs | Primary white/cobalt text 6.31:1; muted/pearl 5.22:1; control borders 3.28:1 against input fill and 3.17:1 against download fill |
| Accessibility | Skip link, visible focus, named QR, inline described errors, full filename disclosures, result focus and status announcements | Browser regression checks; no claim of complete WCAG conformance |
| Responsiveness | Balanced tablet gutters, no document horizontal overflow, compact receive route, safe-area gutters | Assertions at 320, 360, 600, 821, 1000 and 1280 px; screenshots at 1440, 821, 360 and 320 px |
| Interaction | URL-backed modes with history/reload support; tab keyboard navigation; dialog Escape focus restoration; explicit download/revoke pending states; failed revoke returns focus; reset returns focus to picker | Desktop Chromium and emulated Pixel 7 tests |
| Recovery | Initialized upload asks for original batch, preserving retry semantics | Mocked unfinished-upload test |
| Motion and glass fallback | Brief panel entry, reduced-motion override, solid surfaces when backdrop-filter is unavailable | Reduced-motion inspection returned animation-name: none; CSS fallback inspected |

## Verification

- ESLint: passed.
- TypeScript: passed, including production build type checking.
- Unit/local database tests: 26 passed across 5 files.
- Browser regressions: 22 passed across desktop Chromium and emulated Pixel 7.
- Production build: passed.
- Changed application and test files formatted with Prettier.
- Production dependency audit: no reported vulnerabilities with npm audit --omit=dev. Installation reported dev-dependency advisories; these were not changed as part of the visual work.
- Final screenshot capture reported no page errors or hydration errors; the mocked service-error state produced an expected HTTP 503 console entry.

The browser suite starts its own server and refuses to reuse a live preview. The test server points Supabase at localhost port 9 and clears service credentials and secrets. A read-only status request must return QD_SETUP before each browser test. All browser API requests are mocked and external HTTPS requests are blocked. An automatic approval rejection prompted this extra isolation; the isolated run subsequently passed.

Earlier screenshot automation hid input carets before hydration and caused development hydration diagnostics. Final captures wait for functional tab interaction before screenshotting, and the diagnostics did not recur.

## Artifacts and limits

- artifacts/redesign/home-1440.png
- artifacts/redesign/home-821.png
- artifacts/redesign/home-360.png
- artifacts/redesign/home-320.png
- artifacts/redesign/receive-desktop.png
- artifacts/redesign/receive-results-320.png
- artifacts/redesign/receive-error-320.png
- artifacts/redesign/chromium-dialog.png
- artifacts/redesign/mobile-dialog.png
- artifacts/chromium-ready.png and artifacts/mobile-ready.png

Safari, physical touch devices, real screen-reader output, text enlargement, and OS high-contrast modes remain untested. Glass fallback was inspected in source rather than reproduced in a browser without backdrop-filter. No database, bucket, policy, or backend API implementation was changed by this redesign.
