# QuickDrop frontend audit

11 October 2026. Audit and proposals only; application source and Supabase configuration were not modified.

## Scope and evidence

Reviewed `app/globals.css`, `app/layout.tsx`, `components/quickdrop.tsx`, `components/send.tsx`, `components/receive.tsx`, `components/ui.tsx`, and the client API helpers. Applied ui-ux-pro-max accessibility, interaction, responsive layout, and typography guidance, supported by current Web Interface Guidelines.

Inspected the rendered Chromium UI at widths 320, 360, 390, 768, 820, 821, 834, 900, 1024, 1280, and 1440 CSS pixels. Inspected empty send/receive, populated receive, sender ready, upload failure/recovery, lookup failure, download pending, revoke pending, and the confirmation dialog. API calls and upload failures were mocked; no real transfers or remote writes were performed. Development overlays were hidden in the final screenshots and excluded from product findings.

This is a manual/code audit, not a complete WCAG conformance assessment. Safari, real touch devices, screen-reader output, browser text enlargement, and operating-system high-contrast modes remain untested. Priorities: P1 = fix before visual polish; P2 = next refinement.

## Findings and proposals by source

### app/globals.css

- **P1 — Layout and spacing, lines 973–1040.** The mobile page gives substantial height to the header and promotional intro before the utility. At 360 × 800, the empty send panel starts at y=330, the file picker at y=506, and the primary button spans y=765–813. At 320 × 800, the heading wraps to three lines and the primary button starts at y=808. The initial button is disabled, so this is a task-discovery and density issue rather than a broken action. **Proposal:** mobile header around 64 px; shorter intro with a 28–36 px fluid heading; 20–24 px section gaps; a 140–160 px file picker. On `/receive`, make the receive form the first substantial content. Keep explanatory content below the utility.

- **P1 — Typography, lines 23, 353, 403–412, 444, 475, 488, 542, 678, 740, 835, 1054.** Body defaults to 14 px; important limits, expiry notes, file sizes, and code instructions are 10–11 px. Eyebrows are 9 px and the mobile panel footer is 7 px. These sizes make the product harder to read even though text contrast generally passes. **Proposal:** 16 px body/form copy, 14 px secondary information, 12 px minimum labels; keep the code larger with tabular numerals. Keep DM Sans and the selective serif accent. Small text is a usability finding, not a blanket WCAG font-size violation.

- **P1 — Color and control identification, lines 373, 648–659.** The receive input border `#d5dac9` has approximately 1.35:1 contrast against its fill, and the file-picker border approximately 1.48:1. Control boundaries are difficult to distinguish at rest. **Proposal:** a semantic control-border token that reaches at least 3:1 against adjacent backgrounds where the boundary identifies the control. Preserve the palette, strengthen selected-tab styling with an underline/border, and use a consistent focus ring for the compound code input. Its current focus indication is an orange border; it is not completely absent.

- **P2 — Responsiveness, lines 111–116, 950–1005.** At 821 px, the fixed 425 px panel and 320 px minimum intro width occupy more than the grid's available inner width. The panel ends at x=811 instead of x=785, shrinking the intended right gutter from 36 px to 10 px. At 834 px the right gutter is 23 px. No document-level horizontal scrollbar was observed. **Proposal:** stack the layout before two columns become cramped, approximately 900 px, or use flexible tracks with `minmax(0, 1fr)` and a panel width capped at 460 px. Test both sides of every breakpoint.

- **P2 — Spacing consistency, lines 114–116, 343–370, 420–444, 758–787.** The composition mixes many one-off spacing values and allocates a large empty picker area while helper text is unusually compressed. **Proposal:** use a 4/8/12/16/24/32/48 spacing scale; give field/help/error groups predictable spacing and reduce nonfunctional height on mobile. This is design refinement, not an assertion that every off-scale value is wrong.

- **P2 — Long content, lines 530–538.** Single-line ellipsis obscures distinguishing filename suffixes. In the 320 px receive state, two different PDF names both render as `Quarterly-report-final…`; full names have no visible detail affordance. **Proposal:** allow two lines, preserve the extension, and offer an accessible file-details disclosure for the full name. Hover-only tooltips are insufficient on touch devices.

### components/ui.tsx

- **P1 — Keyboard focus restoration, lines 89–101.** The dialog uses native `showModal()`, names/describes itself, and focuses the safe cancel action. However, after opening it and pressing Escape, focus was on `BODY`, not the invoking “Akhiri transfer” button. **Proposal:** retain a ref to the opener and restore focus explicitly after cancellation/closure. Preserve the native modal behavior and safe initial focus. Native modal tab handling worked in the inspected forward-tab case; a missing focus trap is not claimed. Focus-return guidance here comes from reproduced behavior and the standard dialog pattern, not a specific ui-ux-pro-max search match.

### components/receive.tsx

- **P1 — Accessibility and interaction states, lines 65–86, 119–181, 246–249.** Successful lookup replaces the form without focusing the result heading or announcing the file count; the only `role="status"` is empty. After failed lookup, focus also falls to `BODY`, while the alert sits after the tip block (about y=909 in the 360 px document). Errors do have `role="alert"`, so they are not silent by definition. **Proposal:** focus the result heading after user-initiated lookup, announce “3 files ready,” move lookup errors near the field/form, and return focus appropriately after failure. Connect field errors to the input; use `aria-invalid` for invalid values, not service/network failures. Announce transfer expiry once, not every countdown tick.

- **P2 — Download pending feedback, lines 88–115, 146–158.** Signing one download disables all file download controls; the active control retains the “Unduh” label while showing a spinner. **Proposal:** announce “Preparing download,” use explicit pending text where space permits, and explain the temporary lock if all controls must stay disabled. Keep the existing download-started confirmation. Consider per-file pending state only after verifying that concurrent requests fit the existing grant model.

### components/send.tsx

- **P1 — Recovery interaction, lines 115–133 and 454–464.** After an initialized upload fails, the picker says “Tambahkan file,” but selection is actually checked against the entire original batch. Choosing an additional file produces “Pilih semua file asli dengan nama dan ukuran yang sama.” This was reproduced with mock failures. **Proposal:** after initialization, label the picker “Pilih ulang batch asli” or explain that the batch is fixed. Reserve “Tambahkan file” for the pre-initialization state. Keep the completed-file preservation during retry.

- **P1 — Revoke pending feedback, lines 266–283 and 405–409.** While DELETE is pending, “Akhiri transfer” remains enabled, the dialog has disappeared, and feedback is empty. **Proposal:** show “Ending transfer…” in a status region and disable the revoke action until it settles, preserving access to useful non-destructive content. Return focus to the ended-state heading on success or the retry action on failure.

- **P2 — Accessible QR, lines 373–378.** The rendered SVG has `role="img"` but no accessible name. The adjacent copy-link and numeric code already provide alternatives. **Proposal:** give it a descriptive accessible name, such as “QR code for this transfer; use Copy link to share.” Do not place the secret share token in the label.

### components/quickdrop.tsx

- **P2 — Hierarchy, lines 88–100 and transfer headings in send.tsx:419 / receive.tsx:124.** “01 / 02” for send and “02 / 02” for receive suggest consecutive steps within one device's workflow, while the modes are independent and “How it works” lists three steps. The ready headline is metaphorical and less immediate than the code-sharing task. **Proposal:** remove cross-mode step badges or replace them with meaningful state labels. Use concrete ready copy such as “File siap dibagikan,” then code/copy, QR/link, expiry, and the file list in that order.

- **P2 — Navigation and accessibility, lines 19, 33, 109–145.** There is no skip link. Selected mode lives only in React state; a reload after selecting receive returns to send and clears the entered code. Keyboard handling differs on `/receive`, where ArrowLeft does not select/navigate to send. **Proposal:** add a skip-to-transfer/main link; keep non-sensitive mode in the URL; make keyboard behavior consistent with whether the controls are tabs or navigation links. Keep share tokens out of query parameters and preserve the existing fragment removal.

## What should remain

- The orange/off-white/sage palette and restrained visual identity.
- DM Sans body typography with the limited serif headline accent.
- Responsive removal of decorative illustrations on mobile.
- Semantic buttons, named icon controls, numeric code input, labelled progress bars, inline alerts, and clipboard fallback.
- 44–48 px major control targets. The 44 px target is a useful comfort goal, not a claim that every web target requires 44 px under WCAG AA.
- Reduced-motion CSS and tabular countdown/code numerals.
- Main text colors: white on accent is 4.5035:1, muted on white 5.64:1, tagline on paper 4.81:1. The primary pair passes narrowly; any palette adjustment should preserve or improve that margin.

## Proposed implementation order — not applied

1. Fix focus return/result announcements, error placement, QR naming, and pending/recovery states.
2. Raise important text sizes and strengthen control borders/focus styling.
3. Compact mobile layout, repair tablet gutters, clarify hierarchy, and improve filename inspection.
4. Normalize spacing and mode navigation; verify the changes in all states at 320/360/390/768/820/821/834/900/1024/1440 px. Include keyboard-only use, a real screen reader, browser enlargement, reduced motion, and Safari mobile.

No new animation, framework migration, backend redesign, or palette replacement is proposed.

## Screenshots

- [Desktop home](artifacts/ui-audit/home-1440.png)
- [Mobile home](artifacts/ui-audit/home-360.png)
- [Tablet breakpoint](artifacts/ui-audit/home-821.png)
- [Ready state, 320 px](artifacts/ui-audit/ready-320.png)
- [Received filenames, 320 px](artifacts/ui-audit/received-320.png)
- [Upload failure, 360 px](artifacts/ui-audit/upload-error-360.png)
- [Confirmation dialog viewport](artifacts/ui-audit/dialog-viewport-360.png)

References: [ui-ux-pro-max](C:/Users/User/.agents/skills/ui-ux-pro-max/SKILL.md), [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).
