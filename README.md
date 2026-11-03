# Pipeline Map

Pipeline Map is a static, mobile-first guide to U.S. professional entry. A reader can search twenty professions, examine proposed institutional classifications separately from population measurements, trace estimates to publisher tables and compare up to three fields.

The public source release is [Fuzzyslippers412/pipeline-map-open](https://github.com/Fuzzyslippers412/pipeline-map-open). The application code and loaders use the [MIT License](LICENSE). Original editorial content and the project’s compilation use [CC BY 4.0](data/RIGHTS.md). Read the [data rights and publisher credits](data/RIGHTS.md) before reusing material from another publisher.

## Build locally

Use Node 22.23 or compatible, npm, and Python 3.12+. From a clean checkout run:

    npm ci
    npm run build
    npm run preview

The build validates five relational tables, writes a SQLite database and CSV, generates static Astro pages and renders share images. It reads committed derived data and needs no source-publisher network access. The output is in dist/. For an alternate host, change the site origin in astro.config.mjs and rebuild so all social URLs are absolute.

## Workplace source search

Enter any workplace and a job title, then choose **Look up sources**. The same-origin research handler sends an employer query to institutional publishers, filters the returned passages against the role, and links back to the originals. Unmapped titles can use the lookup directly on the landing page. A research lead is not an independently verified hiring or training history. See [the methodology](https://pipeline-map.fuzzyslipper.chatgpt.site/method/#source-discovery).

Start the complete local UI and research endpoint with `npm run dev`. For a Worker deployment run `npm run build:hosted`, then serve the artifact with Wrangler using the checked-in configuration. The original `npm run build` remains a portable static export; a host serving only static files depends on the publisher's browser-access policy. The Worker uses no account keys or persistent data stores.

## Annual refresh

1. Create a branch and record the publisher editions, field definitions and license conditions. Keep raw survey records and association workbooks outside the repository.
2. Run python3 loaders/refresh_education.py to refresh BLS, AAMC and ABA. Use --strict-network when an online source check must succeed. Restricted endpoints retain documented reviewed aggregates and their prior verification dates. See loaders/EDUCATION-REFRESH.md.
3. Run python3 loaders/workforce.py eeo1990 --cache /tmp/pipeline-map-census --refresh and python3 loaders/workforce.py acs --cache /tmp/pipeline-map-census --refresh for the Census tabulations. Install Poppler for pdftotext when refreshing publisher PDF tables. The Census snapshots include source URLs, representation definitions and raw sample or weighted evidence. The historical population is a different series.
4. Run python3 loaders/supplement.py for DoD officer data. For a separately obtained, licensed Basic Monthly IPUMS CPS extract, run python3 loaders/workforce.py ipums --help for the explicit year/code mapping, weighting and citation inputs. An extract is optional. Do not commit microdata.
5. Run the regression checks, then npm run build. Review the data diff for definition changes and survey suppression. Check each new source row, both sex groups, the denominator and any missing years. Inspect the card, comparison and generated image. The final step is a reviewed release.
6. Run node scripts/burst.mjs to exercise the static artifact locally. Benchmark mobile with Lighthouse against a fresh preview. A local load benchmark does not establish the external CDN's capacity.

The editor reviews classifications separately from the data refresh. Each panel requires two institutional references and an editorial status. Definitions or occupation mappings cannot be extended across years without review.

## Release status

The research edition includes both source-supported and proposed editorial labels. Reviewer decisions, an authorized IPUMS extract, and source expansions belong in subsequent dated releases. No tracking identifiers or survey microdata are distributed.

Reader corrections go to the public tracker at https://github.com/Fuzzyslippers412/pipeline-map-corrections/issues/new?template=correction.yml .
