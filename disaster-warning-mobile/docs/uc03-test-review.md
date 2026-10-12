# UC03 test review

Reviewed against **UC03 — Coordinate Shelters, Rescue Teams and Relief Supplies** in the supplied assignment scope document. The document is a requirements reference; the requested work was to review and repair UC03 tests and defects found through that review.

## Results

- Before review: 12 UC03 suites, 94 passing tests.
- After initial review: 15 UC03 suites, 190 passing tests.
- Full application regression suite at initial review: 53 suites, 426 passing tests.
- UC03 production coverage: 97.85% lines, 93.28% branches, 100% functions across the eight files listed in `jest.uc03.config.js`. This does not measure React screen coverage.
- TypeScript and lint for all files changed in this review pass.
- Repository-wide lint still reports existing UC04 unused imports and one explicit `any` in its export tests; those files were outside this review.

Run `npm run test:uc03` or `npm run test:uc03:coverage`. The coverage command enforces minimum coverage and writes an HTML report to `.expo/uc03-coverage/index.html`. Run `npm test -- --runInBand` for all use cases.

## Coverage and corrections

| Scope function                                           | Evidence and corrections                                                                                                                                                                                                                                                                                                                                                  |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| District Officer authorisation / public read-only access | Actual profile checks cover all mutation entry points, signed-out users and missing profiles. UI permission helper tests cover District Officer access and other roles' read-only controls. Persisted actor IDs come from authentication rather than a caller-supplied ID.                                                                                                |
| Shelter registration and ownership                       | Production validators replace test-local validation copies. Required fields, organisation categories, districts, Sri Lankan coordinate bounds and positive whole-number capacity are tested before writes.                                                                                                                                                                |
| Activation                                               | Transaction checks resource existence, registered/inactive state and an existing active event covering the shelter district. Repeated activation cannot overwrite an existing allocation.                                                                                                                                                                                 |
| Occupancy and history                                    | Uses the persisted capacity rather than a stale caller-supplied capacity. Tests cover zero, exact capacity, truthful over-capacity counts, reductions, invalid inputs, inactive/standby resources, history and recorded officer IDs.                                                                                                                                      |
| Approaching capacity                                     | Shared production helper is used in shelter cards/details; tests cover the 80% threshold, full/over-capacity and closed/standby states.                                                                                                                                                                                                                                   |
| Deactivation                                             | Occupied shelters are refused; zero-headcount deactivation and subsequent activation are covered. The read and write share a transaction so a concurrent occupancy update invalidates the close operation.                                                                                                                                                                |
| Rescue registration / dispatch                           | Validates required fields and whole-number crew counts. Transaction rechecks current availability and event coverage. Tests include all unavailable states, missing resources, empty locations, two requests selecting one team and the complete mission lifecycle.                                                                                                       |
| Rescue status / owner withdrawal                         | Production transition checks reject stale/impossible transitions. Withdrawal is exposed for deployed teams. Returning to available or withdrawing clears the current location and event assignment; completed missions retain their event association until reset.                                                                                                        |
| Inventory and distribution                               | Registration and distribution validate quantities and locations. A transaction writes the ledger and remaining balance together. Tests cover exact depletion, overdrafts, concurrent requests, corrupt balances, commit failure, closed/missing events and uncovered destinations. Ledger records capture the stored item name/unit/type/owner and authenticated officer. |
| Supply owner withdrawal                                  | Added withdraw/restore controls and persisted availability. Withdrawn items cannot be distributed and do not count as available stock. Legacy stock without the field remains available.                                                                                                                                                                                  |
| DMC combined operational picture                         | Shared production aggregation replaces duplicated calculation tests. Selected-event metrics now filter allocations; unassigned standby resources use affected districts. The screen subscribes to shelter/team/supply updates. Tests exercise populated and changed snapshots, unsubscribe, empty data and withdrawal accounting.                                         |
| Citizen shelter directory                                | Production filtering tests cover district, facility, search, available space and hiding registered standby shelters.                                                                                                                                                                                                                                                      |

## Test boundaries and remaining scope gaps

### Rescue registration follow-up

The reported missing-team issue was verified against existing Firebase records: two Colombo teams were already saved by the Ratnapura test officer. The screen discarded all other districts before applying its district selector, and retained previous search/status/organisation filters after registration.

The directory now retains all teams for its explicit district filter. A successful registration selects the saved team's district, resets incompatible filters and immediately adds the confirmed saved record to the list. Team and hazard-event refreshes are independent, stale refresh results are ignored, and save/validation failures appear inline with the form preserved. Filter counts follow the current district/search/organisation selection. Success feedback expires after five seconds.

Three regression tests cover this cross-district registration/readback, filter reset and directory selection. The UC03 suite now has 16 suites / 193 tests. A read-only browser check confirmed both existing Colombo teams are visible and empty submission displays inline validation without runtime errors. No duplicate live test team was created.

### Shared location refresh follow-up

The report/shelter location field now requests a fresh high-accuracy fix on every current-location press. Web requests explicitly disallow cached coordinates. Each successful fix refreshes the map, street/landmark and district, including repeated fixes with identical coordinates. Previous address requests are invalidated so their late responses cannot replace a newer selection. Address failures leave manual address/district entry available.

The location service has 11 tests covering uncached repeated browser fixes, denied/unavailable GPS, native permissions/high accuracy/timeouts, address formatting and failed/empty reverse lookups. All 54 suites / 436 tests, TypeScript and scoped lint passed. Browser QA used simulated GPS and intercepted reverse-geocoding responses: Ratnapura to Malabe updated the map marker and both address fields; refreshing identical coordinates replaced an old manual street. No reports or shelters were submitted. This verifies the UI flow, not physical-device GPS accuracy or live geocoder address availability.

The new workflow tests use the real application service functions with a stateful Firestore adapter. Its transaction adapter serialises requests and stages writes until commit; this demonstrates that the services reread current state and put related writes in one transaction. It does **not** test Firebase's transaction retry implementation, deployed Firestore rules, networking or real device UI interactions. No live resource records were created or altered during this review.

There is no Firestore Emulator/rules test setup in this repository. The locally defined role restrictions therefore still require emulator or deployed-rule integration verification. This review did not deploy rules.

Two requirements are only partly represented by the current data model: organisation ownership is recorded using name/type rather than a validated registered-organisation directory; map coordinates are validated against Sri Lankan bounds, while exact coordinate-to-district association relies on the location UI's lookup/manual confirmation rather than district polygons. The tests do not claim those integrations are complete.
