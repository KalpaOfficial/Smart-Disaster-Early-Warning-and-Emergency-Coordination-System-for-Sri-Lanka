# UC04 implementation and test review

Implemented as **DMC dashboard → Post-event reports**. The existing ground Reports tab remains the UC02 verification queue. Citizen, volunteer and district officer accounts cannot access UC04 services or the reporting UI.

## Implemented flow

1. Select a persisted closed hazard event, including its districts, start date and recorded closure time. Legacy events without a closure timestamp are explicitly identified.
2. Choose one or more of the four metrics and optional date/district filters.
3. Generate and persist a report using UC01 warning outcomes, event-associated shelter headcount history and UC03 distribution records.
4. Review charts and exact tabular/text values. Empty metrics show zero; an entirely empty selection does not create a report. Source failures produce an explicit partial report, and pending source queries time out after 15 seconds.
5. Refine filters and regenerate, or retrieve an earlier saved report.
6. Generate real PDF/CSV bytes, persist the export under the report and download it on web or open the native file share sheet. Export failures retain the on-screen report.
7. Register/select a donor organisation, download the export, open an email addressed to that donor, and record the officer's sharing confirmation. Audit history records organisation/contact, format, report/event, officer and timestamp. Incomplete reports cannot be distributed until regenerated; this is checked against the persisted report as well as in the UI.

The PDF import explicitly selects `jspdf/dist/jspdf.es.min.js`. Importing the package root caused Metro's server renderer to choose the Node bundle, which contains an AMD-style `require` Metro cannot transform. Both browser and server bundling were checked after this correction. Jest uses the actual Node PDF build for its Node environment.

## Data interpretation

- Alert counts and chronological warning entries come from the selected event's persisted warnings. Pending dispatches and cancelled warnings are excluded. Calendar date filters include the whole selected Sri Lankan day (UTC+05:30), and shelter observations are grouped by the same local calendar day. Explicit timestamp filters retain their supplied offset.
- Recipient-level delivery receipts and acknowledgements are absent from current UC01 records. Reach is explicitly labelled **estimated recipient exposures**, using the largest delivered channel count per warning, summed across warnings. It is not a unique-person count. Multi-district warnings retain their complete recorded delivery count, and the screen/export explains this limitation. Provider outcomes currently come from the existing UC01 demonstration adapters.
- Shelter series use recorded headcounts, retain the last observed count for each shelter within the selected range, and show daily closing observations. Peak values use the observed sequence and registered capacities. Missing days/readings are not invented. New UC03 occupancy writes include event and district tags so history survives shelter reassignment. Older untagged history uses the shelter's current event association; it cannot reliably identify an earlier event after reassignment.
- Distribution tables retain item and unit, including tents. The UI/export do not present a sum of incompatible quantities such as litres and packs as a meaningful package total.
- PDF uses the standard Latin font supplied by jsPDF. CSV preserves UTF-8 text. Sinhala/Tamil PDF text shaping and an embedded font need a separate font integration before claiming full multilingual PDF support.

## Donor sharing and backend requirements

Sharing is user-mediated: attach the downloaded file in the email/share application, send it, then select **Record that I shared this report**. The audit stores `SHARED`, not an automatically confirmed `SENT`. This implementation has no email provider or delivery receipt integration, so it cannot guarantee recipient delivery. It does not send email automatically from the test sessions.

The deployed `firestore.rules` allow DMC-only access to `donorOrganisations` and `postEventReports/{reportId}/exports/{format}`. **Deployment and an exact live ruleset read-back were verified on 2026-10-12. Rules have not been emulator-tested.** All service tests use a local Firestore adapter; browser checks use fixture data and perform no live report, donor or audit writes.

Exports are retained as base64 artifacts in separate Firestore documents, capped at 800,000 characters to stay below the document limit. The internal `report-export:` reference identifies the persisted artifact; it is not a public URL. Large exports require narrower filters. Native saving uses a cache file and the OS share sheet, not a fabricated remote storage URL.

## Validation

### Deployment completed (2026-10-12)

Added `firebase.json` pointing at `firestore.rules` and `.firebaserc` selecting the app's configured project, `disaster-warning-sri-lanka-sli`. After the administrator completed Firebase login, Firebase CLI 15.33.0 compiled and deployed the rules successfully. Only Firestore rules were deployed; no hosting, indexes or application data were deployed. Firebase debug logs are ignored by Git.

The active `cloud.firestore` release was then read back through the Firebase Rules API. Its source matches the local `firestore.rules` byte for byte:

- Ruleset: `a33e20fb-1a4c-4852-8dfd-a8301be577da`.
- SHA-256: `4a728889c436b73354395986e19f8242ebb3d7caf3723fe2d45e64aab356d566`.
- Verified: **2026-10-12, 09:39 Asia/Colombo**.

This deploy publishes the complete reviewed local rules file, including its earlier UC01/UC02/UC03 access restrictions and the new UC04 paths. Compilation and read-back verification confirm what is published; they do not substitute for emulator permission tests.

Run the following in your own terminal, signing in with an account permitted to deploy this project's rules:

```sh
npx --yes firebase-tools login
```

The successful deployment command was:

```sh
npx --yes firebase-tools deploy --only firestore:rules --project disaster-warning-sri-lanka-sli
```

- UC04: **14 suites / 57 tests passing**.
- Full application: **66 suites / 573 tests passing**.
- TypeScript and repository-wide ESLint pass.
- UC04 coverage: **99.28% statements, 91.83% branches, 95.38% functions, 99.22% lines**. Every selected UC04 service/utility file exceeds 80% in all four metrics.
- Default coverage: **97.60% statements, 92.55% branches, 95.45% functions, 98.30% lines**. Every selected file exceeds 80% in all four metrics.
- Real Metro-loaded screen fixtures checked event selection, generation, filter refinement, saved retrieval and PDF download at widths 320/390/430, without horizontal page overflow or page runtime errors.
- Android/iOS file creation and share-sheet calls are mocked in Jest. Physical device confirmation is still required. Tests check real PDF headers, report content, multi-page output, durable export retrieval, CSV quoting/formula protection, role restrictions, persisted closed-state checks, filtering, incomplete-source handling, actual query timeouts, donor validation and audit identity.

Commands:

```sh
npm run test:uc04
npm run test:uc04:coverage
npm run test:coverage -- --runInBand
npm run typecheck
npm run lint
```

Coverage HTML: `coverage/uc04/lcov-report/index.html`.

### Date selection and export presentation update (12 October 2026)

- Optional dates now use a light calendar bottom sheet with month navigation, selected-day feedback, Today and Clear date actions. Saved criteria remain ISO dates.
- Donor registration uses the shared light bottom sheet and readable input labels.
- CSV exports have descriptive column headings, readable Sri Lanka dates, explicit district names and separate numeric values/units. CSV preserves data, not Excel colours or column widths; quoting and formula protection remain enabled.
- PDF exports have a blue event header, summary cards, section tables, wrapped text, continuation headers and numbered footers. Long records continue onto subsequent pages.
- Presentation update run: **13 suites / 46 tests passed**. TypeScript and ESLint on changed files passed. Browser fixtures checked calendar selection/clear, donor registration layout and exports at 320/390/430 pixels. The exported two-page PDF was rendered with Windows PDF APIs and visually inspected. The validation figures above now include the subsequent complete flow audit below.

### Complete flow audit against `../guide.md` UC04 (12 October 2026)

| Requirement | Result |
| --- | --- |
| Closed event selection and district/date coverage | Implemented; closure timestamp now exposed, legacy missing dates explicitly labelled |
| Four selectable metrics, date/district validation, persistence | Implemented and tested; local-day boundary bug corrected |
| Charts, summaries, retrieval and filter refinement | Implemented; saved configurations can now populate a new report request |
| PDF/CSV export, retained report on export failure | Implemented; export document and parent link now commit atomically |
| Donor selection, recipient/format/time audit | Implemented through officer-mediated email/share workflow; no automatic delivery receipt |
| No records, timeout, source unavailable, active-event rejection | Tested; incomplete reports are now blocked from donor sharing by both UI and persisted service checks |

Regression coverage now includes every reporting operation for citizen/volunteer/district roles, an event changing status during aggregation, both Sri Lankan date boundaries, local-day shelter grouping, missing/invalid/oversized exports, failed export replacement and incomplete report sharing. Browser fixtures additionally verified calendar selection and clearing, organisation registration, sharing history, restoring saved date/district filters, and the disabled sharing control for incomplete reports. No live application records were created in these checks.

Remaining integration limits are unchanged: current UC01 records support estimated recipient exposures rather than unique citizens/acknowledgements; email delivery requires the officer's email/share application; physical-device sharing and Firestore emulator permission tests remain unverified. The guide's donor delivery step is therefore supported by manual sharing, not an automatically verified delivery service.
