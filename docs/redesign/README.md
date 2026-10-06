# Frontend redesign review

Implemented on `redesign/frontend-brand` for review before merge. The brand source of truth remains [design.md](../../design.md).

## Decisions and audit

Reading this as a Nigerian fintech redesign for people managing currency risk, with a calm, modern visual language rooted in naira textures and the selected green palette. Marketing dials: **DESIGN_VARIANCE 6 / MOTION_INTENSITY 4 / VISUAL_DENSITY 3**. Product screens stay denser, with restrained movement and their existing working components.

The audited interface used serif headings, a generic H mark, a tilted quote panel, three flat feature cards, and a long market-maker recruitment layout. It had no editorial imagery. Its useful foundation was the tagline, routes, risk language, fixed-point math, unsigned builders, honest application handoff, and read-only demo behavior. Those remain.

| Reference | Decision | Implementation |
| --- | --- | --- |
| Auxia | Connected hero narrative and problem → approach explanation | Original patterned paper sculpture; moving buyer/seller connectors; four clickable workflow stages with a travelling marker |
| Cloaked | Human context through image cards | Nigerian entrepreneur and creative-workspace imagery, plus a risk-focused still life; readable copy below photographs |
| Gumloop Enterprise | Direct participation/contact split with clear resources | Market-maker copy beside the existing application handoff; compact role rows; retained economics, planned capabilities, and capital-risk sections |

The buyer/seller image links lead to their respective example; the seller uses `/market?side=seller`, preserving the existing route. Marketing visuals contain no invented rates, clients, testimonials, or guaranteed outcomes. The interactive learning example calls the existing BigInt `buyerPayoffRaw` calculation, explicitly labels calculated values, and retains the original formula and worked examples.

## Taste Skill review

Applied the locally installed **design-taste-frontend** and **redesign-existing-projects** skills. Local skill files remain ignored, as requested.

- **Layout and hierarchy:** retained navigation, page slugs, anchors, and principal conversion paths. The hero has a two-line headline and visible action. The public pages use different layout families rather than repeating flat feature cards. Product headings are smaller so controls remain prominent.
- **Typography and color:** bundled Space Grotesk, IBM Plex Sans, and IBM Plex Mono with licenses; tabular financial figures; selected green/paper/ink tokens. Blue has a functional role, clay an editorial role, and lime a small signature role. Existing financial status colors retain their meaning.
- **Artwork and logo:** used image generation for three original section-specific images. Full-resolution PNGs and all earlier logo concepts remain archived. The selected `02-woven-monogram` artwork supplies both header/footer wordmarks and the HM favicon; no letters were retyped. WebP delivery reduces the two logo transfers from approximately 1.88 MB to 73 KB combined.
- **Texture:** reused the approved rosette's exact paths in desktop margins and the market-maker artwork. Generated paper ribbons carry woven/guilloché detail. Texture does not sit behind financial controls or body copy.
- **Motion:** continuously animated hero connectors have pause/resume. The workflow progresses on deliberate selection. Reduced-motion preferences stop animations and transitions. No scroll hijacking or extra motion dependencies.
- **Accessibility:** semantic headings, real links and buttons, descriptive image alternatives, keyboard navigation, visible blue focus rings, radio controls, labelled rate slider, live calculated output, and 44px principal controls. Existing skip navigation and disclosures remain. Original HM icon visually checked at 16, 24, and 32px.
- **State and functionality:** existing empty/loading/error states, auth, collateral distinctions, read-only market data, unsigned console, and disabled writes remain. Existing mobile table-label escape and card intrinsic-width overflow were fixed without hiding the table.
- **Contextual exceptions:** the selected palette and light paper page theme override generic skill defaults about a single accent and automatic dark mode. No theme toggle was added. The dark footer uses the selected dark-logo variant. Native CSS, React, and the existing Lucide package are retained; no framework migration, icon-library replacement, fabricated product screenshot, or GSAP dependency. Existing legal and release-dependent copy was preserved even where generic copy-length rules favor shorter text.

## Validation

`npm run check` passed: spec-math verification (3,714 reserve cases, 2,168 mixed matches, 512 fee paths, 648 trigger cases), 21 Vitest tests, contract type checking, 7 contract tests, ESLint, TypeScript application checking, and Vite production build. `git diff --check` passed.

Chromium reviewed home, How it works, market makers, market, guide, integration console, risks, account overview, positions, position detail, wallet, and 404 at **320, 390, 768, 1024, and 1440px**. The [browser result snapshot](browser-review.json) records the route/viewport checks and interaction checks. No document overflow or page errors remained.

Interactions reviewed: mobile-menu open/close and navigation, keyboard workflow selection, animation pause/resume, reduced motion, buyer/seller/rate example changes, seller image-card handoff, invalid market lot size, review panel, disabled trading controls, and cross-page guide anchors.

Browser checks of protected pages used an isolated local demo-auth preview with `VITE_PRIVY_APP_ID=''` and `VITE_PRIVY_CLIENT_ID=''`; these overrides are **not committed configuration**. No external login, application submission, transaction signing, or transaction submission was performed. Live RPC/auth correctness and real-world performance budgets are not established by this visual review. The existing wallet/auth bundles remain part of the build; no synthetic Lighthouse claim is made.

## Artifacts

- [Before: home](before-home.png)
- [Home hero](screenshots/home-hero.png), [full desktop](screenshots/home-desktop.jpg), [phone](screenshots/home-mobile.jpg)
- [How it works](screenshots/how-it-works-desktop.jpg)
- [Market makers](screenshots/market-makers-desktop.jpg)
- [Market](screenshots/market-desktop.jpg)
- [Favicon small sizes](screenshots/favicon-sizes.png)
- [Artwork provenance and originals](images/manifest.json)

The favicon is an SVG container around the selected raster symbol, not a traced vector master. Exact vector, transparent, and monochrome logo masters remain future asset work; the frontend uses the existing chosen artwork.
