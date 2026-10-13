# End-of-Season Player Stats

## Purpose

Add a public **Season Stats** area to the BTCC Fantasy League website.

Anyone should be able to select a player and view their 2026 season statistics.

Example:

Steve → Steve's stats  
Daniel → Daniel's stats  
Sue → Sue's stats

No login is required.

The same layout and statistics should be used for every player.

---

# Source of Truth

The primary source for 2026 is:

`BTCC_2026_Full_History_2026-10-13.json`

This is the completed 2026 Full League History export.

Use the historical values stored in the export.

Do not recreate historical values from current driver/player state where historical data already exists.

The main datasets used are:

- `playerEventSummaries`
- `playerDriverSelections`
- `players`
- `events`
- `pitStopRounds`
- `pitStopPlayerTotals`

If a wanted statistic is not contained in the Full History export, retrieve it once from the existing season-end Firestore data and preserve it as a small supplemental source file.

The public website should not query Firestore live to calculate historical 2026 statistics.

---

# Player Header

Show:

- Player name
- Final championship position
- Final championship points
- Gap to champion
- Fantasy team name, if applicable

Daniel was not assigned to a fantasy team in 2026.

---

# Championship

Show:

- Final position
- Final points
- Gap to champion
- Events entered
- Events missed
- Event wins
- Event podiums
- Top 6 event finishes
- Average event score
- Average event finishing position
- Highest event score and event
- Lowest entered-event score and event
- Longest Top 6 streak
- Longest podium streak

Missed events are not included in averages.

A missed event breaks a consecutive-event streak.

Use the historical event positions stored in the export.

---

# Championship Journey

Show:

- Championship position after Event 1
- Best championship position reached
- Lowest championship position reached
- Biggest position gain between events
- Biggest position loss between events
- Final championship position

Also provide the event-by-event championship positions needed for a championship journey graph.

Use the stored historical championship position after each event.

Do not reconstruct the championship table.

---

# Session Performance

Show season totals for:

- Qualifying
- Race 1
- Race 2
- Race 3

Also show:

- Strongest session
- Qualifying wins
- Race 1 wins
- Race 2 wins
- Race 3 wins
- Highest single-session score and where it occurred

Strongest session should use average points per entered event.

If multiple players share the highest fantasy score in a session, each counts as a session winner.

---

# Driver Selections

Show:

- Total driver selections
- Number of different drivers used
- Most-selected driver
- Number of times selected
- Driver who earned the player the most total points
- Total points earned from that driver
- Highest-scoring single driver selection
- Event where that selection occurred
- Most-selected High-tier driver
- Most-selected Middle-tier driver
- Most-selected Low-tier driver
- Average team size
- Most common team size

Use each driver's historical tier at the event where they were selected.

Do not use their final/current tier to rewrite earlier selections.

If multiple drivers tie for a statistic, preserve the tie.

---

# Season Long Driver

Show:

- SLD driver
- Number of entered events where the SLD was used
- Total SLD points
- Average SLD points
- Best SLD event
- Best SLD event score

If the player did not have an SLD, display **None**.

A missed event does not count as an SLD appearance.

---

# Star Drivers

For the Underdog Driver show:

- Number of selections
- Total points
- Average points
- Best selection
- Best score

For the Form Driver show:

- Number of selections
- Total points
- Average points
- Best selection
- Best score

Also show:

- Total Star Driver selections

Star Driver points are part of the player's normal driver points.

They are not additional bonus points.

---

# Budget

Show:

- Starting base budget
- Final base budget
- Highest base budget
- Lowest base budget
- Overall base-budget change
- Average team spend
- Average unused budget
- Closest the player came to spending their full available budget
- Number of events with exactly £0.00 remaining
- Biggest base-budget increase
- Biggest base-budget decrease

Starting base budget for 2026 was £10.00.

Base-budget statistics should not include Budget Boost.

Event spending statistics should use the actual effective budget available for that event.

---

# Consistency

Show:

- Median event score
- Event score range
- Population standard deviation of entered-event scores

Do not create a custom "Consistency Rating" in version 1.

---

# Specialist Championships

Show final position and final points for:

- WingFoot
- Race 1 Championship
- Race 2 Championship
- Race 3 Championship
- Manufacturer Championship
- Independents Championship
- Jack Sears Championship

These should come from the existing authoritative season-end standings.

If these values are not present in the Full History export, preserve them in the supplemental season-end source data.

Do not rebuild specialist championships specifically for this feature if an authoritative final table already exists.

---

# Fantasy Team

Show:

- Fantasy team name
- Final team championship position
- Final team championship points

Nobody changed fantasy team during the 2026 season.

Daniel was not assigned to a fantasy team because the player numbers would have produced unequal teams.

For Daniel display:

`Fantasy Team: None`

Final team standings should come from the authoritative season-end team standings.

---

# Pit Stop Pot

Show:

- Total money won
- Final Pit Stop earnings rank
- Number of rounds where the player received a payout
- Biggest payout
- Round/event of biggest payout
- Full-pot wins

No player won the full Pit Stop Pot jackpot during 2026.

All accumulated pots ultimately reached the checkpoint shared payouts at rounds 10, 20 and 30.

Therefore all players have:

`Full-pot wins: 0`

for 2026.

---

# Basic Rules

For the completed 2026 season:

- A submitted team always returned positive fantasy points.
- Identify missed submissions using `missedSubmission === true`.
- Missed submissions are excluded from entered-event averages.
- Missed submissions break streaks.
- Historical positions should be used as stored.
- Historical driver tiers should be used as stored.
- Ties should be preserved rather than arbitrarily broken.
- Money should be handled accurately to the penny.
- Missing/not-applicable data should not be invented.

The 2026 missed-event penalty system never became operational and is not part of these statistics.

---

# Public Data

The website should use a small generated static file such as:

`data/season-stats/2026.json`

The Full History export should not be downloaded directly by every website visitor.

A small generator can read the trusted source data and produce the public season-stat file.

The generated public data should contain only information required by the Season Stats page.

Do not expose:

- Firebase UIDs
- submission timestamps
- engine audit data
- internal metadata
- other private/internal fields

Each player should have a stable public slug, for example:

- `steve`
- `daniel`
- `kaitlin-rose`
- `ellie-c`

---

# Website Behaviour

The public Season Stats page should:

1. Show the available players.
2. Allow any player to be selected.
3. Display that player's season statistics.
4. Use the same layout for all players.
5. Work without login.
6. Be suitable for mobile and desktop.
7. Allow future seasons to use the same feature with a different season data file.

Example route:

`#season-stats/daniel`

The exact visual design can be decided during implementation.

---

# Version 1 Scope

Version 1 should concentrate on the statistics listed in this document.

Do not add additional experimental statistics during the initial build.

Possible future additions can be considered after the core Season Stats page is working and its data has been validated.

## Additional Implementation Notes

### Tier Statistics

High/Middle/Low driver-selection statistics apply from Event 2 onward.

Event 1 is excluded because the tier-balance selection rules did not apply at Event 1.

Any missing historical tier values from Events 2–10 must be recovered from an authoritative historical source and placed in the supplemental source data.

Do not substitute current/final driver tiers.

If reliable historical tier data cannot be recovered, omit the affected tier statistic rather than infer it.

### Missed Submissions

Use the explicit `missedSubmission` field to identify missed events.

Do not infer a missed submission solely from a zero event score.

### Missed Events and Budgets

A missed event does not change the player's base budget.

The previous base budget carries forward unchanged to the next event.

For entered events:

`baseBudgetChange = budgetAfterEvent - startingBudget`

For missed events:

`baseBudgetChange = 0`

### Public Player Slugs

Use a small explicit mapping between the 19 2026 player names and their public slugs.

Do not expose Firebase player IDs in public URLs or generated public data.

### Pit Stop Full-Pot Wins

Calculate full-pot wins from the historical `pitStopRounds` data.

Do not hardcode zero wins into the public page.

All calculated full-pot win totals happen to be zero for 2026.

### Event 1 Tier Rules

Event 1 was a free-selection event.

The normal High/Middle/Low tier-balance restrictions did not apply.

The only relevant Event 1 constraints were:

- the £10.00 starting budget
- any player's chosen Season Long Driver, where applicable

Therefore Event 1 should be excluded from High/Middle/Low selection statistics.

Tier-based selection statistics begin from Event 2.