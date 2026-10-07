# HoopWire

An offline browser newsroom for Hoop Land saves. Use the local preview server for reliable image composition and browser storage. No API or account is needed. Custom court and advertisement URLs require a connection when composing images; archived images remain available offline.

For a stable local browser address, run `node scripts/serve.cjs` and visit `http://127.0.0.1:8123`. Keep using that address to access the same browser archive.

## News front pages

Home combines active saved leagues; each league News page shows only that league. The shared layout includes a lead feature, supporting stories, headlines, league sections, the latest archived finals, and a static HoopWire TV feature. Coverage uses each league’s latest saved season and covered day, with its preceding two covered days for backfill. Articles open individually with a return link and restored front-page position. Archived coverage remains available after refresh without uploading the save again.

The front pages are modular: `newsroom.js` selects editions without touching the DOM or storage, `newsroom-view.js` renders shared components, and `newsroom.css` owns their responsive styling. `app.js` connects these modules to the archive and navigation. Stable routes are `#newsroom`, `#league/<encoded fingerprint>`, and `#story/<encoded story ID>`; legacy `#league-N` links remain supported.

## Daily coverage

Season milestones are generated automatically on upload alongside daily recaps. Once every team's saved regular-season record reaches the configured schedule length, HoopWire adds a league review, team reviews, final records and total-stat leaders. Award stories require a winner explicitly recorded for this league and year; statistical leaders do not predict awards. Active playoff brackets generate round matchup previews, excluding byes. Recorded team championships or a completed final bracket produce championship reviews and confirmed postseason awards. A save uploaded after these milestones can catch up on the available records, but cannot reconstruct overwritten daily box scores.

Milestone articles have stable league/year/event identities, preserving their original text, images and fact tables across later uploads. They are filed on the latest completed schedule day when first discovered. HoopWire TV reads them again and displays season facts in place of a game box score. Their records, award evidence and brackets are included in archive backups; no audio recording is stored.

Upload a Hoop Land JSON save after a game day. HoopWire immediately opens the newsroom and automatically generates Full coverage for the latest completed day in each league, with fictional quotes enabled. There are no league, coverage, quote, or generation options on upload. Archived text and images stay intact across repeated uploads.

Generation uses one-based day labels. A rest day does not advance the target. Later uploads on a partially played day add newly completed fixtures. Future placeholders, tied results, invalid teams, mismatched winners, and explicitly in-progress games are excluded. Coverage scoring retains its original context calculation; Full coverage includes every eligible completed fixture.

The opening screen contains only the save-upload card. Uploading automatically opens the newsroom; there are no Newsroom or Archive cards. It follows the dark grid, blue panels, and cyan outlines of [Hoop League Studio](https://galileo88.github.io/Hoop-League-Studio/). Newsroom requires a loaded save. Archive and TV require saved stories for the active league; unavailable destinations are disabled and direct links return to the opening screen. Backup import is available inside the archive after entering HoopWire.

## Player-of-the-game stats

Verified award coverage always includes points, rebounds, and assists, including zero values. Positive steals and blocks and valid shooting lines are added when available. Fictional quotes accompany verified stats; they are enabled automatically for new coverage.

Hoop Land preserves each player's latest box score rather than a historical game-by-game archive. On every upload, HoopWire captures box scores only when the player's team has a unique latest completed game on its latest day, the stats contain one game played and valid core counts, and roster points add up to that game's team score. Same-day multiple games are treated as ambiguous. The sample's per-game `POTG` counter is unused and is not used to establish the match.

If stats cannot be verified, the recap stays focused on the teams: it does not name or quote the player of the game or put them in a headline. Uploading saves daily preserves available stats; uploading after several days cannot recover box scores already overwritten by the game.

## Story images

Generation automatically varies the attacking basket between left and right using the story's seed. There is no side selector. Player positions, facing directions, camera crops, and flight balls follow that basket, while custom court artwork and jersey numbers remain readable. The selected side is archived with scene inputs; later uploads do not reroll it. Use image refresh to apply this variety to existing stories.

Hoop structures and player bodies share ground-depth ordering. Rear players draw behind the hoop, front players draw ahead of it, and shadows remain on the floor. Airborne players sort by their ground position. Dunk scenes retain the original front-facing pose with more clearance from the rim. Released balls use the native lined-ball sprite, including interior seams; highlight and shadow values match that sprite's standard palette and adapt to saved ball colors.

Action images select deterministically among drives, close-up ball handling, dunk approaches, three-point shots, passes, and close-up passes. Each has its own player layout and camera crop. The three-point shooter stands beyond the native arc; dunkers have space before the rim. Released shots and passes use the game's separate flight-ball sprite near the release point. They are composed illustrations and do not establish that a particular play occurred.

Interview scenes mix group shots, player close-ups, off-center solo views and player/coach pairs. The press wall repeats the interviewed team’s logo in the background asset’s staggered white guide positions. Smaller league logos fill the alternating gaps when a league logo is saved. Built-in pro logos are bundled; custom image URLs are cached with each archived scene for offline use and backups. Missing logos leave a clean blue backdrop. Close-ups crop the entire composed scene, so the desk, microphones and backdrop scale with the player. Action coverage also includes tighter player portraits while driving, shooting, passing and dunking. Older saved scenes update their framing automatically on archive load without changing article text or stats; a saved custom court image is retained if its source is unavailable.


The ball palette is captured from the league's selected `gameballs[settings.gameBall]`, including `pri`, `sec`, `ter`, and `outline`. Source sprites use five encoded ball colors, including a darker primary shade; the outer-edge marker uses the saved outline instead of orange. Ball colors stay independent of player skin and accessories. Historical fixtures do not retain their ball choice, so these illustrations use the uploaded league's current selection. Missing settings use the save's standard orange/brown palette. Existing asset files are preserved by the extraction script so hand-edited artwork is not overwritten.

Numbers use Hoop Land's native jersey sprites at its body-to-number scale (32 versus 64 pixels per unit). Action compositions retain the finer number layer until the final 2x image, avoiding lost digits during an intermediate downscale. Attackers face the right-hand hoop and defenders face them; jersey text remains readable when players turn.

Each new article has one deterministic still image composed locally from exported Hoop Land textures. Verified player stories get an automatic mix of interview and action scenes, independently of stat availability. Team-only stories use action scenes. Captions distinguish composed illustrations from captured gameplay.

Interview scenes place the featured player between a teammate and the team's head coach, when available, behind a table aligned to their hips. Jersey numbers use readable pixel glyphs. Coaches use the game's staff body and suit layers, with appearance and suit colors from `team.frontOffice.staff` (the unique team-matching person with `pos: 1`). Fictional coach quotes use that head coach's name and are included automatically for new stories. Re-generating latest-day coverage can add coach coverage to earlier articles from the current template.

Action scenes use equally scaled player sprites on the native 1024 Ã— 512 court, with a 2x camera crop rather than giant players on a flattened court. Scenes include up to three players per team from saved rosters, with no referee sprites. Basketball colors have a separate orange palette that is unaffected by accessory or skin colors. Jersey numbers are smaller and centered within the chest. Player appearance, accessories, jersey numbers, team colors, and uniform colors come from the save. Uniform selection defaults to the team's first home or away slot because historical fixtures do not retain actual uniform choices.

The home team's court surface patterns, colors, line settings, court text, and hoop colors are reproduced. Its `court.overlayURL` is loaded with canvas-safe CORS and applied at `overlayLayer`, matching the custom-league court layout. Optional logo settings are also supported. If an image is unavailable, the save's built-in court layout is used and the caption reports the fallback. Neither the save nor its contents are uploaded to the image host.

Player/team inputs, custom-court load results, and final PNGs are saved with articles. Later uploads do not change archived images. **Refresh this day's images** explicitly applies the updated scene renderer without changing article text, statistics, or creation dates. Loading the matching latest-day save lets that refresh add teammates/coaches to older scene inputs; it does not invent missing historical participants.

## HoopWire TV

The HoopWire opening screen handles save uploads. The newsroom displays current coverage without upload controls. The selected league’s **[League Name] Archive** contains an expandable team → year → day list, with actions to read historical stories or watch the corresponding TV episode. Reset Archive confirms before atomically removing only the selected league’s stories, snapshots, studios, and results. Other leagues and the original legacy recovery copy are preserved.

Uploading another league changes the visible archive scope to the league identities in that save. Previous league data remains stored but hidden, including after a reload. Loading the original league restores access. League identity is a fingerprint of the league name, starting year, and team IDs/names; seasons and games are separate beneath that identity. Identical identity fields represent the same league. Renaming those fields can change the identity. The archive export button exports only the selected league.

The **HoopWire TV** tab automatically plays the selected day's stories, then advances to the next story. Its visible buttons are **Previous Story**, **Next Story**, **Pause** (or **Resume** while paused), and **Mute voices**. Below the studio is a box score with archived team logo URLs and verified player stats; it does not display article text or story headlines. A scrolling final-results ticker runs inside the bottom of the studio, using completed games saved for that league, year, and day. Results are preserved across uploads and included in backups. Hover or focus pauses scrolling; reduced-motion preferences show a manually scrollable results strip. Missing historical player stats are labeled unavailable. Logos that cannot load are omitted while team names remain visible.

The four hosts are exclusive HoopWire characters: Maya Brooks, Jordan Price, Andre Cole, and Nina Reyes. They have fixed individual appearances and suits made from game sprite layers. Saved league announcers are never used or renamed as HoopWire hosts.

TV postgame graphics show the final score and one featured player per team: the verified player of the game where applicable, otherwise the scoring leader. Each card shows points, rebounds, assists, steals and blocks, with a compact shooting line when available. Missing player stats are labeled unavailable. Full roster box-score tables are omitted from this broadcast section; verified snapshots remain preserved in the archive.

The studio uses Hoop Land's announcer desk and advertisement graphic, with the loaded league's first configured `frontOffice.adsURL` ad atlas. Sponsor windows fit the artwork's proportions. Studio PNGs, a host-free backdrop, and host/ad inputs are archived per league and season and included in backups, so the TV view works without a loaded save or connection afterward.

Hosts discuss archived stories in speech bubbles using locally bundled [animalese.js](https://github.com/Acedio/animalese.js). Maya and Nina have higher voices than Jordan and Andre, with a distinct pitch for each host. Only the speaking host bobs, behind the desk foreground. Pausing or leaving TV stops playback and movement. **Mute voices** on the TV page saves an audio preference for future visits. Reduced-motion preferences disable bobbing. If browser autoplay restrictions or unavailable samples prevent audio, the discussion continues with silent speech bubbles.

Episodes open with the supplied HoopWire TV logo, red diagonal panels, a motion grid and a final wipe into the studio. The animation follows the theme's actual playback position and reveals the hosts only when the music ends. Speech bubbles are empty and hidden until the show starts. Pausing freezes both music and graphics; resuming continues from the same position. Changing stories cancels the opening. The existing mute control also mutes the theme. Unavailable theme audio uses an 8.5-second silent opening; reduced-motion preferences use a static logo slate for the same playback period.

After the theme, Maya welcomes viewers and all four hosts introduce themselves before discussing the selected story. The episode closes with a wrap-up and sign-off, then returns to the HoopWire TV logo with a thanks-for-watching message. Speech bubbles are cleared from the ending screen. Replay begins again with the theme and welcome.

Article and studio image URLs are reused across redraws. Pending image loads retain their URLs; obsolete images are released after loading and after they leave both the current archive data and the page. Reloading TV rebuilds URLs from preserved image blobs rather than relying on links from the previous page.

The library and samples are pinned to an upstream revision in `vendor/animalese/UPSTREAM.txt`. The bundled code is MIT licensed, RIFFWAVE is public domain, and Josh Simmons's voice samples are credited under CC BY 4.0 in the TV view and bundled license file.

`player-renderer.js`, `player-assets/`, and `court/` adapt the existing HoopLeagueStudio player/court preview work. `scene-assets/manifest.json` records the additional source textures. To re-extract scene textures for the inspected game build, install UnityPy and Pillow in a development environment and run:

```text
python scripts/extract-scene-assets.py "C:/Program Files (x86)/Steam/steamapps/common/Hoop Land/Hoop Land_Data/data.unity3d"
```

The extraction reads the installed game and writes only project scene assets. The browser needs no Python or asset-extraction packages.

## Persistent archive and backups

Articles, verified stat snapshots, league labels, scene inputs, and PNG blobs live in IndexedDB (`hoopwire.daily.v1`). Story IDs retain the original form:

```text
<save fingerprint>:<season>:game:<gId>
```

Loading another save or season does not clear the archive. The archive is available before loading a save. Existing stories are preserved; a current-template team recap on the latest day can be upgraded when verified stats become available. Its original quote preference and creation date are retained. Older migrated articles keep their original text.

The original `hoopwire.archive.v1` localStorage archive migrates into season/day categories in an atomic transaction, with its original localStorage copy retained for recovery. Legacy archives without league labels get a placeholder label until a matching save is loaded.

**Export archive** downloads a JSON backup containing images and snapshots. **Import archive** validates and merges that backup without replacing existing records. A failed write or invalid import does not report success or partially replace archived data.

Browser storage belongs to the browser and site origin. Keep exported backups when moving browsers/computers, changing the local server address, or clearing browser data.

## Development checks

```text
node tests/core.test.cjs
node tests/browser.cjs
node tests/scenes.cjs [path-to-custom-save.json]
node tests/broadcast.cjs [path-to-custom-save.json]
node tests/broadcast-content.test.cjs
node tests/dialogue-browser.cjs
node tests/intro-browser.cjs
```

The browser checks require Playwright resolvable through Node's package lookup (or `NODE_PATH`) and an installed Edge browser. Set `HOOPWIRE_BROWSER=chrome` to use Chrome instead. They use temporary isolated profiles, without touching user browser data. The main browser suite starts a temporary local server; scene checks use the running preview at port 8123 (override with `HOOPWIRE_URL`). An optional real custom save verifies its actual remote courts and advertisements.

Checks cover completed-game validation, zero stats, absent/ambiguous box scores, sample-save award recipients, coach identity and quote toggles, frozen articles and images across uploads, current-day upgrades, archive reload without a save, migration, backup round trips including TV studios, invalid imports, transactional rollback, storage failures, custom court/advertisement URLs, exclusive hosts, group interviews, image refreshes, TV controls, and mobile layout. Browser screenshots are written to ignored `artifacts/`.

Season reviews read year-specific team and player statistics directly from the uploaded save. Team features use only that team’s player stints; league leaders combine stints within the same league and year. Articles and TV include per-game averages, shooting percentages and counting totals. Re-uploading a save preserves previously archived season stories, their text, dates and composed images.

In-season coverage uses `records-coverage.js`: current game recaps can include season-to-date averages and totals plus league-scoped career totals from the uploaded player histories. Record watches compare with prior-season totals and career leaders in those histories; they expire for a completed regular season and use stable event IDs. Matched current game stats establish milestone crossings. Native `league.records` entries establish league and team player single-game marks, including retained record entries when the full box score is unavailable. Regular-season, playoff and Finals record books remain separate. No sample league names, years or results are built into generation.

Team scoring season highs and lows require the complete regular-season schedule to date. Personal career-high stories use the save’s high fields. A high-only record book cannot establish personal lows; those are not inferred from high lists or incomplete archived box scores. Historical leader comparisons are limited to player history retained in the uploaded save. Archived articles preserve their source evidence, text and image; they never supply cumulative stat totals.

Game-generated news is also a source of stories. `news-coverage.js` uses the NewsData event types verified from the installed game's metadata: signings, releases, waivers, completed trades, injuries and returns, draft selections/declarations, commitments, contract options/extensions, trade requests, retirement announcements and completed retirements, Hall of Fame inductions, jersey retirements, and coach hires/releases/firings/retirements. It resolves player identities from rosters, free agents, retirees and Hall of Fame entries, and coaches from staff/coach records. Unknown events or missing identities are not guessed. Salary units and injury diagnoses are not inferred.

The news window follows the upload's current phase and latest completed day through the current day, including rest days; a phase whose day counter has reset uses its current day. Original event date/phase/payload are preserved, and articles are filed on the reporting day. News flags such as `read` do not change story identity. Game-result news remains represented by game recaps; award and championship announcements share milestone IDs to avoid duplicate stories. These articles and their illustrations participate in TV, archives and backups alongside daily coverage.

Season quotes reflect the saved winning percentage and confirmed championships. These editorial changes apply only to newly generated stories; existing archived stories are not revised. Articles contain selected statistics in prose, without league or roster stat tables. TV season facts are limited to five rows; complete source snapshots remain internal archive evidence.

Routine season reporting leads with per-game averages (points, rebounds, assists and available minutes) and shooting percentages. Scoring leaders are ranked by points per game; category leaders use their respective per-game averages, across the player histories present in the save. Full counting totals are used for record watches, milestone crossings and record comparisons. Native playing-time totals are converted from seconds before reporting minutes per game. Team features use team-specific stints. Existing archived articles retain their original text; TV builds the revised discussion when a story is opened.

TV hosts introduce the result, name the verified player and react to specific scoring, shooting, rebounding or passing numbers. Double-doubles and triple-doubles require the verified counts. Brief news items use the actual report rather than padding every story with four generic reactions. Editorial references include [ESPN's Wembanyama statistical feature](https://www.espn.com/nba/story/_/id/39515346/victor-wembanyama-triple-double-numbers), [ESPN's Nuggets–Magic recap](https://www.espn.com/nba/recap/_/gameId/401810232), and [NBA.com's reporting on Inside the NBA's panel conversations](https://www.nba.com/news/charles-barkley-round-mound-of-profound-sound). Dialogue is original and does not invent observed plays from a box score.
