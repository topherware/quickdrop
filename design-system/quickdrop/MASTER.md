# QuickDrop — Midnight Glass

Product: account-free file transfer utility. Stack: Next.js 16 / React 19 / CSS.

Direction updated from the user's three supplied references: dark smoky glass,
midnight navy, violet/pink/cyan light, prismatic rings and glossy spheres behind
transparent surfaces. This supersedes the earlier Pearl Glass direction.

Desktop: a large frosted frame surrounds the utility and hero. A separate glass
transfer panel reveals softened light behind it. Mobile: one main glass panel,
with compact task-first spacing and the step timeline below the transfer panel.

Canvas #080c1c; primary text #f5f5ff; secondary text #bec6df; lavender accents
#c6b7ff; success #9ce5cb. Primary actions use a darker violet-to-plum gradient
with white text. Inputs retain a dark translucent fill and visible #9097bd border.
The QR remains black on white for scanning.

Use low-opacity glass fills, thin light edges, inset highlights and dark shadows.
Backdrop blur: 10 px outer desktop frame, 22 px transfer panel. No moving blur,
no large raster assets or external font requests.
Provide solid dark surfaces when backdrop-filter is unavailable.

User-requested motion: glossy spheres drift over 18–22 seconds; rings drift and
rotate over 26–30 seconds. Animate transforms only. The illustrative three-step
timeline fills over an 8-second cycle, holds, fades, and resets. It does not
represent upload status. The visible pause toggle was removed at the user's request;
prefers-reduced-motion disables the loops and keeps all three steps readable.
The logo uses a brighter lilac gradient (#a27aff to #c6a6ff) and violet glow.
Privacy and usage limits share one native details disclosure below the main frame,
with both summary labels at 14 px. The footer slogan is removed.
The same lilac Layers2 brand mark is used in app/icon.svg as the browser favicon.
“Created by Christopher Cuangdinata.” sits on the right of the disclosure row,
and wraps below it on small screens. The credit stays unchanged across languages.

Default language: English. An EN/ID switch in the top right enables Indonesian.
Persist the explicit preference locally; keep selected files, entered codes,
transfer sessions and countdowns intact when switching. Update the document lang.
Hero: “Your files. Any device.” / “File kamu. Lintas perangkat.”
The hero illustration is a scalable SVG: phone, file packet and arrowed path,
receiving laptop with a completed file. It uses the existing violet/cyan lighting.

Headings: self-hosted Manrope 600–800. Body: self-hosted DM Sans 400–700.
16 px body, 14 px secondary, 12 px labels. Controls at least 44 px; main action 50 px.
Spacing: 4/8/12/16/24/32/48/64. Desktop two columns, stack at 1000 px.
Mobile intro is compact; receive route foregrounds the receiver task.

Accessibility: check text against composited glass backgrounds, aiming for 4.5:1;
essential control boundaries 3:1; visible focus;
native modal with explicit focus return; result announcements; named QR;
inline errors; full-name disclosure; reduced motion; safe-area gutters.

Sources: user's references; ui-ux-pro-max explicit Glassmorphism style match;
frontend-design composition guidance. The aggregate design-system query again
returned Flat Design and was rejected because it conflicted with the references.
The explicit style query verified layered transparency, blur, vibrant backgrounds,
light reflection and thin borders. Next.js performance searches returned no match;
blur restraint follows general CSS guidance rather than a claimed database match.
