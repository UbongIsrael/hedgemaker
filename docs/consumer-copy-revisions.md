# HedgeMaker copy refinements — approval review

Status: **Approved and implemented.** Branch: `copy/consumer-facing`.

These revisions make the customer situations neutral, remove matching mechanics from the home introduction, and simplify the footer. “Build your USD/NGN protection.” stays unchanged as requested.

| ID | Location | Current copy | Approved copy |
| --- | --- | --- | --- |
| R01 | Market situation option and review heading (`src/pages/MarketPage.tsx:106,135`); How it works buyer heading (`src/pages/LearnPage.tsx:15`); sample position purpose (`src/demo/fixtures.ts:50`), also displayed in Positions | I need dollars later | Buying dollars later |
| R02 | Market situation option and review heading (`src/pages/MarketPage.tsx:106,136`); How it works seller heading (`src/pages/LearnPage.tsx:19`); sample order purpose (`src/demo/fixtures.ts:68`), also displayed in Overview | I earn dollars | Selling dollars later |
| R03 | Home, Choose your goal (`src/pages/LandingPage.tsx:114`) | Need dollars later, or earn dollars? Choose the option that fits your plans. | Buying or selling dollars later? Choose the option that fits your plans. |
| R04 | Home introduction (`src/pages/LandingPage.tsx:34`) | Explore how to plan for changes in the dollar-to-naira rate. Choose an end date and preview the test USDC needed to back your hedge. Protection would begin once your order matches with someone taking the other side. | Plan ahead for changes in the dollar-to-naira rate. Choose a date and explore protection for future dollar purchases or sales. |
| R05 | Shared footer (`src/app/AppShell.tsx:103`) | Explore protection against changes in the dollar–naira exchange rate. Payouts depend on the funds backing each position. | Explore protection against changes in the dollar–naira exchange rate. |

“Buying dollars later” and “Selling dollars later” describe a customer's plans, whether they are an individual or an organisation. The situation control keeps its existing “Choose your situation” label. The wording does not promise that HedgeMaker exchanges or delivers currency.

The funding limit matters, but it does not need to be repeated in the brand footer: it already appears in the home footnote, the market disclosures, and the Risks page, which remains linked in the footer. “Protection is based on capital” does not clearly communicate that insufficient capital can reduce payouts. If a footer limitation is preferred, the accurate concise alternative is “Protection is limited by the capital set aside.” This alternative is for discussion; R05 is the recommended revision.

These refinements change wording only. Existing demo notices, no-conversion disclosures, financial-risk explanations, and order-matching behavior remain intact.

Verification: approved R01–R05 replacements checked; `npm run lint`, `npm run build`, and `git diff --check` passed.
