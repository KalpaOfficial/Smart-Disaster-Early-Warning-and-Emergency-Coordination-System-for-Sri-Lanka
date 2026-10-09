# SE3070-CASE STUDIES IN SOFTWARE ENGINEERING
## Assignment 02
### Final Use Case Scenarios and Design Critique
**Smart Disaster Early-Warning and Emergency Coordination System for Sri Lanka**

| Document Information | Details |
| :--- | :--- |
| **Basis of analysis** | Group 054 Assignment 01 Design + Case Study 02 + Assignment 02 Specification |
| **Use Cases** | UC01, UC02, UC03, UC04 |
| **Purpose** | Critique the original design and provide justified final scenarios for Assignment 02 |

*Note: This document preserves the original four substantial business use cases wherever possible. Changes are limited to requirement gaps, unsupported scope, logical consistency, and usability improvements required by the Case Study and Assignment 02 specification.*

---

## 1. Overall Design Review Approach

The original Group 054 design was compared against the requirements stated in Case Study 02. The review considers requirement coverage, logical soundness, unnecessary or unsupported functionality, and the consistency of the resulting use case flow. The Assignment 02 specification requires the original use cases to be preserved as much as possible and allows changes only when they are justified by the case study. Accordingly, the four original business use cases are retained, while unsupported functions are removed and missing case-study functionality is added or strengthened.

### Change Categories

| Category | Meaning |
| :--- | :--- |
| **Retain** | Original functionality is aligned with Case Study 02 and should remain. |
| **Add/Strengthen** | A case-study requirement is missing or insufficiently represented and must be added or made explicit. |
| **Modify** | The functionality is useful but its scope, flow, or relationship with another use case should be improved. |
| **Remove** | The functionality is not required by Case Study 02 and unnecessarily expands the scope. |

---

## 2. UC01 - Issue Hazard Warning

### 2.1 Original Design vs Case Study 02
The original UC01 already covers the main warning-issuance process: selecting an open hazard event, setting severity, targeting districts or river basins, resolving recipients, selecting delivery channels, recording delivery outcomes, and attaching the alert to the event timeline. These functions are strongly aligned with Case Study 02. However, the original scenario also contains several features that are not stated in the case study, such as language selection, translation service handling, draft warnings, recipient thresholds, radio fallback, and comparison of concurrent alerts.

| Change | Decision | Justification |
| :--- | :--- | :--- |
| Open hazard event, severity, district/river-basin targeting | Retain | Directly supports location-specific warning requirements. |
| Push, SMS and audible alerts | Retain | Explicitly required by Case Study 02. |
| Background audible alert behaviour | Add/Strengthen | Case Study explicitly states that audible alerts should work while the app is in the background. |
| Delivery outcome logging | Retain | Supports confirmation of alert delivery and later reporting. |
| Event timeline attachment | Retain | Supports the required post-event alert timeline report. |
| Escalation of an existing warning | Retain/Strengthen | Supports changing an existing warning as the hazard develops. |
| Language selection and translation service | Remove | Not specified as a system requirement in Case Study 02. |
| Save warning as draft | Remove | Not a required disaster-warning business function. |
| Minimum recipient threshold | Remove | No threshold is specified in the case study. |
| Radio broadcast fallback | Remove | The case study specifies push, SMS and audible alerts; radio fallback is not stated. |
| Concurrent alert comparison | Remove | Not required and unnecessarily expands the warning workflow. |

### Final Use Case Scenario

#### Description
This use case describes how a DMC duty officer composes an official hazard warning for an open hazard event, selects a severity level, targets the warning by district or river basin, and dispatches it through push notification, SMS, and audible alert channels. The system resolves the relevant registered recipients from the selected target areas, records delivery outcomes for each selected channel, and attaches the dispatched warning to the hazard event timeline for later analysis.

#### Primary Actor
DMC Duty Officer

#### Secondary Actors
- SMS Gateway
- Push Notification Service
- Citizen (Recipient)

#### Preconditions
- The DMC duty officer is authenticated and authorised to issue warnings.
- At least one hazard event is open.
- District and river basin information is available.
- Citizen registration records are available for recipient resolution.
- At least one selected delivery channel is available.

#### Main Flow
1. The duty officer selects an open hazard event.
2. The system displays the event summary, including hazard type, current warning level, affected areas, and verified ground reports.
3. The duty officer selects Issue Warning.
4. The system displays the warning composer with the hazard type prefilled.
5. The duty officer selects the severity level.
6. The duty officer selects the target mode: District or River Basin.
7. The duty officer selects one or more target areas on the map.
8. The system resolves registered recipients for the selected target areas and displays the estimated recipient count.
9. The duty officer enters the warning headline and instruction text.
10. The duty officer selects Push, SMS, and/or Audible as the delivery channels.
11. The duty officer submits the warning.
12. The system validates the mandatory information and resolved recipient set.
13. The system creates the warning with a Dispatching status and initiates delivery.
14. The system sends the warning through the selected channels, including audible alert delivery while the citizen application is running in the background.
15. The system records the delivery result for each selected channel.
16. The system updates the warning status and displays the delivery summary.
17. The system attaches the dispatched warning to the hazard event timeline.

#### Alternate Flows
- **Escalation of Existing Warning**
  - The duty officer selects an already dispatched warning and raises its severity.
  - The system creates a linked follow-up warning referencing the original warning.
  - The officer confirms the target, content, and delivery channels.
  - The flow continues at the warning submission stage.
- **River Basin Spanning Multiple Districts**
  - The selected river basin covers multiple districts.
  - The system resolves the relevant districts and merges the recipient sets without duplicates.
  - The system displays the resulting recipient count and contributing districts.
  - The flow continues to warning content and channel selection.

#### Postconditions
- The warning record is persisted with severity, target areas, content, channels, dispatch timestamp, and issuing officer.
- A delivery log exists for each selected delivery channel.
- The warning is available to recipients in the selected target areas.
- The warning is visible in the hazard event timeline.
- The warning is available for later post-event reporting.

#### Exception Flows
- **Delivery Channel Unavailable**
  - The affected channel fails or is unavailable.
  - The system records the channel as Failed and continues delivery through the remaining selected channels.
  - The system displays the partial delivery result to the duty officer.
- **No Recipients Matched**
  - The resolved recipient set is empty.
  - The system informs the duty officer and does not dispatch the warning.
  - The officer returns to target selection.
- **All Delivery Channels Fail**
  - All selected channels return failure.
  - The system marks the warning as Dispatch Failed.
  - The system records the failures and informs the duty officer.

---

## 3. UC02 - Submit and Verify Ground Report

### 3.1 Original Design vs Case Study 02
The original UC02 correctly identifies citizen/community volunteer reporting, photographs, location, verification by a DMC duty officer, and notification of the submitter. However, it introduces several additional mechanisms that are not required by Case Study 02, including verification-rate scoring, distance/time-based related-report retrieval, confidence and severity scoring, evidence-score escalation, automatic duplicate detection, volunteer priority, and candidate event creation. The final design retains the core reporting and verification workflow and makes the requirement that unverified reports must not influence official warning levels explicit.

| Change | Decision | Justification |
| :--- | :--- | :--- |
| Citizen/community volunteer submission | Retain | Directly required by Case Study 02. |
| Observation, description, photo and GPS location | Retain | Directly required reporting information. |
| Duty officer verification | Retain | Case Study explicitly requires review and verification before influence on warning level. |
| Pending Verification status | Retain | Provides clear separation between submitted and verified evidence. |
| Offline capture and delayed synchronisation | Retain/Strengthen | Explicitly required for network outages and graceful degradation. |
| Verified report linked to relevant hazard event | Retain/Strengthen | Supports use of verified reports as supporting information. |
| Unverified reports cannot influence official warning | Add/Strengthen | Makes an explicit Case Study safety requirement part of the scenario. |
| Prior verification rate | Remove | Not required by the case study. |
| Reports within 2 km / 6 hours | Remove | Not specified and adds unnecessary review complexity. |
| Confidence level / severity contribution / evidence score | Remove | Case Study requires verification, but does not define these scoring mechanisms. |
| Automatic duplicate detection | Remove | Not required by the case study. |
| Candidate event creation from reports | Remove | Not required; official hazard events remain controlled by the DMC. |
| Volunteer accreditation priority | Remove | Not specified by the case study. |

### Final Use Case Scenario

#### Description
This use case describes how a citizen or community disaster volunteer submits a ground report about a hazard using the mobile application. The report contains an observation type, description, photograph, and GPS location. The system stores the report as pending verification, and a DMC duty officer reviews the submitted information and verifies or rejects the report. Verified reports are linked to the relevant hazard event as supporting information, while unverified reports do not influence the official warning level. The system also supports offline report capture and delayed synchronisation when network connectivity is unavailable.

#### Primary Actor
Citizen or Community Disaster Volunteer (submission); DMC Duty Officer (verification)

#### Secondary Actors
- Hazard Event
- GPS/Location Service
- Mobile Device Camera

#### Preconditions
- The citizen or volunteer is registered.
- The mobile application is installed.
- The DMC duty officer is authenticated and authorised to verify reports.
- Camera/location permissions are available or offline capture is enabled.
- The system can store reports for later verification.

#### Main Flow
18. The user selects Submit Ground Report.
19. The system displays the report form and observation types.
20. The user selects an observation type such as rising water, blocked road, landslide crack, or other.
21. The user enters a description.
22. The user captures or selects a photograph.
23. The application obtains the GPS location and displays it on a map.
24. The user confirms or adjusts the location.
25. The user submits the report.
26. The system validates the report.
27. The system stores the report with photograph, GPS location, capture time, and submitter information as Pending Verification.
28. The system associates the report with the relevant geographical area and, where applicable, an open hazard event.
29. The system returns a reference number and pending status.
30. The report is placed in the DMC verification queue.
31. The duty officer opens the submitted report.
32. The system displays the description, photograph, location, and capture time.
33. The duty officer reviews the report.
34. The duty officer selects Verify or Reject.
35. If verified, the system changes the status to Verified and links the report to the relevant hazard event as supporting information.
36. If rejected, the system changes the status to Rejected and records the decision.
37. The system records the officer decision and timestamp.
38. The system notifies the submitter of the outcome.

#### Alternate Flows
- **Offline Capture and Delayed Synchronisation**
  - No network connectivity is available when the user submits the report.
  - The application stores the report locally in a queue while preserving the photograph, location, and capture time.
  - When connectivity returns, the application synchronises the queued report.
  - The system validates and stores it as Pending Verification.
  - The flow continues with the verification queue.
- **Additional Information Requested**
  - The duty officer identifies that the submitted information is insufficient for a decision.
  - The system records an Information Requested status and the information required.
  - The submitter is notified and can provide the requested information.
  - The updated report returns to the verification queue.

#### Postconditions
- The ground report is persisted with its observation type, description, photograph, GPS location, capture time, and submitter.
- The verification status and decision are recorded.
- The verifying officer and decision timestamp are recorded.
- Verified reports are linked to the relevant hazard event as supporting information.
- Unverified or rejected reports do not influence the official warning level.
- Offline reports are synchronised when connectivity returns.

#### Exception Flows
- **GPS Fix Unavailable**
  - The device cannot obtain a GPS location.
  - The application allows the user to select the location manually on the map.
  - The report is marked as manually located for officer review.
- **Photograph Capture or Upload Failure**
  - The application cannot complete the photograph capture or upload.
  - The user is informed of the problem and may retry.
  - Offline storage is used where applicable so that the report information is not unnecessarily lost.
- **Invalid Report Information**
  - Required information is missing or invalid.
  - The system displays validation errors.
  - The user corrects the information before submission.
- **Synchronisation Failure**
  - A queued offline report cannot be synchronised.
  - The report remains queued and the captured information is preserved.
  - The system retries synchronisation when connectivity becomes available.

---

## 4. UC03 - Coordinate Shelters, Rescue Teams and Relief Supplies

### 4.1 Original Design vs Case Study 02
UC03 is the largest scope gap in the original design. The original scenario correctly covers emergency shelter registration, ownership, activation, occupancy tracking, and the DMC combined operational picture. However, the original scenario explicitly places rescue team dispatch and relief supply distribution outside the scenario scope. Case Study 02 explicitly requires both activities. Therefore, UC03 should be broadened rather than replaced, preserving the original shelter functionality while adding rescue team and relief supply coordination.

| Change | Decision | Justification |
| :--- | :--- | :--- |
| Shelter registration | Retain | Explicitly required by Case Study 02. |
| Shelter capacity and facilities | Retain | Required to coordinate emergency shelters. |
| Shelter occupancy tracking | Retain | Explicitly required against shelter capacity. |
| Ownership by different organisations | Retain/Strengthen | Case Study requires government, armed forces, NGOs and private donors to be represented. |
| DMC combined operational picture | Retain/Strengthen | Explicitly required across different resource owners/controllers. |
| Rescue team dispatch | Add | Explicitly required by Case Study 02 but excluded from the original scenario. |
| Rescue team real-time status | Add | Explicitly required by Case Study 02. |
| Relief supply distribution | Add | Explicitly required for food, water and medicine. |
| Supply quantity and remaining quantity | Add | Needed to accurately record distribution and remaining operational resources. |
| Exact 70%/90% occupancy thresholds | Modify/Simplify | Useful UI guidance but not a stated case-study requirement; avoid hard-coding unnecessary domain rules. |
| Optimistic locking/complex concurrent update handling | Simplify | Implementation detail rather than a core business requirement. |
| Automatic reallocation suggestions | Simplify | Not explicitly required and can remain a future enhancement. |
| Cross-district escalation workflow | Remove from core scenario | Not explicitly required; keep the core district coordination flow focused. |

### Final Use Case Scenario

#### Description
This use case describes how a district officer coordinates emergency shelters, rescue teams, and relief supplies during an active hazard event. The district officer can register and activate emergency shelters, record and monitor their occupancy against capacity, dispatch available rescue teams and monitor their operational status, and record the distribution of relief supplies such as food, water, and medicine. Resources may be owned or controlled by government organisations, armed forces, NGOs, or private donors while remaining visible to DMC officers through a combined operational picture.

#### Primary Actor
District Officer

#### Secondary Actors
- Partner Organisation
- DMC Officer
- Rescue Team
- Resource/Supply Organisation

#### Preconditions
- The district officer is authenticated and authorised for resource coordination.
- An active hazard event exists for the relevant district.
- Organisations owning or controlling resources are registered.
- District and location information is available.
- Shelter, rescue team, and relief supply information can be recorded.

#### Main Flow
39. The district officer opens Resource Coordination.
40. The system displays available emergency resources including shelters, rescue teams, and relief supplies.
41. The district officer selects Register Shelter.
42. The officer enters the shelter name, facility type, address, and map location.
43. The officer selects the organisation owning or controlling the shelter.
44. The officer enters capacity, facilities, and manager contact details.
45. The officer submits the registration.
46. The system validates the information and creates the shelter with Registered status.
47. The officer activates the shelter for the active hazard event.
48. The system sets the shelter to Active and displays it in the DMC combined operational picture.
49. As evacuees arrive, the officer records the current shelter occupancy.
50. The system updates occupancy, remaining capacity, utilisation information, and occupancy history.
51. The officer opens Rescue Teams.
52. The system displays available teams with their organisation and current status.
53. The officer selects an available team and assigns it to a response location.
54. The system records the dispatch and updates the team status.
55. The rescue team provides status updates as the response progresses.
56. The system records and displays the latest rescue team status in the combined operational picture.
57. The officer opens Relief Supplies.
58. The system displays available supplies, types, quantities, and controlling organisations.
59. The officer selects a supply and records the quantity, destination district/location, and distribution details.
60. The system validates the requested quantity.
61. The system records the distribution and updates the remaining available quantity.
62. The system updates the combined operational picture with shelter occupancy, rescue team status, and relief supply information.

#### Alternate Flows
- **Shelter Approaching Capacity**
  - The system indicates that a shelter has limited remaining capacity.
  - The officer can continue the allocation where appropriate or select another available shelter.
  - The system updates occupancy and history.
- **Partner-Owned Resource**
  - The selected resource is owned or controlled by an NGO, armed forces unit, government body, or private donor.
  - The system records the ownership/control information.
  - The resource remains visible to DMC officers in the combined operational picture.
- **Rescue Team Status Update**
  - The rescue team changes its operational status.
  - The system records the new status and timestamp.
  - The updated status is displayed in the combined operational picture.
- **Shelter Deactivation**
  - The shelter is no longer required or the hazard event is closed.
  - The officer checks the current occupancy and reallocates occupants if required.
  - The system sets the shelter to Inactive.

#### Postconditions
- Shelter information, capacity, location, facilities, and ownership/control are persisted.
- Current occupancy and occupancy history are recorded.
- Rescue team dispatch and current status are recorded.
- Relief supply distributions are recorded with type, quantity, destination, and organisation information.
- Remaining supply quantities are updated.
- Resource ownership/control information is preserved.
- The latest shelter, rescue team, and supply information is available through the DMC combined operational picture.

#### Exception Flows
- **Occupancy Exceeds Registered Capacity**
  - The system records the actual occupancy because the record must remain truthful.
  - The shelter is flagged as Over Capacity.
  - The district officer is informed so that another response action can be considered.
- **Rescue Team Unavailable**
  - The selected team is no longer available.
  - The system informs the officer.
  - The officer selects another available team or leaves the dispatch pending.
- **Insufficient Relief Supply**
  - The requested quantity exceeds the available quantity.
  - The system rejects the distribution request and displays the available quantity.
  - The officer adjusts the quantity or selects another supply.
- **Resource Owner Withdraws Availability**
  - The owning or controlling organisation withdraws the resource.
  - The system updates its availability and prevents further allocation/distribution.
  - The change is reflected in the combined operational picture.
- **Invalid Resource Location**
  - The supplied location is invalid or cannot be associated with the required district.
  - The system informs the officer.
  - The officer corrects the location before completing the operation.

---

## 5. UC04 - Generate Post-Event Response Report

### 5.1 Original Design vs Case Study 02
UC04 is largely aligned with the reporting requirements of Case Study 02. The original design already contains the four required metrics: alert timeline, citizens reached, shelter occupancy over time, and resource distribution by district. It also includes event selection, date range and district filtering, charts/tables, export, and donor distribution. The main issue is the presence of additional features that are not required, such as comparing two events and scheduling recurring reports. These are removed to keep the use case focused.

| Change | Decision | Justification |
| :--- | :--- | :--- |
| Closed hazard event selection | Retain | Supports post-event analysis. |
| Alert timeline | Retain | Explicit Case Study reporting metric. |
| Citizens reached | Retain | Explicit Case Study reporting metric. |
| Shelter occupancy over time | Retain | Explicit Case Study reporting metric. |
| Resource distribution by district | Retain | Explicit Case Study reporting metric. |
| Date range and district filter | Retain | Supports meaningful post-event analysis and district-level reporting. |
| Charts and tabular summaries | Retain | Supports interpretation and exact reporting of results. |
| Report export | Retain | Useful for organisational and donor reporting. |
| Donor organisation distribution | Modify | Retain as an optional post-export action rather than coupling it to report generation. |
| Resource distribution data | Modify | Consume the operational distribution records produced by the broadened UC03. |
| Comparative report across two events | Remove | Not required by Case Study 02. |
| Scheduled recurring report | Remove | Not required by Case Study 02. |
| Save report without export | Remove | Unnecessary user-facing alternate flow; report persistence remains part of normal generation. |

### Final Use Case Scenario

#### Description
This use case describes how a DMC official generates a statistical post-event response report for a completed hazard event. The report covers the alert timeline, number of citizens reached, shelter occupancy over time, and resource distribution by district. The official can apply a reporting date range and optional district filter, review the generated results using charts and tabular summaries, and export the report for organisational or donor reporting purposes. The generated report and its configuration are retained for future retrieval and analysis.

#### Primary Actor
DMC Official

#### Secondary Actors
- Donor Organisation
- Reporting System

#### Preconditions
- The DMC official is authenticated and authorised to access post-event reports.
- At least one hazard event has been completed/closed.
- Alert and delivery records are available for the selected event.
- Shelter occupancy records are available for the selected event.
- Resource distribution records are available for the selected event.
- The selected event has associated district information.

#### Main Flow
63. The DMC official selects Reports from the DMC dashboard.
64. The system displays a list of completed/closed hazard events with their date range and district coverage.
65. The DMC official selects a hazard event.
66. The system displays the available report metrics: Alert Timeline, Citizens Reached, Shelter Occupancy Over Time, and Resource Distribution by District.
67. The DMC official selects one or more report metrics.
68. The DMC official sets the reporting date range and optionally selects a district filter.
69. The DMC official submits the report request.
70. The system validates the selected event, date range, metrics, and district filter.
71. The system retrieves the relevant data for each selected metric.
72. The system aggregates the retrieved data and prepares the report datasets.
73. The system assembles the datasets into a response report.
74. The system displays the generated report using charts and accompanying tabular summaries.
75. The DMC official reviews the generated report.
76. The DMC official selects Export Report.
77. The system displays the available export formats.
78. The DMC official selects the required export format.
79. The system generates the export file and links it to the response report.
80. The system confirms that the report has been successfully exported.
81. If required, the DMC official selects a registered donor organisation as the recipient.
82. The system records the report distribution with the recipient, format, and delivery timestamp.
83. The system confirms the distribution to the DMC official.

#### Alternate Flows
- **Filter Refinement**
  - The DMC official changes the district filter or reporting date range.
  - The system reprocesses the affected report data using the updated criteria.
  - The system refreshes the displayed charts and tabular summaries.
  - The flow continues with report review.
- **Donor Report Distribution**
  - The DMC official chooses to share the exported report with a registered donor organisation.
  - The system records the selected recipient and delivery details.
  - The report is delivered to the selected donor organisation.
  - The system records the distribution for audit purposes.
  - The flow continues to the distribution confirmation.

#### Postconditions
- A response report is persisted with its selected event, metrics, filters, configuration, and generation timestamp.
- The report contains the selected statistical metrics.
- The report can be reviewed using charts and tabular summaries.
- An export file is generated and linked to the response report when export is requested.
- If distributed, the donor organisation, export format, and delivery timestamp are recorded.
- The generated report remains available for future retrieval and post-event analysis.

#### Exception Flows
- **No Records for Selected Criteria**
  - The system finds no records for the selected reporting criteria.
  - The system displays a message indicating that no data are available.
  - The DMC official returns to the filter configuration and modifies the criteria.
  - No response report is generated until valid data are available.
- **Aggregation Timeout**
  - Processing for one of the selected metrics exceeds the allowed processing time.
  - The system identifies the affected metric and informs the DMC official.
  - The official can modify the reporting criteria and retry generation.
- **Export Generation Failure**
  - The system fails to generate the requested export file.
  - The generated on-screen report is retained.
  - The system informs the DMC official and allows a retry or another available format.
- **Event Not Closed**
  - The selected event is still active.
  - The system rejects it for post-event reporting and informs the official that a completed/closed event is required.
  - The official returns to the event list and selects an appropriate event.
- **Repository/Data Source Unavailable**
  - A data source required for one of the selected metrics is unavailable.
  - The affected metric is marked as incomplete and the DMC official is informed.
  - The report should not be distributed until the affected metric is successfully regenerated.

---

## 6. Overall Final Design Decisions

The final design preserves the four substantial business use cases from the Group 054 Assignment 01 design. The changes are targeted rather than replacing the original design. UC01 is simplified by removing unsupported warning-management features while strengthening the required delivery behaviour. UC02 retains the citizen reporting and officer verification workflow while removing unsupported scoring and automated evidence mechanisms. UC03 is broadened because the original scenario excluded rescue team dispatch and relief supply distribution even though these are explicit Case Study 02 requirements. UC04 is retained and simplified so that it focuses on the four required post-event reporting metrics.

| Use Case | Final Decision | Main Change |
| :--- | :--- | :--- |
| **UC01 - Issue Hazard Warning** | Retain + Remove + Strengthen | Keep core warning flow; remove unsupported extras; strengthen background audible delivery and escalation. |
| **UC02 - Submit and Verify Ground Report** | Retain + Remove + Strengthen | Keep report/verification flow; remove unsupported scoring/automation; explicitly protect official warnings from unverified reports. |
| **UC03 - Coordinate Shelters, Rescue Teams and Relief Supplies** | Broaden + Add | Preserve shelter coordination and add rescue dispatch/status and relief supply distribution. |
| **UC04 - Generate Post-Event Response Report** | Retain + Simplify + Modify | Keep four required metrics; remove unsupported comparison/scheduling/save flows; separate report generation from donor distribution. |

---

## 7. Alignment with Assignment 02

The proposed changes are intended to satisfy the Assignment 02 requirement to critique the received design and suggest justified improvements while preserving the original use cases as much as possible. The changes are tied directly to the Case Study 02 requirements and focus on requirement coverage, logical consistency, and clearer business flows. The final scenarios should be treated as the baseline for the updated use case diagram, class diagram, sequence diagrams, storyboards, wireframes, implementation, and unit tests.

The Assignment 02 specification also requires the implementation to follow the suggested changes and expects meaningful unit-test coverage. Therefore, the final scenarios in this document should be kept consistent with the updated UML and UI designs.

---

## 8. Source Basis

- **Group_054.pdf** - Assignment 01 functional and interaction design for the four original use cases.
- **Case study 02 (1).pdf** - Smart Disaster Early-Warning and Emergency Coordination System for Sri Lanka.
- **SE3070 - Case Study Assignment 02 Specification (1).pdf** - Assignment 02 critique, justified improvement, implementation, and testing requirements.
- **SE3070 - Case Study Assignment 01 Specification (2).pdf** - Assignment 01 use-case, UML, sequence, storyboard, and wireframe expectations.
