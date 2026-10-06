# HoopWire MVP

A dependency-free, browser-only prototype for generating offline sports-news stories from Hoop Land save files.

## What this first version does

- Loads a Hoop Land JSON save locally in the browser.
- Supports multiple leagues in one save.
- Divides the Hoop Land schedule into selectable 7-day weeks.
- Uses Hoop Land's built-in game news rating plus game context to rank stories.
- Provides Major, Standard, and Full coverage levels.
- Creates deterministic game-recap headlines and at least 3 article paragraphs.
- Can insert fictional player quotes that are intentionally generic enough not to contradict known game data.
- Uses the save's player-of-the-game ID.
- Uses exact player box-score stats only when the selected game is the player's latest team game in the save; older historical game box scores are not preserved reliably in the sample save.
- Stores generated story IDs and article text in browser localStorage.
- Skips already-generated stories, preventing duplicate game stories when a week is revisited.
- Works without an API, model, database, or internet connection.

## Run it

The app has no dependencies.

1. Open `index.html` in a modern browser.
2. Click **Load Hoop Land save**.
3. Choose the league, week, and coverage level.
4. Click **Generate new stories**.

If your browser restricts storage when opening local files directly, run a tiny local server instead:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

The save file never needs to leave your machine.

## Story IDs

Game stories use this general identity:

```text
<save fingerprint>:<season>:game:<gId>
```

The fingerprint is derived from the league name, starting year, and team identities. This reduces collisions between different Hoop Land universes while allowing later exports of the same universe to recognize stories already generated.

## Coverage scoring

The prototype starts with Hoop Land's own game-news `rating` and adds bonuses for:

- close games
- large margins
- likely upsets
- non-regular-season game types

Default thresholds:

- Major: 80+
- Standard: 65+
- Full: 0+

These values are intentionally easy to tune in `app.js`.

## Important limitation discovered in the supplied save

The schedule preserves historical results, player-of-the-game IDs, and after-game team records. Player objects contain a `gameStats` object, but it represents the player's latest game rather than a complete historical box-score archive.

Because of that, HoopWire only prints a player stat line when it can conservatively identify the selected game as that player's team's latest completed game. For older games it still names the player of the game, but does not invent their stat line.

## Recommended next development steps

1. Add transaction, injury, contract, award, and standings story generators from `season.news`.
2. Add weekly roundup and power-ranking templates.
3. Add an editable template library in a separate JSON file.
4. Move the archive from localStorage to IndexedDB for a larger long-term newsroom archive.
5. Add export/import for the generated news archive.
6. Add team/player pages and filtering.
7. Add a template preview/editor so phrasing can be customized without changing JavaScript.

## Article time perspective

Template version 2 treats every article as if it is being published immediately after the event.

Preferred phrasing includes:

- "The win improved Drift to 9-18."
- "The Spartans fell to 11-17."
- "Drift moved to 9-18 with the victory."

Retrospective phrases such as "at that point in the season," "had won 9 of 27 games," and "left the matchup at 11-17" are intentionally avoided.

Existing archived game stories created with the earlier template version are automatically eligible to be regenerated with the current wording.
