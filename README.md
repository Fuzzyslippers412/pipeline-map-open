# Door Notes

[Door Notes](https://doornotes.org/) is a static, mobile-first guide to U.S. professional entry. A reader can search twenty professions, read sourced histories of people and decisions separately from population measurements, trace estimates to publisher tables and compare up to three fields.

The public source release is [available on GitHub](https://github.com/Fuzzyslippers412/pipeline-map-open). The application code and loaders use the [MIT License](LICENSE). Original editorial content and the project’s compilation use [CC BY 4.0](data/RIGHTS.md). Read the [data rights and publisher credits](data/RIGHTS.md) before reusing material from another publisher.

The [student explorer](https://doornotes.org/explore/) turns familiar activities and interests into five possible jobs with printable, shareable activity cards. The [IT career map](https://doornotes.org/career-map/) compares technical and people-management directions and prepares a question for a workplace conversation. Neither guide asks for an account. A shared activity link identifies only a public job; links into the IT guide carry only a public work category.

## Build locally

Use Node 22.23 or compatible, npm, and Python 3.12+. From a clean checkout run:

    npm ci
    npm run build
    npm run preview

The build validates five relational tables, writes a SQLite database and CSV, generates static Astro pages and renders share images. It reads committed derived data and needs no source-publisher network access. The output is in dist/. For an alternate host, change the site origin in astro.config.mjs and rebuild so all social URLs are absolute.

## Finding a workplace and job title

The trace form suggests exact worksites and job titles after two characters. It searches site-hosted directory snapshots in a Web Worker. Parent organizations, districts and systems are displayed only where identified by the source and are not substituted for the chosen employer in research. Keyboard or pointer selections are optional. Both fields accept the reader’s own words, including titles outside the profession index. A separate, explicitly requested federal-recipient search sends the workplace term to USAspending.

The trace form and profession index use the same occupation resolver. The local O*NET title directory retains multiple occupation codes for one spelling. Recognized titles can open a published record, point to a related field, ask a clarifying question about duties, or show the limits of historical coverage. Computing results include a credited historical record and a source specific to the work selected. Personal entries and decisions stay in the tab.

See [workplace directory sources](data/WORKPLACES.md) and [O*NET® job-title sources and attribution](data/JOB-TITLES.md).

## Career timelines

Entering a workplace and job title opens a three-part preview of the earliest sourced field opening in the record, the workplace connection, and the gaps. The full chronological trace and its citations expand below the preview. Field episodes come from the expanded dossiers in `data/history/`, compiled into `data/history-index.json`. The older timeline snapshots are retained as historical source material. Reviewed workplace relationships and documented awards are dated separately. A source's publication date or the index refresh date cannot stand in for the date of an event. Gaps and self-reported details have explicit labels. Source lookup adds qualifying records to the current trace and keeps unverified leads below it. Personal entries remain out of shared links and preview images.

The public workplace library at `/paths/` links directly to Atlanta teaching, Howard nursing and Chicago electrical work. Each public example uses published inputs. The two additional reading previews at `/preview/p/registered-nurse/` and `/preview/p/electrician/` show the fixed sample when opened with `?example=1`. Without that parameter, an existing personal trace stays in its tab. Their canonical records remain under `/p/`; fixed example images and copy links contain no personal inputs. The 1943 Freedmen’s photograph and its reuse information are documented in [the archive credits](data/ARCHIVE-ART.md).

## Workplace source search

Enter any workplace and a job title, then choose **Look up sources**. The same-origin research handler searches education, government awards, health literature and recent news, filters results against the role, and links to the originals. Results distinguish live lookups from matches in a dated public-record index. Unmapped titles can use the lookup directly on the landing page. A research lead is not an independently verified hiring or training history. See [the methodology](https://doornotes.org/method/#source-discovery).

The PM preview now separates the historical person and opportunity from the reader’s role and workplace. Broken connectors keep unproved links visible. Evidence labels distinguish Black access, a Black professional’s role, a job posting, a hiring process, funding and a lead. Readers can refine the workplace, copy the next research question or open a tab-local source suggestion draft; the draft is shown for review before any public submission.

Product, program and project manager traces search only after the reader taps **Search employer records**. The selected PM role is kept separate from other meanings of PM. Reviewed accounts name the employer and show what the original supports. Live job postings from the [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html) require both the board and posting company to match the workplace; a listing proves only that the role was advertised. A failed provider, a parent company, a job ad or a grant never closes the historical gap on its own.

Refresh the discovery index with `python3 loaders/build-discovery-index.py` when preparing a new research edition. It queries topics and programs across publishers without a roster of employer names.

Start the complete local UI and research endpoint with `npm run dev`. For a Worker deployment run `npm run build:hosted`, then serve the artifact with Wrangler using the checked-in configuration. The original `npm run build` remains a portable static export; a host serving only static files depends on the publisher's browser-access policy. The Worker uses no account keys or persistent data stores.

## Annual refresh

1. Create a branch and record the publisher editions, field definitions and license conditions. Keep raw survey records and association workbooks outside the repository.
2. Run python3 loaders/refresh_education.py to refresh BLS, AAMC and ABA. Use --strict-network when an online source check must succeed. Restricted endpoints retain documented reviewed aggregates and their prior verification dates. See loaders/EDUCATION-REFRESH.md.
3. Run python3 loaders/workforce.py eeo1990 --cache /tmp/doornotes-census --refresh and python3 loaders/workforce.py acs --cache /tmp/doornotes-census --refresh for the Census tabulations. Install Poppler for pdftotext when refreshing publisher PDF tables. The Census snapshots include source URLs, representation definitions and raw sample or weighted evidence. The historical population is a different series.
4. Run python3 loaders/supplement.py for DoD officer data. For a separately obtained, licensed Basic Monthly IPUMS CPS extract, run python3 loaders/workforce.py ipums --help for the explicit year/code mapping, weighting and citation inputs. An extract is optional. Do not commit microdata.
5. Run the regression checks, then npm run build. Review the data diff for definition changes and survey suppression. Check each new source row, both sex groups, the denominator and any missing years. Inspect the card, comparison and generated image. The final step is a reviewed release.
6. Run node scripts/burst.mjs to exercise the static artifact locally. Benchmark mobile with Lighthouse against a fresh preview. A local load benchmark does not establish the external CDN's capacity.

The editor reviews classifications separately from the data refresh. Each panel requires two institutional references and an editorial status. Definitions or occupation mappings cannot be extended across years without review.

## Release status

The research edition includes both source-supported and proposed editorial labels. Reviewer decisions, an authorized IPUMS extract, and source expansions belong in subsequent dated releases. No tracking identifiers or survey microdata are distributed.

Submit reader corrections through the [public correction form](https://github.com/Fuzzyslippers412/pipeline-map-corrections/issues/new?template=correction.yml).

## Historical records and homepage coverage

Every profession has a public historical record that renders without a stored trace. Dossiers separate actors, authority, action, outcome and source limits; the timeline API and career-map excerpts use the same records. Sources include a locator and evidence type, and the source register can filter historical records separately from statistical tables. `public/data/histories.json` is a reproducible export.

Homepage examples and profession tiles link directly to these records. Evidence disclosures work without JavaScript. No historical episode alone establishes a visitor’s personal training or hiring route. Exact workplace records, where present, retain their own scope and source.
