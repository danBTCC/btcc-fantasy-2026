# Firestore security audit

The production ruleset inspected before implementation was `31b9e9b7-e798-434e-b406-5635e4011b93`. Its recursive public-read rule overrode the intended private rule for submissions.

The replacement explicitly keeps the collections rendered by public pages readable: `meta`, `events`, `drivers`, `results`, `event_scores`, `engine_runs`, `driver_value_runs`, `driver_tier_runs`, published `standings_*`, `news`, `pitstop`, `pitstop_rounds`, `players`, and questionnaire configuration documents. Unlisted data defaults to custom-claim Admin only.

Raw current and legacy submissions are owner/Admin-only. The public Drivers page now reads the existing published `event_scores/{eventId}/drivers/{driverId}.selectionCount` aggregate instead of raw teams.

Production has 19 player documents. Fields observed were `active`, `baseBudget`, `budget`, `budgetBoost`, `budgetBoostEventId`, `budgetBoostUpdatedAt`, `budgetUpdatedAt`, `createdAt`, `displayName`, `driversSelected`, `effectiveBudget`, `lastBudgetChange`, `lastBudgetEventId`, `lastSubmission`, `lastSubmissionEventId`, `penalties`, `previousBudget`, `sldDriverId`, `sldLocked`, `sldSelectedAtEventNo`, `teamId`, `teamName`, `uid`, and `updatedAt`.

Many of those are authoritative. The active proposal deliberately preserves the existing owner-write permission pending review. A follow-up rule should use `request.resource.data.diff(resource.data).affectedKeys().hasOnly(...)` so players can update only the SLD and last-submission fields required by the existing UI; budget, boost, penalty, active, team, identity and audit fields should remain Admin-only. The one-time SLD lock transition should also receive explicit validation.

Questionnaire configuration is `questionnaires/2026-end-of-season`; one response per UID is stored at its `responses/{uid}` subcollection. `enabled`, `opensAt`, optional `closesAt`, and `version` are shared by UI and rules.
