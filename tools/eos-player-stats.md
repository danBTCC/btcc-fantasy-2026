# BTCC Fantasy League — End of Season Player Stats

## Purpose

Create a public-facing **Season in Numbers** feature for the BTCC Fantasy League website.

Every player will use the **same player-stat template** so seasons can be compared consistently.

The page will eventually allow anybody to select any player and view their 2026 season statistics.

Examples:

- Steve can view Sue's statistics.
- Daniel can view Fliss's statistics.
- No player login is required.
- This should behave like the existing public Standings, Results and News pages.

This document defines the statistics to calculate and display.

---

# Core Principles

- One template is used for every player.
- Do not create player-specific rules or layouts.
- A statistic should not disappear simply because its value is zero.
- Examples:
  - `0 Event Wins`
  - `0 Missed Submissions`
  - `Season Long Driver: None`
- Historical event snapshots and the final season export are the primary source of truth.
- Do not reconstruct historical values from current Firestore driver/player state where historical snapshots exist.
- Do not expose private/internal information such as:
  - Firebase UIDs
  - authentication information
  - internal processing metadata
  - unnecessary exact submission timestamps
- The public Season in Numbers data should be derived/read-only data.
- The statistics feature must not alter scoring, standings, budgets, event results or any other existing league data.

---

# Primary Data Sources

## 1. Full League History JSON

Primary source:

`BTCC_2026_Full_History_2026-10-13.json`

Relevant exported datasets include:

- `playerEventSummaries`
- `playerDriverSelections`
- `driverEventResults`
- `drivers`
- `players`
- `events`
- `pitStopRounds`
- `pitStopPlayerTotals`

## 2. Firestore

Use Firestore only where the final JSON does not contain enough information.

Likely examples include:

- specialist standings
- raw race/result classifications
- additional Pit Stop Pot detail
- statistics requiring information that was not included in the full-history export

Do not manually retrieve data from Firestore if the JSON already contains authoritative historical data for the statistic.

---

# Player Header

Display:

- Player name
- Final Overall Championship position
- Final Overall Championship points
- Gap to Overall Champion
- Fantasy team name
  - Show `Independent / No Team` or agreed equivalent for players without a fantasy team

Potential later addition:

- Championship finishing-position badge/medal styling

---

# 1. Championship Summary

Display:

- Final championship position
- Final championship points
- Gap to champion
- Events entered
- Events missed
- Event wins
- Event podium finishes
- Top 6 event finishes
- Average event score
- Average event finishing position
- Highest event score
- Lowest event score
- Best event
- Worst event

### Definitions

**Events entered**

Number of events where the player made a valid submission and received an event score.

**Events missed**

Number of genuine missed submissions.

**Event win**

Player finished P1 in the fantasy results for that race weekend.

**Event podium**

Player finished P1–P3 for that race weekend.

**Top 6**

Player finished P1–P6 for that race weekend.

**Average event score**

Total points scored across entered events divided by entered events.

Missed submissions must not artificially reduce the average unless we later explicitly decide otherwise.

**Best event**

Event with the player's highest event score.

If more than one event has the same highest score, retain all tied events unless a tie-display rule is later agreed.

**Worst event**

Lowest score from an event the player actually entered.

A genuine missed submission should not automatically become their "worst performance".

---

# 2. Championship Journey

Display:

- Championship position after Event 1
- Highest championship position reached
- Lowest championship position reached
- Biggest position gain between consecutive events
- Biggest position loss between consecutive events
- Final championship position

Potential visual:

- Championship position line graph across Events 1–10

Example:

`1 → 1 → 1 → 2 → 3 → 2 → 2 → 2 → 2 → 2`

### Notes

Use stored `overallPositionAfterEvent` historical values.

Do not recreate historical positions from the final standings.

---

# 3. Race Weekend Performance

Display:

- Best-scoring event
- Worst-scoring entered event
- Average event score
- Event wins
- Event podiums
- Top 6 finishes
- Highest event finishing position
- Lowest entered-event finishing position
- Longest consecutive Top 6 streak
- Longest consecutive podium streak

Potential later addition:

- Most improved weekend compared with previous event
- Biggest points increase from one event to the next
- Biggest points decrease from one event to the next

---

# 4. Session Performance

Display totals for:

- Qualifying
- Race 1
- Race 2
- Race 3

Display:

- Total Qualifying points
- Total Race 1 points
- Total Race 2 points
- Total Race 3 points
- Strongest session type
- Qualifying wins
- Race 1 wins
- Race 2 wins
- Race 3 wins
- Highest single-session score
- Event/session where that score occurred

### Strongest Session

Initially define strongest session as:

> The session type with the player's highest cumulative season points.

Possible alternative calculation:

> Highest average score per session.

This definition must be agreed before implementation.

### Session Wins

A player wins a session when they have the highest fantasy-player score for that session.

Ties must be recorded as tied wins unless we explicitly choose another rule.

---

# 5. Driver Selections

Display:

- Total driver selections
- Number of different drivers used
- Most-selected driver
- Number of times most-selected driver was selected
- Driver who earned the player the most total fantasy points
- Total points earned from that driver while selected
- Highest-scoring individual driver selection
- Event where that selection occurred
- Most-selected High-tier driver
- Most-selected Middle-tier driver
- Most-selected Low-tier driver
- Season Long Driver
- Number of events the SLD was selected/used

### Total Driver Selections

Count every driver selected in every submitted event.

Example:

Five selected drivers across ten events = 50 selections.

### Different Drivers Used

Count unique driver IDs selected by the player during the season.

### Most-Selected Driver

Driver selected at the highest number of events.

Ties should be shown as ties unless another display rule is agreed.

### Highest-Scoring Individual Driver Pick

Highest `driverEventPoints` produced by one driver while selected by that player at one event.

Example:

`Tom Ingram — 67 points at Silverstone`

---

# 6. Season Long Driver

Display:

- SLD driver name
- Events used
- Total fantasy points earned from SLD
- Average SLD points per event
- Best SLD event
- Best SLD score

If the player did not select an SLD:

`Season Long Driver: None`

Potential later statistics:

- Difference between SLD performance and player's normal driver selections
- SLD value gain/loss during the season

---

# 7. Star Drivers

Display:

## Underdog

- Number of Underdog selections
- Total points earned from Underdog selections
- Average Underdog score
- Best Underdog selection
- Best Underdog score

## Form Driver

- Number of Form Driver selections
- Total points earned from Form Driver selections
- Average Form Driver score
- Best Form Driver selection
- Best Form Driver score

Potential combined statistic:

- Total Star Driver selections
- Total Star Driver points

---

# 8. Budget Statistics

Display:

- Starting base budget
- Final base budget
- Highest base budget reached
- Lowest base budget reached
- Overall budget change
- Total amount spent across the season
- Average amount spent per submitted event
- Average unused budget
- Lowest unused budget
- Events with exactly £0.00 remaining
- Biggest post-event budget increase
- Biggest post-event budget decrease

### Starting Budget

All players began Event 1 with:

`£10.00`

### Final Budget

Use the final stored base/current budget after Event 10.

Do not confuse:

- base budget
- Budget Boost
- effective budget

These must remain separate concepts.

### Highest / Lowest Budget

Use historically stored budget snapshots where available.

Do not reconstruct missing historical budgets from current player state.

### Closest to Maximum Spend

Lowest valid `unusedBudget` during the season.

Example:

`£0.01 remaining — Silverstone`

---

# 9. Consistency

Display:

- Average event score
- Median event score
- Highest event score
- Lowest entered-event score
- Score range
- Standard deviation of event scores

Potential display label:

`Consistency`

Potential later derived value:

`Consistency Rating`

A custom Consistency Rating must not be introduced until its formula has been explicitly agreed.

If created, it must be clearly presented as a BTCC Fantasy League derived statistic rather than an official championship measure.

---

# 10. Specialist Championships

Display the player's final position and points for:

- WingFoot
- Race 1 Championship
- Race 2 Championship
- Race 3 Championship
- Manufacturer Championship
- Independents Championship
- Jack Sears Championship

Where a player has no meaningful score in a specialist championship, display the real recorded value rather than inventing one.

Potential format:

| Championship | Position | Points |
|---|---:|---:|
| WingFoot | 4th | 000 |
| Race 1 | 2nd | 000 |
| Race 2 | 6th | 000 |
| Race 3 | 1st | 000 |

---

# 11. Fantasy Team

For players assigned to a fantasy team, display:

- Fantasy team name
- Final Teams Championship position
- Final Teams Championship points

Potential later statistics:

- Player's contribution to team total
- Percentage of team championship points contributed by player

For players without a fantasy team, display:

`Fantasy Team: None`

Do not hide this section purely because the player is unassigned.

---

# 12. Pit Stop Pot

Display:

- Total money won
- Final earnings rank
- Number of Pit Stop rounds where player received money
- Number of full-pot wins
- Biggest individual payout
- Round/event of biggest payout

Potential later statistics:

- Total times drawn
- Money won when drawn
- Money won through race finishing rewards
- Checkpoint/shared payout total

These depend on whether `pitStopRounds` contains enough reliable historical information.

---

# 13. Season Highlights

This section should present a small number of automatically selected factual highlights.

Examples:

- `Won 2 race weekends`
- `Finished in the Top 6 at 7 of 10 events`
- `Race 2 was their strongest session`
- `Picked Tom Ingram 6 times`
- `Scored a season-best 250 points at Snetterton`
- `Used 18 different BTCC drivers`
- `Finished the season with £10.58`
- `Won £35.65 in the Pit Stop Pot`

Highlights must be generated from actual calculated statistics.

Do not generate subjective praise or criticism.

---

# 14. Possible Fun Statistics

These are optional and should only be added where the definition is meaningful and reproducible.

Ideas:

- Favourite driver
- Favourite circuit
- Strongest race number
- Biggest gamble
- Best value selection
- Most successful Underdog pick
- Most successful Form Driver pick
- Most loyal driver selection
- Driver they selected once who scored the most
- Driver they selected most often without strong results
- Most common team size
- Average team size
- Most-used tier combination
- Number of unique team combinations

Each fun statistic requires an agreed calculation before implementation.

---

# 15. Statistics Not Yet Fully Defined

Do not implement these until definitions are agreed:

- Consistency Rating
- Biggest Gamble
- Best Value Pick
- Most Profitable Driver
- Favourite Circuit
- Strongest Session if comparing totals versus averages
- Specialist session-win tie handling
- Driver-selection tie display behaviour
- Championship journey tie/display behaviour

These can be discussed and added to this document later.

---

# 16. Public Website Behaviour

The Season in Numbers player page will be public.

No sign-in should be required.

Expected user journey:

1. Open `Season in Numbers`.
2. View the season overview or player selection.
3. Choose any player.
4. View that player's statistics.
5. Switch directly to another player.

Potential future navigation:

- Clicking a player's name in Standings could open their Season in Numbers profile.
- Direct URLs/hash routes could open a specific player.

Example concept:

`#season-stats/daniel`

Exact routing must follow the existing application's architecture and should not be implemented until the feature design is agreed.

---

# 17. Public Data Model

Do not expose the raw full-history JSON directly to the browser purely to power this page.

Create a derived public season-stat dataset containing only the information required by the feature.

Conceptual structure:

```text
season_stats
└── 2026
    ├── overview
    └── players
        ├── amy
        ├── daniel
        ├── ellie-c
        ├── ellie-m
        ├── ezra
        └── ...


        Player public-stat documents should use harmless public identifiers/slugs rather than requiring Firebase authentication UIDs to be exposed.
Example:
season_stats/2026/players/daniel
rather than:
season_stats/2026/players/<firebase-uid>
The exact Firestore structure is not yet final and must be agreed before implementation.
18. Development Approach
Do not begin by building the user interface.
Development should proceed in this order:
1. Finalise the statistics list.
2. Define every statistic precisely.
3. Identify the source for every statistic.
4. Mark each statistic as:
   - JSON
   - Firestore
   - Derived calculation
   - Unavailable
5. Calculate and validate the complete 2026 player-stat dataset.
6. Spot-check multiple players manually.
7. Decide the public data structure.
8. Store/generate the public stats dataset.
9. Build the public Season in Numbers page.
10. Test all 19 players using the same template.
19. Validation
Before statistics are published:
- All 19 players must be processed using the same calculation code.
- Final championship positions and points must match the live standings.
- Event totals must reconcile with stored player event scores.
- Session totals must reconcile with event summaries.
- Driver-selection totals must reconcile with player selection history.
- Missed submissions must match authoritative event history.
- Budget values must use historical snapshots rather than current-state reconstruction.
- Pit Stop winnings must reconcile with the existing Pit Stop Pot totals.
- Ties must not be silently broken unless a rule has been explicitly agreed.
Any unexplained discrepancy should be investigated before publishing the statistic.
20. Current Status
Status: Planning
Agreed:
- Public-facing feature.
- One identical player template for all players.
- All players can view every other player's statistics.
- No login required.
- 2026 full-history export is the primary data source.
- Firestore can supplement missing information.
- A derived public statistics dataset should be used rather than exposing the raw history export.
- Final UI/layout has not yet been designed.
- Statistics and their definitions should be agreed before coding begins.
Next Task
Review the proposed player statistics in this document.
For each statistic:
- Keep
- Remove
- Amend
- Add definition
- Identify source
Once the list is agreed, create a formal calculation specification for the 2026 dataset.


# Season Stats Data Architecture

## Agreed Approach

End-of-season statistics are static historical data.

Once a season is complete, its statistics should not change unless a genuine historical correction is deliberately made.

The public website must therefore **not calculate the full season statistics every time a user opens the page**.

The intended flow is:

```text
Authoritative Full History Export
            +
Any Required Supplemental Historical Data
            ↓
Season Stats Generator
            ↓
Generated Public Season Stats JSON
            ↓
Season in Numbers Website Page
For 2026:
BTCC_2026_Full_History_2026-10-13.json
            ↓
generate-season-stats.js
            ↓
data/season-stats/2026.json
            ↓
Public Season in Numbers page
Public Stats JSON
Create one generated public JSON file for each completed season.
Suggested structure:
data/
└── season-stats/
    ├── 2026.json
    ├── 2027.json
    └── seasons.json
The exact paths may be adjusted to fit the existing repository structure, but the separation between:
- source history
- generator
- generated public data
- website presentation
must be preserved.
Important
Do not hard-code individual player statistics directly inside the page JavaScript.
Bad example:
const players = {
  daniel: {
    championshipPoints: 2030,
    eventWins: 2
  }
};
Player statistics belong in the generated season-data file.
The JavaScript page should be responsible for:
- loading the selected season data
- choosing the selected player
- rendering the common player template
- handling navigation and interaction
The JSON should contain the historical facts.
Season Stats Generator
Create a reusable generator script rather than manually calculating and entering the statistics.
Suggested location:
tools/generate-season-stats.js
The exact filename/location may be adjusted if another location better matches the existing project.
The generator must:
1. Read the authoritative full-history export for the requested season.
2. Calculate all agreed player statistics using the definitions in this document.
3. Calculate agreed season-wide statistics where required.
4. Incorporate approved supplemental historical data where the export is insufficient.
5. Validate important calculations before writing output.
6. Produce the public season JSON.
7. Produce the same schema for every season.
The generator should be deterministic:
The same source data and the same generator version should produce the same season-stat output.

Source Data Must Remain Separate
The full-history export is the authoritative analytical source.
It should not become the public website data file.
The full export may contain information that the Season in Numbers page does not need or should not expose, including:
- Firebase player UIDs
- exact submission timestamps
- engine metadata
- internal processing information
- audit fields
- historical implementation details
The generated public JSON must contain only the information required by the public Season in Numbers feature.
Supplemental Historical Data
Some statistics may require information that is not present in the full-history JSON.
Where this happens:
1. Confirm that the value cannot reliably be derived from the export.
2. Retrieve the value from the appropriate authoritative Firestore record.
3. Preserve that information in a reproducible source rather than manually inserting unexplained final numbers into the generated output.
If required, create a supplemental season source file.
Example:
data/
└── season-stats-source/
    └── 2026-extra.json
Example purpose:
{
  "specialistStandings": {},
  "additionalResultsData": {}
}
This structure is conceptual only.
The exact supplemental schema must be based on the statistics that are genuinely missing.
Do not create supplemental values where the full-history export already contains sufficient authoritative information.
Generated Data Must Not Be Manually Maintained
2026.json should be considered generated output.
Normal changes to player statistics should be made by:
1. correcting the authoritative source data if required,
2. correcting the calculation/definition if required,
3. rerunning the generator.
Avoid manually editing calculated statistics inside 2026.json.
An exception may be made only for a deliberate historical correction where the reason is documented and the source cannot otherwise be preserved.
Suggested Public JSON Structure
The final schema is not yet fixed.
A likely structure is:
{
  "season": 2026,
  "generatedAt": "...",
  "overview": {},
  "players": {
    "steve": {},
    "daniel": {},
    "jake": {}
  }
}
Each player should use the same schema.
Example:
{
  "daniel": {
    "name": "Daniel",
    "championship": {},
    "weekends": {},
    "sessions": {},
    "drivers": {},
    "sld": {},
    "starDrivers": {},
    "budget": {},
    "consistency": {},
    "specialistChampionships": {},
    "fantasyTeam": {},
    "pitStopPot": {},
    "highlights": []
  }
}
This is a conceptual example.
Do not finalise the schema until the player-stat definitions are agreed.
Public Player Identifiers
Public stats should use readable, harmless identifiers such as:
daniel
steve
kaitlin-rose
tegan-aurora
ellie-m
Do not require Firebase Authentication UIDs as public player identifiers.
Player slugs should remain stable once published.
Multi-Season Support
The feature should be designed from the beginning to support future seasons.
The player template should not be written specifically around 2026 data.
Expected future process:
2026 History → Generator → 2026.json
2027 History → Generator → 2027.json
2028 History → Generator → 2028.json
The same page and template should display all supported seasons.
Do not duplicate the Season in Numbers page for each season.
Season Index
A small season index may be used so the website knows which seasons are available.
Conceptual example:
{
  "seasons": [
    {
      "season": 2026,
      "file": "2026.json"
    },
    {
      "season": 2027,
      "file": "2027.json"
    }
  ]
}
This would allow future seasons to be added without changing the player-page logic.
The exact implementation should follow the existing application's architecture.
Historical Corrections
Although completed season data is normally immutable, genuine corrections may occasionally be required.
If a historical correction is made:
1. Identify the authoritative source that is being corrected.
2. Record the reason.
3. Update the correct historical source.
4. Regenerate the season stats.
5. Validate affected players and season-wide records.
6. Commit the regenerated public JSON with the correction.
Do not silently alter an individual number in the public stats file without documenting why.
Generator Validation
Before writing the final public season file, the generator should validate at minimum:
- every active league player is represented
- no unexpected duplicate player IDs/slugs exist
- final Overall points match authoritative season standings
- final Overall positions match authoritative season standings
- player event totals reconcile with event history
- submitted/missed event counts reconcile with event history
- session totals reconcile with stored event summaries
- driver-selection counts reconcile with selection records
- Pit Stop totals reconcile where included
- required fields contain valid values
- no NaN, undefined or accidental internal IDs appear in public output
Generation should fail clearly rather than silently publishing obviously incomplete or inconsistent data.
2027 and Future Seasons
The 2026 implementation should establish the reusable system.
At the end of 2027 the intended process should be approximately:
1. Complete and validate the final 2027 league-history export.
2. Supply any genuinely required supplemental source data.
3. Run the existing season-stat generator for 2027.
4. Validate the generated data.
5. Add 2027.json.
6. Add 2027 to the available-season index.
7. No redesign of the player template should be necessary unless a new league feature genuinely requires new statistics.
The goal is:
Add a season, not rebuild the feature.


That last sentence is probably the bit I'd tattoo onto Codex's forehead:

> **Add a season, not rebuild the feature.**

😂

The other thing I'd now add to our workflow is that when we start defining each stat, we should put a tiny **source + formula** underneath it in the same markdown. For example:

```markdown
**Event Wins**

Source: `playerEventSummaries`

Calculation:

Count rows where:

`eventPosition === 1`

Exclude genuine missed submissions.