# Decision 0002: say what each number is (measured, computed, estimated or unavailable)

- **Status:** proposed (to confirm with UI, Routing and Product)
- **Date:** 2026-11-14
- **Affects:** UI (conditions panel, route panel, provenance), Routing (wording of O₂ and verdict), Data/GIS (`conditions.json`), Product (pitch and video)

## Context

The team was unsure how to show the weather, the dust, the pressure and the O₂: whether they must be live, whether they are simulated, and what the "point of no return" warning means.

What the [challenge page](https://www.spaceappschallenge.org/2026/challenges/interplanetary-survival-guide-martian-map/) says (read on 2026-11-14):

- It describes astronauts who would want "updates on current conditions", but only in the introduction. It does not ask for live or real-time data.
- Its optional considerations say a team may use data from a past period, predicted data for a future period, or no period at all.
- It suggests, as optional, at least three kinds of data and space weather for radiation.
- It does not mention oxygen, suit consumption or any life-support number.

What our data is:

- **MEDA conditions are real measurements, but old.** The latest sol in the PDS release `mars2020_meda-20260811` is 1859 (13 to 14 May 2026 UTC), about six months before the hackathon. There is no live feed. See `docs/conditions.md`.
- **O₂, time and the verdict are our model, not mission data.** The O₂ comes from a walking-speed model (Tobler) and a metabolic-power model (Pandolf, scaled to Mars gravity) with team assumptions for body mass, load and the O₂ available. See `docs/routing-assumptions.md`.
- **Terrain numbers are computed from NASA data:** elevation, slope and distances come from the HiRISE DTM and the app grid. See `docs/terrain-data.md`.

The risk is that a judge reads an estimate or an old measurement as live mission data. `AGENTS.md` (section 7) already asks for provenance on every layer and for "last available data, sol X" instead of "live".

## Decision

1. **Four kinds of number, each with a fixed label.** Every panel, card and tooltip that shows a number carries one of them.

| Kind | Examples | Label (exact text) |
|---|---|---|
| Measured | Pressure, air temperature and humidity of a sol | `Measured · Mars 2020 MEDA · sol 1859 · 13–14 May 2026 UTC · last data available` (sol and dates come from `conditions.json`) |
| Computed from data | Elevation profile, slope, route distance | `Computed from the MRO/HiRISE terrain model` |
| Estimated | Time, O₂, GO / NO-GO, point of no return | `Estimate · model with team assumptions` |
| Unavailable | Wind, dust, any variable with no data | `Unavailable` (with the `reason` from `conditions.json` as a tooltip) |

   Placeholder content keeps the existing `Provisional text (mock)` label.

2. **The conditions panel shows the latest sol as the main reading** (`latest_sol`), with its UTC dates and the min, mean and max of each variable. The other sols may appear as small context, or be left out. The words "live", "current", "now" and "today" are never used for this data. The allowed wording is "last data available".

3. **O₂, time, GO / NO-GO and the point of no return are always labeled as estimates.** The route panel states the key assumptions in one line (O₂ available 0.73 kg from the NASA lunar suit PLSS, 10% kept as reserve; metabolic model scaled to Mars gravity) and points to `docs/routing-assumptions.md`. The tooltip of the warning reads: "First point where the O₂ left is not enough to walk back the cheapest way, under the model's assumptions."

4. **Unavailable means no number.** A variable without data is shown as unavailable and is never filled, estimated or copied from another sol.

5. **Conditions do not change the route.** Temperature and pressure do not enter the O₂ or time calculation today. Linking them is a Could and needs a cited source first.

6. **Pitch wording.** Say "last available MEDA data (sol 1859)" and "estimated O₂ from a metabolic model". Never say "live Mars weather" or "real O₂ data".

## Consequences

- **UI (#51 conditions panel, #53 provenance, route panel):** read `web/public/data/conditions.json` (types in `web/src/types/contract.ts`), show the labels above, and render `status: "unavailable"` as `Unavailable`.
- **Routing:** no change to the model. Texts for the verdict and the point of no return use the estimate wording.
- **Data/GIS:** the radiation reference (#31) follows the same rule: `Measured · Curiosity RAD · Gale crater, not Jezero`. Any new file with a "last data" date records it in the file.
- **Product:** the pitch and the video follow item 6. If a referenced figure for suit O₂ capacity is found, it replaces the 1.0 kg assumption and the label stays "Estimate".

## Open questions

- ~~There is no sourced value for the O₂ a real suit carries.~~ Resolved on 2026-11-15: `DEFAULT_O2_AVAILABLE_KG` is now 0.73 kg, the primary O₂ of NASA's lunar EMU PLSS design (1.6 lbm, NASA NTRS 20160002044). The O₂ use and the verdict are still labeled "Estimate".
- Whether to show the previous two sols or only the latest one is a UI choice.
