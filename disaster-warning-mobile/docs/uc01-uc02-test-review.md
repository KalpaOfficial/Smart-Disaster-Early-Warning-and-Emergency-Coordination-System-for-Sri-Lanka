# UC01 and UC02 test review — 12 October 2026

## Delivery channel check — 12 October 2026

- App notification, SMS and emergency siren currently use the simulation functions in `services/deliveryService.ts`. No push provider, SMS gateway or physical siren integration is configured. Issued warnings use the existing Firestore feed to appear in community accounts; that is separate from OS push delivery.
- Added 13 regression tests covering every nonempty selection of the three channels, partial delivery for each channel, count conservation and empty resolved audiences with stale preview counts.
- Found and fixed a defect in all three channel functions: an empty recipient list previously fell back to the preview count and could report successful delivery to nonexistent recipients. Counts now come from the resolved list; empty audiences return a failed result with zero deliveries. The main warning pipeline already blocks zero recipients before saving a warning.
- Browser QA found missing checked-state semantics on web checkbox controls. Added `aria-checked` alongside native accessibility state and verified selection/deselection of each channel and validation when none is selected.
- Added explicit demo delivery wording to the composer and summary so simulated success is not mistaken for real delivery confirmation.
- Verification: **15 UC01 suites / 91 tests passed**, TypeScript and repository ESLint passed. Actual composer rendered and interacted with using service fixtures at 320, 390 and 430 px. Review-before-send, closed-event blocking, send errors and recipient lookup errors also passed. No live warning was dispatched.

The following sections record earlier review results; their historical counts are not the current channel-check totals.

Full regression after these fixes: **70 suites / 593 tests passed**. TypeScript and repository ESLint passed again after the web accessibility fix.

Reviewed against UC01 (Issue Hazard Warning) and UC02 (Submit and Verify Ground Report) in the supplied assignment document. The document was used as a requirements reference; the user's request was to check the implemented flows, improve tests and fix defects found during the review.

## Verification results

- Initial UC01/UC02 run: 25 suites, 185 passing tests.
- Latest UC01/UC02 run with coverage: **31 suites, 250 passing tests**.
- Latest full application regression run: **63 suites, 548 passing tests**.
- TypeScript passes. ESLint passes for all files changed in this review.
- Repository-wide ESLint still reports 11 existing errors in UC04 tests and `services/postEventReportService.ts` (unused imports and an explicit `any`). Those files were not changed by this review.
- Coverage across the 15 production files explicitly selected by `jest.uc0102.config.js`: **87.53% lines, 86.17% statements, 74.61% branches, 80.66% functions**. This includes older service entry points, error paths and native/web image handling; it does not measure React screen coverage. Coverage is not a claim that every device or external integration has been verified.

### Photo coverage follow-up

The pasted default coverage run passed all 510 tests, but photo upload coverage was only 67.44% lines / 46.96% branches. Added 22 cases covering portrait/landscape resizing, small/zero dimensions, durable blob conversion, URL cleanup, FileReader failures and oversized fallback data, canvas failures, native upload/download failures and nonfatal deletion failures. Photo upload now reaches **97.77% lines, 97.93% statements, 94.82% branches and 100% functions**.

Two defects were fixed: asynchronous canvas errors could leave the upload promise pending, and the blob fallback omitted the size limit. Canvas errors now reject for retry, original and compressed output use the size limit, and preview object URLs are also released when source assignment fails. These are mocked browser/native service checks; physical device/provider verification remains necessary.

The default `npm run test:coverage -- --runInBand` run passes **532 tests** and reports **95.56% lines, 94.61% statements, 90.72% branches and 93.82% functions**. It selects different production files from `test:uc01-uc02:coverage`, so their overall percentages should not be compared as if they measured the same scope. Console warnings in intentionally failing test cases are expected; they are not failing assertions. Photo tests now assert relevant warning behavior and silence their expected warning output locally.

### Coverage above 80% for every file in the default report

Added 16 regression cases for unknown/null roles, legacy offline records, storage write failures, mixed successful/failed batches, reconnect behavior, retry timing and cancellation, failed network lookups, lost connectivity during a batch and isolation of failed progress listeners.

The latest default coverage run passes **63 suites / 548 tests**. Every individual file selected by `jest.config.js` is **strictly above 80% in all four metrics** (statements, branches, functions and lines). Overall coverage is **96.52% statements, 92.60% branches, 95.67% functions and 97.48% lines**. The previously low files now report:

| File | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| reportPermissions.ts | 100% | 100% | 100% | 100% |
| offlineQueueService.ts | 100% | 88.46% | 100% | 100% |
| offlineSyncManager.ts | 100% | 95.45% | 86.95% | 100% |

This assertion applies to the default report shown in the request, not every source file or the separately configured UC01/UC02 report. No production branches were excluded or removed to raise the percentages.

```sh
npm run test:uc01
npm run test:uc02
npm run test:uc01-uc02
npm run test:uc01-uc02:coverage
npm test -- --runInBand
npm run typecheck
```

The coverage HTML report is generated at `coverage/uc0102/lcov-report/index.html`.

## Defects reproduced and fixed

| Flow                         | Finding and correction                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DMC authority                | Warning creation and report review previously trusted caller-supplied officer information. The service now requires the authenticated UID to match the actor and reads the persisted DMC profile. Signed-out accounts, mismatched UIDs and other roles are refused.                                                                                                                   |
| Warning validation           | Missing enum checks allowed malformed severities, channels and areas through service calls. Shared production validation checks severity, target mode, configured areas, content, channels and event ID. Areas/channels are deduplicated.                                                                                                                                             |
| Event closure                | Warning creation now checks the event inside the same transaction that creates the warning. Report verification checks the selected event inside its decision transaction. Missing/closed events are refused, and persisted event titles are used.                                                                                                                                    |
| Follow-up warnings           | The service rejects a previous warning from another event, an unissued warning and a reduction of the previous severity. Equal severity remains supported for the existing Update Warning flow.                                                                                                                                                                                       |
| Delivery audit               | The pipeline previously swallowed log errors and returned before timeline attachment completed. Final status, channel logs and both timeline representations now commit together. A failed audit commit returns an explicit warning ID and a “Do not resend” message, rather than claiming success.                                                                                   |
| Audience resolution          | A database lookup failure previously looked like a successful zero-recipient result. It now raises an error that the composer can display. Public audience resolution includes citizens and volunteers and excludes officer profiles; the estimate is resolved again before persistence.                                                                                              |
| Warning dates                | ISO timestamp strings were replaced with the current time or dropped. Reads now preserve both ISO strings and Firestore timestamps, including dispatch/update dates.                                                                                                                                                                                                                  |
| Report validation and photos | Required-field validation now also runs at the persistence boundary. Capture timestamps are checked. Photo size checks count both the cover and gallery copies, preventing an otherwise accepted payload from exceeding the Firestore document limit. Oversized evidence is refused instead of silently dropping the cover photo.                                                     |
| Report lifecycle             | Verified/rejected reports could be overwritten and two concurrent officer decisions could both succeed. Decisions now read the current state in a transaction; terminal states are protected and only one competing final decision can commit. Linked verification and its event timeline commit together.                                                                            |
| Clarification                | Replies previously lacked ownership/state checks. Only the original submitter can reply to an outstanding information request. Empty rejection reasons, request messages and replies are rejected. Information requests also record the officer decision timestamp.                                                                                                                   |
| Repeated notifications       | Seen state previously used only the status, so a second information request could stay hidden. Notifications/read acknowledgements now identify the decision timestamp as well as the status. Opening another user's report no longer marks it read as if it belonged to the current user. Existing status-only acknowledgements may produce one notification again during migration. |
| Offline synchronization      | The concurrency flag was set after asynchronous reads, allowing duplicate batches; unexpected exceptions could leave it stuck. The lock now covers the initial network/storage checks and is released in `finally`. Background calls handle rejected promises. Failed queued submissions remain available for retry.                                                                  |
| Web photo failure            | Expired blob URLs previously produced fabricated JPEG bytes. They now fail without inventing evidence. Unreadable images are rejected, while valid web evidence is compressed into durable data URLs.                                                                                                                                                                                 |
| Local Firestore policy       | A submitter could previously update arbitrary fields, including verification status. Local rules now restrict ordinary report creation to community-owned pending reports and restrict submitter updates to clarification fields during the information-request loop. DMC authority and demo initialization are retained. These local rule changes were not deployed.                 |

## Test improvements

New service regression suites cover warning/report workflow safety, offline concurrency and recovery, outcome notifications and browser photo handling. Existing officer/pipeline tests now provide real authenticated-profile/event/report fixtures instead of accepting writes to nonexistent records. The status-transition and report-validation tests exercise production functions rather than copies of the intended logic inside the tests. The corrupted-storage test now uses the application's actual storage key.

`reportToWarningFlow.test.ts` runs the actual services through citizen submission → officer information request → owner clarification → officer verification → warning dispatch → audit/history and public warning retrieval. It checks that pending evidence is absent from verified event evidence, verification does not automatically change the official warning level, the public audience excludes officers, all selected channel logs persist, and the citizen receives the outcome notification.

These tests use a stateful in-memory Firestore adapter with serialized transactions and explicit commit failures. They test application workflows; they do not execute the Firestore SDK's transaction retries or evaluate security rules.

## UI checks

Actual Metro-loaded screens were mounted in browser fixture sessions at widths 320, 390 and 430 pixels, without live report/event writes or warning dispatch:

- Report review: Add Hazard Event entry, create validation, cancellation, retained review note, failed-save retry, automatic event selection and selectable event list.
- Warning composer: required instructions, review before sending, closure detected immediately before sending, visible dispatch/audit errors, return to editing with content preserved and recipient-lookup failure blocking submission.
- No page runtime errors or horizontal page overflow were observed in those checks.

## Remaining integration and scope limits

- Push, SMS and audible delivery currently use the project's demonstration adapters. Actual provider delivery and audible behavior while Android/iOS is in the background are **not implemented or verified by these tests**; the scope requires that background behavior.
- Warning affected areas are currently selected with a searchable list. The scope describes selection on a map; the warning targeting screen does not yet implement that map interaction.
- Real-device camera/GPS permissions, native filesystem persistence across app termination, native modal transitions and physical location changes require Android/iOS checks. Browser and Jest fixtures are not substitutes for those checks.
- Local Firestore rules were tightened, but the project has no rules-test/emulator tooling installed. Rules were not evaluated in an emulator or deployed to the live project. A rules-emulator test and deployment review remain necessary before claiming backend policy enforcement has been verified.
- If delivery has already run and the final audit transaction permanently fails, the warning stays `dispatching`. The app now exposes this error and warning ID; an operational audit recovery process is still needed before using real delivery providers. The send operation must not simply be repeated.

The reviewed application flows pass the checks listed above. These remaining integrations prevent a claim that every requirement is complete on real devices or that real emergency delivery is production-ready.
