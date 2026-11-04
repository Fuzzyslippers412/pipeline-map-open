# Institutional studies: audit and content architecture

## Baseline

Door Notes version 29 uses Astro 5 with static profession pages and a small Worker for optional source discovery. Its 22 dossiers contain 166 historical episodes and 54 reviewed workplace records. The existing trace preserves a reader's title and workplace, distinguishes institutional evidence from a personal hiring route, and shows gaps. Preserve these records, source URLs, IDs, canonical routes, matching behavior, light paper design and public code/data release.

Reusable pieces include `Layout`, `FieldHistory`, `PersonalTrace`, the workplace directory, credential records, source disclosures and the career/activity guides. The current evidence schema covers historical actions well but has no consistent cross-country comparison, institutional relationship, ownership distinction or reading-level model. A long career page also needs a separate, focused study route rather than another uninterrupted column of text.

## Implementation

The medicine pilot lives at `/systems/physician/`, linked from the existing physician page, home, explorer and a discovery index. The original physician history and trace stay at `/p/physician/`. A shared seven-section template supports origins, builders/finance, exclusion, change, authority, ownership and possible routes. A study may contain both countries without assuming the same legal or institutional structure.

`data/institutions/medicine.json` contains reviewed sources, claim records, comparison rows, relationship records and additional milestones. Each claim has an evidence classification, historical period, source IDs, a limit, and short young/teen reading versions of the same fact. Each source records its publisher, actual publication date when known, reviewed date, type and locator. Source IDs must resolve; questions cannot masquerade as facts. Funding links are project-specific unless broader evidence supports them.

The map shows one sourced relationship at a time, with a textual equivalent on small screens and for assistive technology. Money, authority and care are distinct categories. Interactive controls progressively enhance readable HTML. No age, account or personal history is collected. A reading-mode URL carries only a presentation preference.

Discovery filters describe the records actually available: sector, period, country, credential evidence, institutions and ownership. They are not a catalog of all qualifications or opportunities in a profession. The U.S.–Cameroon institutional comparison is a medicine pilot; unreviewed countries and professions are not represented as completed studies.

## Acceptance and expansion

Validate source references, evidence labels, distinct countries, relationship scopes, seven sections, preserved old history, reading modes, mobile layouts, keyboard controls and filter reset/empty states. Explain current requirements as dated educational summaries, with the responsible authority and verification limits, rather than a personalized licensing or business plan.

After the medicine template is reviewed, expand one field at a time with its own financing, governance and ownership evidence. Existing researched career histories stay available while those system studies remain unreviewed. Reader comprehension sessions and independent subject-expert review remain future work; software checks are not evidence those studies happened.
