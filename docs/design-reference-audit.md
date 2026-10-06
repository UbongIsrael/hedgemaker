# Frontend reference review: Auxia, Gumloop, Cloaked

Reviewed 6 October 2026. This is reference research for HedgeMaker. The final design direction and `design.md` will follow the user's element selections and image mood board.

## Scope and evidence

Opened the three homepages, every visible desktop navigation dropdown, and the 67 distinct destinations linked from those navigation bars. Captured desktop homepages at 1440 × 1000, dropdowns, scrolling sections, and available inner pages. Inspected mobile layouts at 390 × 844; saved mobile menu captures are available for Auxia and Gumloop. Opened Gumloop's Get Started account modal without submitting anything.

The browser captured 24 linked destinations successfully: all 7 Auxia destinations, 15 Gumloop destinations, and 2 Cloaked destinations. The remaining 43 hit a transport failure in the execution environment, including on retry. A separate web content fetch returned meaningful content for 39, a partial documentation shell for 1, and no reviewable content for 3. Visual findings below rely on rendered pages and screenshots. Content-only entries support information architecture observations, not claims about their colors, spacing, or typography.

The three unavailable destinations were Gumloop Workshops, Cloaked Login, and Cloaked's external careers application. No authenticated product workspace, application submission, checkout, or personal-data scan was entered. All coverage and per-page source links appear in [the navigation inventory](design-references/navigation-inventory.md). The screenshot browser is [the reference gallery](design-references/gallery.html).

Some full-page captures do not show every scroll-triggered animation. Auxia's viewport-by-viewport captures are the reliable visual reference for its scrolling sections. Screenshots record a moment in an animation, not its complete motion behavior. This is a design review, not a comprehensive accessibility or performance audit.

## Comparison

| Dimension | Auxia | Gumloop | Cloaked |
| --- | --- | --- | --- |
| Overall character | Expansive, technical, enterprise-oriented | Approachable software, restrained interface design | Warm consumer brand, editorial typography |
| Layout | Large left-aligned statements; process diagrams; broad explanatory panels | Left-aligned homepage; centered solution heroes; product canvases and modular grids | Split text/media homepage; framed grid; rounded imagery and narrative sections |
| Display type | PP Neue Montreal; oversized and tightly tracked | Gellix; rounded geometric sans with medium weight | Simula Book; expressive serif with relaxed line height |
| Supporting type | Neue Montreal body, IBM Plex Mono labels | Geist Sans in UI and supporting content | STK Bureau Sans in body, navigation, controls |
| Color | Pale cream, charcoal, saturated blue | White, cool grays, near-black; small multicolor accents | Warm cream, very dark brown, orange; red in threat messaging |
| Spacing | Wide text gutters and large chapter breaks | Large gaps between modules; tight spacing inside interface demonstrations | Stable framed gutters; roomy reading blocks; imagery balances empty space |
| Most useful reference | Typography, diagram storytelling, statement sections | Product explanations, menus, controls, comparison layouts | Photography direction, serif/sans pairing, consumer warmth |

## Auxia

Sources: [Home](https://www.auxia.io/), [About](https://www.auxia.io/about-us), [Agent Studio](https://www.auxia.io/agent-studio), [Decisioning](https://www.auxia.io/decisioning), [Blog](https://www.auxia.io/blog), [Demo](https://www.auxia.io/demo), [Documentation](https://docs.auxia.io/), [Japanese locale](https://www.auxia.io/ja).

### What it does well

**Layout.** The homepage gives a connected workflow diagram its own band above the main statement. It illustrates input, orchestration, decision-making, and output, so the product has a visible mechanism. Lower down, an exploded stack diagram sits beside a plain-language explanation. About, Agent Studio, and Decisioning reuse a large left headline with supporting information elsewhere in the grid. This repetition makes separate pages feel related without requiring identical backgrounds.

**Typography.** PP Neue Montreal supplies the main voice. At the captured desktop width, the homepage H1 is 104px, medium weight, with approximately 0.95 line height and -0.03em tracking. Section headings reach 64px. That large jump in scale gives short statements authority. IBM Plex Mono labels identify technical steps and capabilities while keeping their visual role distinct from body copy. Body copy commonly uses 20px/26px in the major explanatory sections.

**Color.** The sampled homepage colors are pale cream `#F0EFE3`, charcoal `#232323`, and blue `#0B4FFF`. Blue marks primary actions, connectors, and selected product surfaces. Charcoal supports a problem chapter and Agent Studio's product hero; Decisioning receives a blue hero. Background changes have a narrative or product role, while the same type and grid tie them together.

**Spacing and white space.** Main homepage content begins about 104px from each desktop edge, producing a 1232px content area in a 1440px viewport. The huge title and narrow description occupy only part of that width. This leaves room for the workflow and gives the copy strong visual priority. The dark problem section uses two text columns with a substantial gap instead of enclosing every paragraph in cards.

**Navigation.** The top-level list is compact: About, Documentation, Blog, Products, demo, and language. Products opens a small two-item dropdown. This suits a focused product family. Documentation switches to a denser sidebar-and-article layout. Blog uses a feature story followed by filters and a content grid. Demo pairs a value explanation with a contained form. The Japanese page retains the brand palette while allowing different line breaks and a different navigation version.

### Elements available to select

| ID | Element | Screenshot |
| --- | --- | --- |
| A1 | Oversized, tightly set sans-serif headlines | [Homepage](design-references/auxia-home-desktop.png) |
| A2 | Cream, blue, and charcoal relationship | [Decisioning hero](design-references/auxia-decisioning-desktop.jpg) |
| A3 | Connected workflow running across the hero | [Hero and workflow](design-references/auxia-nav-products.png) |
| A4 | Large explanatory diagram beside concise copy | [Platform section](design-references/auxia-home-section-3.jpg) |
| A5 | Small mono labels and broad feature panels | [Feature panel](design-references/auxia-home-section-4.jpg) |
| A6 | Value explanation beside a clear demo form | [Demo page](design-references/auxia-demo-desktop.jpg) |

**Application note.** Its 104px marketing type and long visual chapters belong on a landing page. A trade ticket or positions table needs a denser scale. The diagram method could explain how rate protection works, provided it shows our actual process.

## Gumloop

Rendered sources include [Home](https://www.gumloop.com/), [Enterprise](https://www.gumloop.com/enterprise), [Pricing](https://www.gumloop.com/pricing), [Connectors](https://www.gumloop.com/connectors), [Careers](https://www.gumloop.com/careers), [Marketing](https://www.gumloop.com/solutions/marketing), [Sales](https://www.gumloop.com/solutions/sales), [Operations](https://www.gumloop.com/solutions/operations), [Engineering](https://www.gumloop.com/solutions/engineering), [Support](https://www.gumloop.com/solutions/support), [Security](https://www.gumloop.com/solutions/security), [Data Agent](https://www.gumloop.com/use-cases/data-agent), [Meeting Prep](https://www.gumloop.com/use-cases/meeting-prep-agent), and [Support Agent](https://www.gumloop.com/use-cases/support-agent). Additional content-only sources are listed in the inventory.

### What it does well

**Layout.** The homepage begins with a restrained left-aligned title and a broad product demonstration below it. The product becomes the principal visual asset. Later sections alternate compact explanations, large interface panels, and grouped cards. The main solution pages use centered headlines, integration logos, and customer proof before more detailed explanations. This is a useful distinction: the homepage introduces the platform, while solution pages give one audience a focused entry point.

**Typography.** Gellix supplies a rounded, medium-weight display voice without relying on heavy bold. The homepage H1 is 48px/48px with -1.2px tracking in the captured desktop state. Marketing and several use-case heroes use 60px/60px. Geist Sans appears in UI panels and supporting content. Marketing headings and realistic application text therefore read as different layers of the same product.

**Color.** White and cool gray surfaces carry most of the page; near-black buttons are easy to identify. Small multicolor characters, application logos, and feature accents add personality. The multicolor treatment is concentrated, allowing the broader layout to stay quiet. A dark enterprise-controls chapter groups administration and security capabilities into one clear section.

**Spacing and white space.** The homepage uses approximately 40px outer gutters at 1440px, giving the demonstration plenty of horizontal room. Text blocks remain narrower than the full canvas. Large gaps separate capabilities, while spacing inside simulated chats, tables, and menus is compact. The site creates breathing room around dense product content instead of making every part of the content sparse.

**Navigation.** Solutions separates roles from use cases. Resources separates exploration, learning, and community links. The dropdowns form broad, readable columns with little ornamental chrome and blur the page underneath. Primary and secondary actions remain visible in the header. The same distinction appears in the signup modal: the entry choice is clear and the surrounding page recedes.

**Inner-page strengths.** Pricing is a comparison matrix rather than only a row of tall plan cards; it supports side-by-side evaluation. Enterprise pairs a headline and proof with a lead form. Careers introduces people and the working environment through photography. Connectors uses categories and search to organize a large catalogue, although its initial capture showed a loading skeleton. The Solutions and available use-case pages repeat a recognizable hero and trust sequence. Content fetches confirm that Templates, learning pages, partner directories, and the forum serve different browsing jobs; their visual details were not available in this browser run.

### Elements available to select

| ID | Element | Screenshot |
| --- | --- | --- |
| G1 | White canvas, restrained rounded sans, compact black actions | [Homepage](design-references/gumloop-home-desktop.png) |
| G2 | Actual-looking product demonstrations and explanatory panels | [Product section](design-references/gumloop-home-section-2.jpg) |
| G3 | Grouped, wide navigation menus | [Solutions](design-references/gumloop-nav-solutions.png), [Resources](design-references/gumloop-nav-resources.png) |
| G4 | Aligned feature-comparison matrix | [Pricing](design-references/gumloop-pricing-desktop.jpg) |
| G5 | A distinct dark chapter for controls and security | [Enterprise controls](design-references/gumloop-home-section-7.jpg) |
| G6 | Centered audience-specific hero and integration proof | [Marketing solution](design-references/gumloop-solutions-marketing-desktop.jpg) |

**Application note.** Its compact controls, neutral surfaces, realistic numbers, and comparison structure offer the closest references for HedgeMaker's application screens. The large demonstration panels could show a real protection quote or position, with accurate content and readable labels.

## Cloaked

Rendered sources: [Home](https://www.cloaked.com/), [Privacy Actions](https://www.cloaked.com/features/privacy-actions), [Opt Out Guides](https://www.cloaked.com/opt-out-guides). Content-only sources include [Pricing](https://www.cloaked.com/plans), [Features](https://www.cloaked.com/features), [Data Removal](https://www.cloaked.com/features/data-removal), [Trust](https://www.cloaked.com/trust), [Downloads](https://www.cloaked.com/downloads), [About](https://www.cloaked.com/about), and the other destinations in the inventory.

### What it does well

**Layout.** The desktop homepage places the message and action on the left and a rounded lifestyle video on the right. Thin grid lines frame both columns and the page edges. A darker problem chapter follows, then lighter solution and proof chapters. Privacy Actions follows a similar light introduction and dark problem sequence. The Opt Out Guides entry page adopts a quieter reading layout. These observed pages preserve the same brand voice while changing their information density.

**Typography.** Simula Book creates a recognizable serif display voice; STK Bureau Sans keeps navigation, explanatory text, and controls straightforward. The homepage H1 is 56px with a 61.6px line height and -1.12px tracking at the captured desktop width. This is less compressed than Auxia's headline. The combination makes a technical privacy product feel like a consumer service with a human audience.

**Color.** The sampled colors are warm cream `#FBF8EF`, a very dark brown `#130F02`, and orange `#FF550C`. Orange identifies primary actions and brand marks. Red appears in the threat chapter to emphasize risk. Cream backgrounds, slightly deeper warm card surfaces, and matching dark text share a consistent temperature. The dark chapters preserve that warm family.

**Spacing and white space.** The desktop page frame begins around 80px from each edge, giving a 1280px framed area. Hero text is inset further, beginning around 129px. The thin border structure supplies order without enclosing every block in a heavy card. Large rounded media fills one side of the hero, balancing the open reading area on the other. At mobile width, the lifestyle media moves above the headline and the main action stays visible in the header.

**Imagery.** People appear in everyday situations, with product notifications layered over the scene. The visual explains the benefit within normal life. Device frames and small UI overlays connect the imagery to an actual service. This is particularly relevant to the later mood board: we should establish subject, setting, lighting, color temperature, crop, and overlay behavior before sourcing or generating our own brand imagery.

**Navigation.** Features separates current products, recent releases, and upcoming products; Family Sharing is visibly disabled as coming soon in the observed desktop menu. Resources combines compact icon-and-description links with two larger editorial cards. About combines company links with a brand story and advocacy destination. The descriptions help someone who does not yet know the product terminology. Content fetches show a consistent purpose-first structure across feature pages, audience-based pricing, device-specific downloads, and separate research and blog collections. Those content observations do not establish the inner pages' visual layout.

### Elements available to select

| ID | Element | Screenshot |
| --- | --- | --- |
| C1 | Serif headlines with practical sans-serif supporting text | [Homepage](design-references/cloaked-home-desktop.png) |
| C2 | Warm cream, dark brown, and orange relationship | [Homepage](design-references/cloaked-home-desktop.png) |
| C3 | Everyday lifestyle media with product overlays | [Lifestyle hero](design-references/cloaked-home-desktop.png) |
| C4 | Fine framed grid and rounded media | [Homepage](design-references/cloaked-home-desktop.png) |
| C5 | Descriptive menu links and larger editorial cards | [Features](design-references/cloaked-nav-features.png), [Resources](design-references/cloaked-nav-resources.png) |
| C6 | Problem-to-solution sequence with a deliberate background change | [Privacy Actions](design-references/cloaked-features-privacy-actions-desktop.jpg) |

**Application note.** The consumer warmth and benefit-led imagery are useful for making currency protection understandable. We should write our own risk explanations precisely; their threat-driven messaging does not automatically fit a financial product.

## What the three have in common

1. **A strong hierarchy between message and detail.** Short display statements are much larger than body text. Smaller labels, controls, and demonstrations occupy a separate scale.
2. **Mostly neutral canvases.** Cream or white carries the majority of the page. Brand color is concentrated in actions, diagrams, selected panels, and important states.
3. **White space that separates ideas.** Large gaps distinguish chapters; tighter spacing groups a label with its explanation or related interface elements. The spacing is hierarchical rather than uniformly large.
4. **Stable alignment.** Headings, body text, proof, and calls to action follow clear page gutters. Cards can vary in size, but their internal elements follow recognizable rules.
5. **A visible product mechanism.** Auxia uses process diagrams, Gumloop uses interface demonstrations, and Cloaked uses device views and notifications. The visuals help explain what happens when someone uses the service.
6. **A clear next action.** The header repeats a recognizable primary action. A lower-commitment path appears nearby, such as learning about the product or contacting the company.
7. **Proof integrated into the story.** Customer logos, testimonials, and scale indicators appear as designed sections. These are the companies' marketing claims, not independently verified claims in this report.
8. **Rounded surfaces with a role.** Media, contained interfaces, forms, and buttons receive intentional shapes. The overall page still has a grid and typography-led structure.
9. **Deliberate light/dark chapters.** All three observed homepages use background changes to group a subject or change tone. This is part of their section composition, even though a generic skill may discourage arbitrary dark inserts.
10. **Variation within a consistent brand.** Not every hero is centered or left-aligned. Not every page needs the same density or image treatment. The consistent pieces are the type relationships, palette, gutters, and recurring component rules.

Their fonts and colors are different. A common underlying principle is confident typography, clear hierarchy, and useful imagery surrounded by enough space to read it.

## Decisions for the later design.md

Use the selection IDs above to identify the elements to borrow. Selections are references, not three separate themes to paste together. We will reconcile them into one system after the user chooses.

| Decision | Information still to establish |
| --- | --- |
| Primary visual voice | Which site's overall character should lead, and which elements are supporting references |
| Typography | Display direction, supporting sans, numerical scale for trading screens, font licensing and available alternatives |
| Palette | Neutral temperature, brand accent, dark surfaces, semantic profit/loss/error colors |
| Layout | Marketing page composition, navigation complexity, content widths, application density |
| Component rules | Buttons, fields, tables, radii, borders, cards, loading and error states |
| Imagery | User's mood board; people or objects; environments; lighting; crops; tone; original visual assets |
| Motion | Useful transitions and demonstrations; reduced-motion behavior; avoid copying unmeasured timings |
| Existing product constraints | Preserve routes, financial calculations, auth, wallet interactions, quote review, and working user flows |

The redesign should keep generous marketing compositions separate from the tighter quote, market, wallet, and positions interfaces. References determine the visual direction; the product's tasks determine information density.

No frontend implementation or final brand choices were made in this phase.
