# HoopWire basketball voice

HoopWire reads like a major sports site and sounds like a morning debate show. The reader and the viewer know basketball: modern jargon is welcome (bucket, the glass, boards, from deep, a two-way night, ball security, a one-possession game, off the bench, closeout game) and nothing needs a definition. Numbers are the evidence; the feel is qualitative. Never over-explain, and never mention simulation, data generation or these rules.

Interpret first, report second. Pick the strongest supported angle, lead with it, and let ordinary results stay ordinary.

## Evidence

Every claim comes from the save, derived once and shared by the article and the desk (`story.facts` for games).

- **Game facts** (`core.js`): score, margin, home team, box scores for both teams, the slate's widest margin, season records, streaks and recent form computed from the save's own schedule, the regular-season head-to-head, and last season's record.
- **Playoff games** carry the *series* record in the game's home/away records. Season records come from the team's season line. The series facts (round name, game number, best-of, series score, clinch, sweep, decider, a team saving its season) come from the bracket plus that game. A Finals or title-game clinch establishes the champion.
- **Streaks** require a complete record chain in the schedule. Missing games suppress them.
- **Scale.** Judgments scale with the league's scoring. In a 25-point game, nine points is "nine of Logan's 25" and a big night. Close (three points or fewer) is absolute: a possession is a possession.
- A box score never establishes plays, effort, tactics, injuries, crowd or timing. A close final is not a comeback or a buzzer-beater.

## Articles

Wire style. The lede is one sentence: result plus who drove it. Then context, the star's line, the supporting cast and the one box-score edge that separated the teams, then quotes.

- First reference is full ("the Logan Wolverines", "Daniel Hodge"). After that, use the city or the nickname and the last name. Headlines use bare nicknames in present tense ("Wolverines stun Cactus 25-11").
- Verbs agree with the nickname: plural for "Wolverines", singular for "Thunder", "Cactus" or "Drift". A city is singular ("Logan has won three straight").
- AP numbers: spell out zero through nine for counts, figures for scores, records and shooting splits ("4-of-9 shooting"). The higher score always comes first.
- Quotes put the attribution after the first sentence: “We stayed together,” Hodge said. “That's what this group does.”
- **Playoff recaps** lead with the series: "to even their first-round series at two games apiece", "to complete a four-game sweep", "to force a Game 7". Context says what's next: who can close it out, who faces elimination, "it's a best-of-three from here", who advances, whose season ends.
- **Regular-season context**: streaks of three or more, snapped streaks, the season series, and "had the better record coming in".

## The desk

| Host | Role | Voice |
| --- | --- | --- |
| Maya Brooks | Runs the show | Opens with the score and tosses to someone by name; short pivots; brief sign-offs |
| Jordan Price | The take | Confident, loud, sometimes wrong; defends volume scorers; wants flowers |
| Andre Cole | The floor | Sees the whole game; credits the supporting cast; checks Jordan |
| Nina Reyes | The numbers | Efficiency, sample size, series math; deflates overreaction |

These are original personalities. Don't borrow real broadcasters' catchphrases. Hosts address each other by first name, react in a few words ("Come on.", "Is it wrong, though?"), and never answer themselves: consecutive lines from one host are merged. They debate when the numbers support two readings (a volume night on poor shooting, a one-possession win, an upset, a 3-1 series). When the evidence points one way, they agree and add something.

Angle priority for games: consequence (title, elimination), series state, upset, a night exceptional *for that player*, a streak of five or more, a huge margin, a shorter streak, a blowout, a close game, a routine win. A player is introduced by full name once, then by last name. Routine segments run 6–9 turns; major ones up to 14; thin ones 2–6.

## Players worth a story

A performance story runs when a sports desk would look twice, not when a percentage moves.

- **Breakouts** need a line that's big for this league (bars written for a 110-point game and scaled by real scoring, with absolute floors because small counts are noisy). The line must also be well above the player's average. Deep-bench players with tiny averages qualify only with a line that's news on its own.
- **Quiet nights** are news only for a team's top two scorers (or its top rebounder), well below their average.
- **Turnovers** count for starters with a genuinely sloppy night; **cold shooting** counts for a go-to scorer on real volume.
- The player of the game belongs to the recap. At most one performance story per team per game, and only the strongest nights on a busy slate.
- Compare with the season *before* the game (playoffs use the regular season). Never print a percentage or the trigger. Describe the role: "the team's leading scorer at 25.0 points a game", "has come off the bench for most of the season".

## Season, awards and the offseason

- **Awards** each lead with their own evidence: MVP with the full line and team record, Finals MVP or Most Outstanding Player with Finals numbers, DPOY with blocks, steals and team defense rank, Rookie of the Year with starts, Sixth Man with games off the bench, Most Improved with last season against this one, stat titles with their category. Mention other awards won the same year. All-Star selections don't get individual stories.
- **Championship** stories tell the run: "outlasted the Peaks in seven games in the first round … then swept the Colonials for the title", plus the Finals MVP.
- **Team reviews** include how the season ended (the round, the opponent, the series score) and the change from last season. The headline carries the record, so the rest of it says what the record can't: a title, a deep run, where the season ended, a winning team left out of the field, a big swing from last season, the team's identity, or where it ranks: the college poll from the save ("No. 6 in the poll", "unranked"), or for pro leagues the power rankings in Hoop Land's own standings order (wins, then fewer games played, then this season's head-to-head wins, then point differential per game in whole points; teams level on all four have no defined order in the game). The save's team `rnk` is that rank taken just before each team's latest game, so it lags and is not used. The college poll in the save is the game's formula: 10 per win, minus 15 per loss, plus 10 per win and 5 per loss against the Top 25, plus 10 times the team's overall rating. Never "16th in the league". Never "a winning season" after a winning record.
- **Mid-round playoff coverage** is a daily "where every series stands" tracker with real series scores. A preview runs only before a round tips off.
- **Roundups.** The draft becomes one draft-night story, with lottery picks and their college averages and an Andre "steal" when a later pick out-scored the top pick in college. Four or more signings, commitments or draft declarations in a day become one roundup led by the biggest names. A day of rookie contracts is a line, not a feed.

## Continuity

Articles keep their archived prose; TV reads the archived facts. Raising `editorialVersion` lets a reloaded save rewrite the latest day's stories in the current voice, keeping their images. Performance stories archived under the old percentage rule are judged again when the archive loads: real news is rewritten (with playoff or title stakes recovered from archived results and championship news) and noise is removed. Deploys stamp script and stylesheet URLs with the commit so browsers never run cached code.
