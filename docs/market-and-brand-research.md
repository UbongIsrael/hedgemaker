# HedgeMaker: market expansion and brand positioning

Research date: 5 October 2026. Prepared from primary public sources and the current project documents and contracts. Recommendations are strategic judgments, not findings that any additional market is ready to launch. No frontend copy has been changed for this report.

## Recommendation

Keep Nigeria as the first market. Position HedgeMaker around currency risk, with Nigerian origin and a clear USD/NGN starting point. Build credibility in that first market before opening another order book.

The strongest positioning is a Nigerian-built product working toward broader currency-hedging infrastructure. The consumer experience should explain what people can do today; the company and developer narrative can explain what is being built for tomorrow. HedgeMaker already has a name that accommodates both.

Investigate Ghana and Kenya next. Treat Uganda as a subsequent discovery candidate, and Pakistan as a parallel research opportunity following its 2026 regulatory changes. Keep the remaining candidates conditional. This screen covers **12 potential expansion markets, plus Nigeria**; it does not establish 12 feasible integrations or an exhaustive global market count.

## What makes Nigeria a reasonable starting point?

Three arguments are credible: founder proximity to users and the problem; exposure to the dollar through future payments and receipts; and a published daily exchange-rate reference. CBN explicitly identifies its NFEM rate as a volume-weighted daily official rate, distinct from the closing and simple-average fields. That gives the project a specific candidate benchmark. It does not establish a licensed, reliable production data integration. [CBN NFEM rates](https://www.cbn.gov.ng/rates/ExchRateByCurrency.html).

The historical risk is real, but marketing should not predict perpetual depreciation. The IMF's 2026 Nigeria analysis describes major depreciation after the 2023 reforms and more recent improvements in exchange-market functioning and stability. A useful hedge addresses uncertainty in either direction. [IMF Nigeria analysis](https://www.elibrary.imf.org/view/journals/002/2026/126/article-A001-en.xml).

The unmet-access argument still needs evidence. The repository's `docs/evidence/market-access.md` records founder-reported barriers to bank/FMDQ products, with provider, sample, date and exact barrier records pending. FMDQ already offers cleared naira-settled non-deliverable forwards. Therefore, “Nigeria has no hedging” would be inaccurate; “our intended users need a more practical way to hedge” is a hypothesis to validate. [FMDQ products](https://fmdqgroup.com/exchange/otc-derivatives/).

The same distinction matters globally. TCX lists hedging across a large set of frontier currencies, through a different institutional offering. Frontier-currency hedging already exists. HedgeMaker's prospective advantage lies in access, distribution, suitable contract sizes, usability and integration—not merely listing a currency that others cannot hedge. [TCX currency coverage](https://www.tcxfund.com/currencies/).

## The market-selection checklist

I reconstructed this checklist from the project's design and evidence gaps. It is a proposed decision framework, rather than a claim that the repository already contains a completed country assessment.

| Criterion | Evidence needed before committing to a market |
| --- | --- |
| Recurring dollar exposure | Identifiable users with future dollar payments or receipts, amounts, dates and repeated need; population and remittance totals alone are insufficient. |
| An access problem we can improve | Actual comparable provider quotes, minimum sizes, eligibility, collateral, fees and onboarding times for the intended users. Include counterexamples. |
| A usable reference rate | Exact field and methodology; economic relevance; history and licensing; publication time, holidays, revisions and failure handling. |
| Permission for the specific product | Local treatment of derivatives, offering and distribution, stablecoin collateral and settlement, customer eligibility and cross-border activity. A VASP framework alone does not authorize an FX derivative. |
| Practical funding and withdrawal | Lawful on/off ramps, total conversion costs, USDC availability, withdrawal reliability and the effect of stablecoin deviations from USD. |
| Sustainable risk terms | Historical daily moves and discontinuous shocks; affordable collateral and top-ups; credible default, early-close and oracle-failure outcomes. |
| Compatible demand on both sides | Dollar buyers and sellers interested in overlapping amounts, prices and maturities. Country-level imports and exports do not prove matching liquidity. |
| A viable distribution and business model | Reachable cohorts or partners; actual acquisition and service costs; revenue after data, sponsorship, support and compliance costs. |

Legal permission, funding feasibility and a suitable reference are gates. Strong demand cannot compensate for failing them. A daily published rate is a promising research starting point, not an integration approval.

## Twelve expansion candidates

The tiers below indicate where to spend research effort. They are not forecasts of market size, comparative customer surveys, legal clearances or launch dates. All twelve still lack product-specific customer and liquidity validation in this research.

| Market | Primary-source finding | Recommendation and unresolved issue |
| --- | --- | --- |
| **Ghana — USD/GHS** | BoG publishes a transaction-based **weighted median** daily closing reference. Its virtual-asset page describes the 2025 VASP Act and registration/licensing requirements. [Rates](https://www.bog.gov.gh/treasury-and-the-markets/daily-interbank-fx-rates/), [framework](https://www.bog.gov.gh/virtual-assets/). | **Next discovery candidate.** Offers a useful test of the same product concept in another West African currency. Confirm the specific derivative route, funding partners and two-sided demand. Do not copy Nigeria's averaging methodology. |
| **Kenya — USD/KES** | CBK publishes indicative daily FX rates and surveys formal remittance flows. A March 2026 notice invited comment on VASP regulations under the 2025 Act. [Rates](https://www.centralbank.go.ke/rates/forex-exchange-rates/), [remittances](https://www.centralbank.go.ke/diaspora-remittances/), [notice](https://www.centralbank.go.ke/wp-content/uploads/2026/03/Public-Notice-Draft-Virtual-Asset-Service-Providers-Regulations-2026.pdf). | **Next discovery candidate.** Investigate a financial-product distribution route and benchmark suitability. Verify final regulatory implementation and product permissions; remittance activity does not prove demand for a funded hedge. |
| **Uganda — USD/UGX** | BoU describes daily indicative rates and historical data. Stanbic advertises FX risk-management services, so alternatives exist. [BoU rates](https://bou.or.ug/interest_rates_exchange_rates), [Stanbic](https://www.stanbicbank.co.ug/uganda/corporate/products-and-services/global-markets/Foreign-Exchange). | **Subsequent discovery.** Validate an access gap and a distribution partner before engineering work. Exact benchmark construction and the stablecoin/derivative route remain unresolved. |
| **Pakistan — USD/PKR** | SBP publishes customer FX rates. Its 14 April 2026 circular replaced the earlier banking restriction with conditional account access for licensed VASPs; FX obligations remain applicable. [Rates](https://www.sbp.org.pk/economic-data/weighted-average-customer-exchange-rates), [2026 circular](https://archive.sbp.org.pk/bprd/2026/CL10.htm). | **Parallel research candidate.** The change merits attention. Determine which rate would serve as fixing and whether a licensed partner can support this specific product. Do not rely on obsolete descriptions of a blanket banking ban. |
| **Zambia — USD/ZMW** | BoZ lists several exchange-rate series. IMF staff in January 2026 raised representativeness concerns about the official rate used for mining/customs taxes. [BoZ rates](https://www.boz.zm/markets-securities/boz-exchange-rates), [IMF statement](https://www.elibrary.imf.org/abstract/journals/002/2026/021/article-A003-en.xml). | **Conditional watchlist.** Resolve the exact series and how closely it tracks users' achievable exchange rates before calling it suitable. This finding does not establish that every BoZ series is unsuitable. |
| **Tanzania — USD/TZS** | BoT publishes buying, selling and mean rates and issued a 2025 notice on domestic use of foreign currencies. [Rates](https://www.bot.go.tz/ExchangeRate/excRates?lang=en), [notice](https://bot.go.tz/Adverts/PressRelease/en/2025050221310087.pdf). | **Conditional watchlist.** Check current FX rules, including later amendments, and stablecoin/derivative permissions. Domestic payment restrictions should not be interpreted as a general hedging ban. |
| **Vietnam — USD/VND** | IMF's 2025 analysis describes a managed exchange-rate band. Vietcombank advertises VND FX forwards to businesses. [IMF](https://www.elibrary.imf.org/view/journals/002/2025/283/article-A001-en.xml), [bank forwards](https://vietcombank.com.vn/en/To-Chuc/Doanh-Nghi%E1%BB%87p/Gi%E1%BA%A3i-ph%C3%A1p/KHTC---Ngoai-hoi-va-Thi-truong-von/KHTC---Giao-dich-ngoai-te-ky-han). | **Later, conditional discovery.** Existing bank offerings require a specific access thesis. A production fixing source was not validated here; distinguish the policy reference from actual trading rates and establish the legal funding route. |
| **Egypt — USD/EGP** | CBE publishes FX statistics and its 2022/2023 warnings describe restrictive treatment of cryptocurrency activities. [Rates](https://cbe.org.eg/en/economic-research/statistics/cbe-exchange-rates), [2023 warning](https://www.cbe.org.eg/en/news-publications/news/2023/03/08/warning-statement). | **Hold for the current USDC design.** A usable economic exposure is not enough. Reassess current law and whether a permitted partner/product structure exists before pursuing residents. |
| **Bangladesh — USD/BDT** | BB publishes a transaction-weighted reference with distinct morning and afternoon observations. Its September 2022 circular prohibits obtaining virtual assets and facilitating associated exchange/transfer/trading. [Reference](https://www.bb.org.bd/en/index.php/econdata/rfrexrate), [circular](https://www.bb.org.bd/mediaroom/circulars/fepd/sep152022fepd24e.pdf). | **Hold for the current USDC design.** Attractive reference data does not overcome the legal funding obstacle. Check for superseding rules before any commitment. |
| **Indonesia — USD/IDR** | BI's JISDOR is based on actual interbank transactions, with published methodology and fallback rules. Indonesia already has a domestic NDF framework. [JISDOR](https://www.bi.go.id/en/fungsi-utama/moneter/informasi-kurs/default.aspx), [DNDF regulation](https://www.bi.go.id/en/publikasi/peraturan/Pages/PBI_220220.aspx). | **Later differentiation test.** The reference is promising, but existing infrastructure raises the bar. Find a specific user/distribution advantage and establish permissible delivery. |
| **Argentina — USD/ARS** | A3 lists dollar futures quoted and settled in pesos, in USD 1,000 contracts. BCRA announced a revised A3500 reference methodology effective January 2026. [A3 product](https://a3mercados.com.ar/productos/futuros-y-opciones/monedas/dolar), [BCRA change](https://www.bcra.gob.ar/noticias/con-el-aporte-de-los-principales-actores-del-mercado-el-bcra-aprobo-una-nueva-metodologia-para-el-calculo-del-tipo-de-cambio-de-referencia-a-3500/). | **Later differentiation test.** High currency risk does not imply absent competition. Identify a genuinely better route for a defined cohort and distinguish reference-rate exposure from other dollar exchange channels. |
| **South Africa — USD/ZAR** | JSE offers currency futures for businesses and individuals; its comparison describes standard USD 1,000 contracts. [Currency futures](https://www.jse.co.za/trade/derivitive-market/currency-derivatives-market/currency-futures), [contract comparison](https://www.jse.co.za/trade/derivitive-market/currency-derivatives-market/maxi-currency-futures). | **Competitive benchmark, lower initial priority.** Useful for measuring whether HedgeMaker improves the experience or integration enough to justify switching. A blanket claim that individuals lack hedging access would be wrong. |

This is deliberately a research shortlist, not a ranked list of national economies. I did not estimate addressable revenue, run comparable country volatility backtests, obtain provider quotes or establish customer willingness to pay. Those missing inputs could change the order. The geographic preference assumes the Nigerian team can investigate and distribute in nearby African markets more effectively; an actual partner elsewhere could outweigh that assumption.

## Why Ghana and Kenya first?

Ghana provides an adjacent expansion experiment with a documented transaction-based reference. Importantly, its risk is not simply “the currency always weakens”: the IMF's 2026 analysis discusses substantial cedi appreciation and implications for exporters. That supports a broader, two-direction product story. It does not establish matched demand. [IMF Ghana review](https://www.imf.org/en/news/articles/2026/07/27/pr25260-ghana-imf-exec-board-completes-6th-rev-arr-ecf-concludes-2026-aiv-consult-rev-req-36mo-pci).

Kenya provides a different distribution experiment, including a formal remittance ecosystem documented by CBK. Its opportunity must be tested with providers and users. The CBK's 2025 household survey also reported limited recipient ownership of crypto accounts, so widespread remittance activity should not be treated as evidence that USDC onboarding will be easy. [CBK household survey](https://www.centralbank.go.ke/wp-content/uploads/2026/06/2025-Remittances-Household-Survey-Report.pdf).

Investigate both; launch only the one that passes the gates and has better partner-led demand. A promising country does not justify opening several thin markets at once.

## Brand, marketing and Nigerian identity

Keep the corporate promise about currency risk. Put the specific currency pair in the market page, product selection and acquisition campaign. Establish Nigerian origin through the founder story, team, real customer stories and design choices. Avoid making the national flag or “Naira” the defining scope of the master brand.

| Surface | Recommended message or approach |
| --- | --- |
| Consumer brand headline | **Currency risk. More control.** |
| Supporting copy for the current preview | **Explore a new way to manage exchange-rate risk, starting with USD/NGN.** Keep the testnet/demo status visible. |
| Origin and ambition | **Built in Nigeria. Building for more markets.** This communicates origin and intent without suggesting other markets are available. |
| USD/NGN market page | **Manage your naira–dollar exchange-rate risk.** Keep pair-specific information and explanations here. |
| Partner/developer narrative | **We’re building currency-hedging infrastructure, starting with USD/NGN.** Present the SDK/API as a preview or plan unless that capability is actually available. |
| Future market page pattern | `/markets/usd-ngn`, then `/markets/usd-ghs` or `/markets/usd-kes` when ready. Use local examples and currency details on each page. |
| Navigation and availability | “Markets”, “How it works”, and a separate developer/partner route. Label future countries “Under consideration” or “Register interest”; use “Coming soon” only with a committed delivery plan. |

These are proposals for a subsequent copy review, not approved edits. The existing “Build your USD/NGN protection” line remains untouched, as requested.

Run Nigeria-specific acquisition now: relevant search terms, naira–dollar education, locally meaningful examples and focused partner outreach. A Ghanaian or Kenyan visitor should still understand the company’s broader purpose and see accurate current availability. There is no need to make a Nigerian acquisition campaign generic simply because the company has an international ambition.

Use neutral goals such as “Buying dollars later” and “Selling dollars later”, then adapt examples to the user’s currency and intent. Those goal labels must not imply that the hedge delivers dollars. The current design is a cash-settled contract with USDC settlement; buying the required currency remains a separate transaction.

Explain material limits in ordinary language at the relevant decision point. “Protection is based on capital” can introduce the concept, but alone does not explain that payouts can fall short or positions can close early. Likewise, copy can explain activation simply while still showing a pending order accurately. Consumer-facing language should help people understand the commitment they are making.

Avoid claims such as “hedge any currency”, “guaranteed protection”, “instant protection” before a fill, or “the standard infrastructure” as an accomplished fact. State the standard-infrastructure idea as the mission. Being Nigerian-built does not imply Nigerian regulatory approval.

## Infrastructure implications

The current code has reusable components, but it is not already a complete simultaneous multi-currency system. `MarketConfig.sol` contains market IDs and configurable rates, margins and calendars, but one global active configuration version. `RateOracle.sol` scopes feed policies by configuration version. `PositionManager.sol` has immutable links to its configuration, oracle and vault. Frontend fixtures are also focused on USD/NGN.

The practical first expansion path is to assess isolated deployments for each validated market, reusing the common matching, collateral and settlement components. Each deployment needs its own reference feed, calendar, risk terms, operational controls and legal permissions. This is a recommendation for later architecture work, not a verified deployment procedure.

A later multi-market registry can expose a consistent API and user experience across those markets. Specify currencies, quote direction, rate scale, settlement asset, contract version, source methodology, holidays and availability explicitly. “USD/GHS” and “USD/NGN” should consistently mean local-currency units per dollar.

Start the infrastructure ambition with dollar-versus-local-currency pairs. General non-dollar cross-pairs require additional work on settlement-asset valuation, quote conventions and risk. The existing design does not establish that arbitrary pairs can be enabled by changing a label or one configuration value.

To become a standard, prioritize dependable settlement, auditable reference data, predictable integration contracts, risk transparency and partner adoption. The number of flags on the homepage is not evidence of infrastructure quality.

## Validation plan before choosing market two

1. **Validate the Nigeria access thesis.** Gather consented, anonymized user records and comparable bank/dealer/exchange access routes. Identify the barrier HedgeMaker actually improves. Compare against holding dollars or USDC in advance as well as other derivatives.
2. **Research Ghana and Kenya with the same interview structure.** A starting discovery sample could include 10–15 prospective dollar buyers and 10–15 sellers per country, plus several distribution providers. This is an exploratory sample, not a representative national survey. Record amounts, dates, current alternatives, acceptable costs and collateral willingness.
3. **Test the reference and economics in read-only shadow mode.** Establish data rights and ingestion. Compare the chosen fixing with real quotes available to target users. Stress historical shocks, delayed publication, stale observations, top-up failures, USDC deviations and early termination.
4. **Resolve the offering and funding route.** Obtain product-specific local advice and verify partner permissions. Consider who may participate and where they are located, not only where the protocol is deployed.
5. **Simulate a narrow market with honest liquidity.** Concentrate a cohort around a small set of maturities. Measure compatible order coverage, time to match, collateral burden and repeat interest. Use testnet or non-binding research until a real-value pilot is authorized and cleared.
6. **Choose one expansion using observed evidence.** Agree go/no-go targets before the pilot. Compare user benefit after all costs, matching reliability, funding friction and operation economics. Do not promise a date until the blockers are resolved.

Suggested measures are repeat participation, matched share of genuine hedge demand, time to activation, total cost including funding/collateral, top-up success, shortfalls, settlement reliability and partner integration effort. Set actual thresholds using pilot conditions; this report does not invent universally acceptable numbers.

## Evidence limits and decision record

Primary sources establish that benchmarks, competing products and certain regulatory instruments exist. The shortlist and positioning are my inferences from those facts and the project's constraints. They do not establish product-market fit, legal clearance, licensed data access, integrations, partnerships or future launch availability.

Some official sites served only search-indexed content or dynamically loaded pages. No production feed was connected, and no legal framework was treated as complete solely because an old warning or a consultation document was available. Dates matter: Kenya's cited document is a March 2026 draft notice; Egypt's warnings are from 2022/2023; Bangladesh's cited prohibition is from 2022; Pakistan's cited change is from April 2026. Verify subsequent instruments during country diligence.

The decision I recommend now is to retain HedgeMaker, establish a general currency-risk brand with Nigerian origin, keep USD/NGN as the first product and acquisition focus, and use Ghana/Kenya discovery to choose the first expansion. Leave the detailed claim of universal currency coverage for when the product can substantiate it.

## Copy implementation follow-up, 6 October 2026

Following the requested copy review, the frontend review branch applies the currency-risk positioning: “Currency risk. More control.” opens the hero, “Explore a new way to manage exchange-rate risk, starting with USD/NGN.” supports the existing tagline, and the footer states “Built in Nigeria. Building for more markets.” The shared market-maker introduction now begins with the currency-hedging infrastructure mission and immediately describes the current Monad testnet scope.

The existing market headline, routes, buyer/seller explanations, demo status, and risk disclosures remain. Additional-market availability and future SDK/API claims are not introduced. See [design.md](../design.md#market-and-brand-research-copy-direction) for the implementation decision and [the redesign review](redesign/README.md) for validation.
