(() => {
  "use strict";

  const STORAGE_KEY = "hoopwire.archive.v1";
  const TEMPLATE_VERSION = 2;

  const state = {
    raw: null,
    leagueIndex: 0,
    fingerprint: "",
    candidates: []
  };

  const el = {
    saveFile: document.getElementById("saveFile"),
    fileName: document.getElementById("fileName"),
    leagueSelect: document.getElementById("leagueSelect"),
    weekSelect: document.getElementById("weekSelect"),
    coverageSelect: document.getElementById("coverageSelect"),
    quoteToggle: document.getElementById("quoteToggle"),
    weekSummary: document.getElementById("weekSummary"),
    generateButton: document.getElementById("generateButton"),
    clearWeekButton: document.getElementById("clearWeekButton"),
    feed: document.getElementById("feed"),
    status: document.getElementById("status"),
    template: document.getElementById("articleTemplate")
  };

  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(36);
  }

  function choose(seed, values, salt = "") {
    const index = parseInt(hashString(seed + "|" + salt), 36) % values.length;
    return values[index];
  }

  function safeArchiveRead() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function archiveWrite(archive) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
      return true;
    } catch {
      showStatus("Browser storage is unavailable. Stories were generated, but duplicate prevention will not persist after closing the page.");
      return false;
    }
  }

  function showStatus(message) {
    el.status.textContent = message;
    el.status.classList.remove("hidden");
  }

  function clearStatus() {
    el.status.textContent = "";
    el.status.classList.add("hidden");
  }

  function assertSave(data) {
    if (!data || !Array.isArray(data.seasonLeagues) || data.seasonLeagues.length === 0) {
      throw new Error("This file does not contain a Hoop Land seasonLeagues array.");
    }
  }

  function teamDisplay(team) {
    if (!team) return "Unknown Team";
    const city = (team.city || "").trim();
    const name = (team.name || team.shortName || "Team").trim();
    return city ? `${city} ${name}` : name;
  }

  function playerDisplay(player) {
    if (!player) return "the player of the game";
    return [player.fn, player.ln].filter(Boolean).join(" ").trim() || "the player of the game";
  }

  function lastName(player) {
    return (player && player.ln) ? player.ln : playerDisplay(player);
  }

  function recordText(record) {
    if (!Array.isArray(record) || record.length < 2) return "—";
    return `${record[0]}-${record[1]}`;
  }

  function percentage(record) {
    if (!Array.isArray(record) || record.length < 2) return .5;
    const games = record[0] + record[1];
    return games ? record[0] / games : .5;
  }

  function pregameRecord(postRecord, wasWinner) {
    if (!Array.isArray(postRecord) || postRecord.length < 2) return [0, 0];
    return [
      Math.max(0, postRecord[0] - (wasWinner ? 1 : 0)),
      Math.max(0, postRecord[1] - (wasWinner ? 0 : 1))
    ];
  }

  function getLeague() {
    return state.raw.seasonLeagues[state.leagueIndex];
  }

  function buildLookups(league) {
    const teams = new Map();
    const players = new Map();

    for (const team of league.teams || []) {
      teams.set(team.id, team);
      for (const player of team.roster || []) players.set(player.id, player);
    }
    for (const player of league.freeAgents || []) players.set(player.id, player);

    const newsByGame = new Map();
    for (const item of (league.season && league.season.news) || []) {
      if (item.category === 1 && item.type === 9 && item.gid > 0) {
        newsByGame.set(item.gid, item);
      }
    }

    const latestDayByTeam = new Map();
    const schedule = (league.season && league.season.schedule) || [];
    schedule.forEach((day, dayIndex) => {
      for (const game of day.results || []) {
        if (Number.isFinite(game.homeScore) && Number.isFinite(game.awayScore) && game.winner >= 0) {
          latestDayByTeam.set(game.homeTeam, dayIndex);
          latestDayByTeam.set(game.awayTeam, dayIndex);
        }
      }
    });

    return { teams, players, newsByGame, latestDayByTeam };
  }

  function buildFingerprint(league) {
    const teams = (league.teams || [])
      .map(t => `${t.id}:${t.shortName || ""}:${t.name || ""}`)
      .sort()
      .join("|");
    const season = league.season || {};
    return hashString(`${league.leagueName}|${season.startingYear}|${teams}`);
  }

  function coverageThreshold(level) {
    if (level === "major") return 80;
    if (level === "standard") return 65;
    return 0;
  }

  function gameContext(game, dayIndex, league, lookups) {
    const home = lookups.teams.get(game.homeTeam);
    const away = lookups.teams.get(game.awayTeam);
    const winner = lookups.teams.get(game.winner);
    const loser = game.winner === game.homeTeam ? away : home;
    const winnerIsHome = game.winner === game.homeTeam;

    const winnerScore = winnerIsHome ? game.homeScore : game.awayScore;
    const loserScore = winnerIsHome ? game.awayScore : game.homeScore;
    const winnerRecord = winnerIsHome ? game.homeRecord : game.awayRecord;
    const loserRecord = winnerIsHome ? game.awayRecord : game.homeRecord;
    const winnerPre = pregameRecord(winnerRecord, true);
    const loserPre = pregameRecord(loserRecord, false);
    const winnerPreGames = winnerPre[0] + winnerPre[1];
    const loserPreGames = loserPre[0] + loserPre[1];

    const margin = Math.abs(winnerScore - loserScore);
    const close = margin <= 3;
    const blowout = margin >= 12;
    const upset =
      winnerPreGames >= 5 &&
      loserPreGames >= 5 &&
      percentage(winnerPre) + 0.15 < percentage(loserPre);

    const news = lookups.newsByGame.get(game.gId);
    const nativeRating = news ? Number(news.rating || 0) : 5;
    let importance = nativeRating * 5;
    if (close) importance += 10;
    if (blowout && margin >= 15) importance += 5;
    if (upset) importance += 20;
    if (game.gameType && game.gameType !== 0) importance += 25;

    const potg = lookups.players.get(game.potg);
    const potgStatsTrusted =
      potg &&
      lookups.latestDayByTeam.get(potg.tid) === dayIndex &&
      potg.gameStats &&
      potg.gameStats.GP === 1;

    const season = league.season || {};
    return {
      game,
      dayIndex,
      dayNumber: dayIndex + 1,
      week: Math.floor(dayIndex / 7) + 1,
      seasonYear: season.currentYear || season.startingYear || "Season",
      home,
      away,
      winner,
      loser,
      winnerName: teamDisplay(winner),
      loserName: teamDisplay(loser),
      winnerScore,
      loserScore,
      winnerRecord,
      loserRecord,
      winnerPre,
      loserPre,
      margin,
      close,
      blowout,
      upset,
      importance,
      nativeRating,
      potg,
      potgName: playerDisplay(potg),
      potgStatsTrusted
    };
  }

  function formatStatLine(stats) {
    if (!stats) return "";
    const parts = [];
    if (stats.PTS > 0) parts.push(`${stats.PTS} point${stats.PTS === 1 ? "" : "s"}`);
    if (stats.REB >= 2) parts.push(`${stats.REB} rebound${stats.REB === 1 ? "" : "s"}`);
    if (stats.AST >= 2) parts.push(`${stats.AST} assist${stats.AST === 1 ? "" : "s"}`);
    if (stats.STL >= 2) parts.push(`${stats.STL} steal${stats.STL === 1 ? "" : "s"}`);
    if (stats.BLK >= 2) parts.push(`${stats.BLK} block${stats.BLK === 1 ? "" : "s"}`);

    if (!parts.length) return "";
    if (parts.length === 1) return parts[0];
    if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
    return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
  }

  function gameType(ctx) {
    if (ctx.upset) return "Upset";
    if (ctx.close) return "Close game";
    if (ctx.blowout) return "Statement win";
    return "Game recap";
  }

  function headline(ctx, seed) {
    if (ctx.upset) {
      return choose(seed, [
        `${ctx.winnerName} knocks off ${ctx.loserName} in ${ctx.winnerScore}-${ctx.loserScore} win`,
        `${ctx.winnerName} delivers upset of ${ctx.loserName}`,
        `${ctx.winnerName} stuns ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`
      ], "headline-upset");
    }

    if (ctx.close) {
      return choose(seed, [
        `${ctx.winnerName} edges ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`,
        `${ctx.winnerName} slips past ${ctx.loserName} in close finish`,
        `${ctx.winnerName} holds off ${ctx.loserName} by ${ctx.margin}`
      ], "headline-close");
    }

    if (ctx.blowout) {
      return choose(seed, [
        `${ctx.winnerName} rolls past ${ctx.loserName} in ${ctx.margin}-point win`,
        `${ctx.winnerName} handles ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`,
        `${ctx.winnerName} pulls away from ${ctx.loserName} in convincing win`
      ], "headline-blowout");
    }

    if (ctx.potg) {
      return choose(seed, [
        `${ctx.potgName} helps ${ctx.winnerName} past ${ctx.loserName}`,
        `${ctx.winnerName} beats ${ctx.loserName} behind ${lastName(ctx.potg)}`,
        `${ctx.winnerName} tops ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`
      ], "headline-normal");
    }

    return `${ctx.winnerName} beats ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}`;
  }

  function fictionalQuote(ctx, seed) {
    if (ctx.close) {
      return choose(seed, [
        "We knew it was going to be a battle, so the biggest thing was staying composed.",
        "Games like that come down to a few possessions, and we found a way to finish.",
        "We had to stay with it all the way through, and we did enough to get the win."
      ], "quote-close");
    }
    if (ctx.upset) {
      return choose(seed, [
        "We respected the matchup, but our focus was on playing our game and competing every possession.",
        "We came in believing we could get the job done, and everybody stayed together.",
        "The result matters, but the biggest thing was how connected we were as a group."
      ], "quote-upset");
    }
    if (ctx.blowout) {
      return choose(seed, [
        "We came out focused and kept the pressure on.",
        "It was a complete team effort, and we stayed with what was working.",
        "Everybody contributed, and that is the kind of effort we want to build on."
      ], "quote-blowout");
    }
    return choose(seed, [
      "We did what we needed to do and came away with the result we wanted.",
      "The biggest thing was staying together and making the right plays.",
      "It was a good team effort, and now we have to keep building from it."
    ], "quote-normal");
  }

  function paragraphOne(ctx, seed) {
    const winnerRecord = recordText(ctx.winnerRecord);
    const loserRecord = recordText(ctx.loserRecord);

    if (ctx.upset) {
      return choose(seed, [
        `${ctx.winnerName} pulled off the upset with a ${ctx.winnerScore}-${ctx.loserScore} victory over ${ctx.loserName}. The result moved ${ctx.winnerName} to ${winnerRecord}, while ${ctx.loserName} fell to ${loserRecord}.`,
        `${ctx.winnerName} entered the matchup behind ${ctx.loserName} in the standings but came away with a ${ctx.winnerScore}-${ctx.loserScore} win. The victory improved ${ctx.winnerName} to ${winnerRecord}.`
      ], "p1-upset");
    }

    if (ctx.close) {
      return choose(seed, [
        `${ctx.winnerName} escaped with a ${ctx.winnerScore}-${ctx.loserScore} victory over ${ctx.loserName}, with only ${ctx.margin} point${ctx.margin === 1 ? "" : "s"} separating the teams. The win moved ${ctx.winnerName} to ${winnerRecord}.`,
        `Little separated ${ctx.winnerName} and ${ctx.loserName}, but ${ctx.winnerName} came away with a ${ctx.winnerScore}-${ctx.loserScore} victory. ${ctx.loserName} fell to ${loserRecord} with the loss.`
      ], "p1-close");
    }

    if (ctx.blowout) {
      return choose(seed, [
        `${ctx.winnerName} had little trouble with ${ctx.loserName}, earning a ${ctx.winnerScore}-${ctx.loserScore} victory. The ${ctx.margin}-point win moved ${ctx.winnerName} to ${winnerRecord}.`,
        `${ctx.winnerName} controlled the scoreboard in a ${ctx.winnerScore}-${ctx.loserScore} win over ${ctx.loserName}. ${ctx.winnerName} improved to ${winnerRecord}, while ${ctx.loserName} moved to ${loserRecord}.`
      ], "p1-blowout");
    }

    return choose(seed, [
      `${ctx.winnerName} picked up a ${ctx.winnerScore}-${ctx.loserScore} victory over ${ctx.loserName}. The win moved ${ctx.winnerName} to ${winnerRecord}, while ${ctx.loserName} fell to ${loserRecord}.`,
      `${ctx.winnerName} defeated ${ctx.loserName} ${ctx.winnerScore}-${ctx.loserScore}, adding another win to its season. The result put ${ctx.winnerName} at ${winnerRecord}.`
    ], "p1-normal");
  }

  function paragraphTwo(ctx, seed, quotesEnabled) {
    if (!ctx.potg) {
      return `${ctx.winnerName} finished the night with the player-of-the-game honor going to its winning side. The result was decided by a ${ctx.margin}-point margin.`;
    }

    const stats = ctx.potgStatsTrusted ? formatStatLine(ctx.potg.gameStats) : "";
    const firstSentence = stats
      ? `${ctx.potgName} was named player of the game after finishing with ${stats}.`
      : `${ctx.potgName} was named player of the game for ${ctx.winnerName}.`;

    if (!quotesEnabled) {
      return `${firstSentence} ${ctx.winnerName} finished with a ${ctx.margin}-point advantage on the scoreboard.`;
    }

    const quote = fictionalQuote(ctx, seed);
    return `${firstSentence} "${quote}" ${lastName(ctx.potg)} said.`;
  }

  function paragraphThree(ctx, seed) {
    const wr = ctx.winnerRecord || [0, 0];
    const lr = ctx.loserRecord || [0, 0];
    const winnerRecord = recordText(wr);
    const loserRecord = recordText(lr);

    return choose(seed, [
      `The win improved ${ctx.winnerName} to ${winnerRecord}, while ${ctx.loserName} fell to ${loserRecord}.`,
      `${ctx.winnerName} moved to ${winnerRecord} with the victory. ${ctx.loserName} dropped to ${loserRecord}.`,
      `With the victory, ${ctx.winnerName} picked up its ${wr[0]}${ordinalSuffix(wr[0])} win of the season and improved to ${winnerRecord}. ${ctx.loserName} fell to ${loserRecord}.`
    ], "p3");
  }

  function ordinalSuffix(value) {
    const n = Math.abs(Number(value));
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return "th";
    if (n % 10 === 1) return "st";
    if (n % 10 === 2) return "nd";
    if (n % 10 === 3) return "rd";
    return "th";
  }

  function optionalParagraph(ctx, seed) {
    if (ctx.upset) {
      return `${ctx.winnerName} entered the game with a lower pregame winning percentage than ${ctx.loserName}, making the result one of the more notable outcomes of the week so far.`;
    }
    if (ctx.close) {
      return `The ${ctx.margin}-point final margin made it one of the tighter results of Week ${ctx.week} so far.`;
    }
    if (ctx.margin >= 15) {
      return `${ctx.winnerName}'s ${ctx.margin}-point margin was large enough to qualify as one of the week's more decisive results so far.`;
    }
    return "";
  }

  function generateArticle(ctx, fingerprint, quotesEnabled) {
    const id = `${fingerprint}:${ctx.seasonYear}:game:${ctx.game.gId}`;
    const seed = id;
    const paragraphs = [
      paragraphOne(ctx, seed),
      paragraphTwo(ctx, seed, quotesEnabled),
      paragraphThree(ctx, seed)
    ];
    const extra = optionalParagraph(ctx, seed);
    if (extra) paragraphs.push(extra);

    return {
      id,
      fingerprint,
      season: ctx.seasonYear,
      week: ctx.week,
      day: ctx.dayNumber,
      gid: ctx.game.gId,
      type: gameType(ctx),
      importance: ctx.importance,
      headline: headline(ctx, seed),
      paragraphs,
      templateVersion: TEMPLATE_VERSION,
      createdAt: new Date().toISOString()
    };
  }

  function collectCandidates() {
    if (!state.raw) return [];
    const league = getLeague();
    const lookups = buildLookups(league);
    const week = Number(el.weekSelect.value);
    const threshold = coverageThreshold(el.coverageSelect.value);
    const start = (week - 1) * 7;
    const end = Math.min(start + 7, (league.season.schedule || []).length);
    const candidates = [];

    for (let dayIndex = start; dayIndex < end; dayIndex++) {
      const day = league.season.schedule[dayIndex];
      for (const game of (day && day.results) || []) {
        const completed =
          Number.isFinite(game.homeScore) &&
          Number.isFinite(game.awayScore) &&
          game.winner !== undefined &&
          game.winner >= 0;

        if (!completed) continue;
        const ctx = gameContext(game, dayIndex, league, lookups);
        if (ctx.importance >= threshold) candidates.push(ctx);
      }
    }

    candidates.sort((a, b) => b.importance - a.importance || b.game.gId - a.game.gId);
    return candidates;
  }

  function currentArchiveStories() {
    const archive = safeArchiveRead();
    return Object.values(archive).filter(story => story.fingerprint === state.fingerprint);
  }

  function renderWeekSummary() {
    if (!state.raw || !el.weekSelect.value) return;
    state.candidates = collectCandidates();
    const archive = safeArchiveRead();
    const already = state.candidates.filter(ctx => {
      const story = archive[`${state.fingerprint}:${ctx.seasonYear}:game:${ctx.game.gId}`];
      return story && story.templateVersion === TEMPLATE_VERSION;
    }).length;
    const newCount = state.candidates.length - already;

    const league = getLeague();
    const week = Number(el.weekSelect.value);
    const start = (week - 1) * 7 + 1;
    const end = Math.min(week * 7, league.season.schedule.length);

    el.weekSummary.innerHTML =
      `<strong>${league.season.currentYear || league.season.startingYear} — Week ${week}</strong><br>` +
      `Days ${start}–${end}<br>` +
      `Eligible stories: <strong>${state.candidates.length}</strong> &nbsp; ` +
      `Already archived: <strong>${already}</strong> &nbsp; ` +
      `New stories: <strong>${newCount}</strong>`;
    el.weekSummary.classList.remove("hidden");
    el.generateButton.textContent = newCount ? `Generate ${newCount} new/updated ${newCount === 1 ? "story" : "stories"}` : "No new stories";
    el.generateButton.disabled = newCount === 0;
    el.clearWeekButton.disabled = already === 0;
    renderArchivedWeek();
  }

  function renderStories(stories) {
    el.feed.innerHTML = "";
    if (!stories.length) {
      el.feed.innerHTML = `<div class="panel muted">No archived stories for this week yet.</div>`;
      return;
    }

    for (const story of stories) {
      const node = el.template.content.cloneNode(true);
      node.querySelector(".article-meta").textContent =
        `${story.type} • Season ${story.season} • Week ${story.week} • Day ${story.day} • Importance ${story.importance}`;
      node.querySelector(".article-headline").textContent = story.headline;
      const body = node.querySelector(".article-body");
      for (const paragraph of story.paragraphs) {
        const p = document.createElement("p");
        p.textContent = paragraph;
        body.appendChild(p);
      }
      el.feed.appendChild(node);
    }
  }

  function renderArchivedWeek() {
    if (!state.raw || !el.weekSelect.value) return;
    const week = Number(el.weekSelect.value);
    const stories = currentArchiveStories()
      .filter(story => story.week === week)
      .sort((a, b) => b.importance - a.importance || b.gid - a.gid);
    renderStories(stories);
  }

  function generateNewStories() {
    clearStatus();
    const archive = safeArchiveRead();
    let added = 0;

    for (const ctx of state.candidates) {
      const article = generateArticle(ctx, state.fingerprint, el.quoteToggle.checked);
      const existing = archive[article.id];
      if (existing && existing.templateVersion === TEMPLATE_VERSION) continue;
      archive[article.id] = article;
      added++;
    }

    archiveWrite(archive);
    showStatus(added ? `Generated or updated ${added} ${added === 1 ? "story" : "stories"}.` : "Nothing new was generated.");
    renderWeekSummary();
  }

  function clearCurrentWeek() {
    if (!state.raw) return;
    const archive = safeArchiveRead();
    const week = Number(el.weekSelect.value);
    let removed = 0;

    for (const [id, story] of Object.entries(archive)) {
      if (story.fingerprint === state.fingerprint && story.week === week) {
        delete archive[id];
        removed++;
      }
    }

    archiveWrite(archive);
    showStatus(`Removed ${removed} archived ${removed === 1 ? "story" : "stories"} from Week ${week}.`);
    renderWeekSummary();
  }

  function populateLeagues() {
    el.leagueSelect.innerHTML = "";
    state.raw.seasonLeagues.forEach((league, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = `${league.leagueName || "League"} (${league.shortName || index + 1})`;
      el.leagueSelect.appendChild(option);
    });
    el.leagueSelect.disabled = false;
    configureLeague();
  }

  function configureLeague() {
    state.leagueIndex = Number(el.leagueSelect.value || 0);
    const league = getLeague();
    state.fingerprint = buildFingerprint(league);

    const scheduleLength = (league.season && league.season.schedule || []).length;
    const weekCount = Math.max(1, Math.ceil(scheduleLength / 7));
    const currentDay = Math.min(
      Math.max(0, Number((league.season && league.season.currentDay) || 0)),
      Math.max(0, scheduleLength - 1)
    );
    const currentWeek = Math.floor(currentDay / 7) + 1;

    el.weekSelect.innerHTML = "";
    for (let week = 1; week <= weekCount; week++) {
      const start = (week - 1) * 7 + 1;
      const end = Math.min(week * 7, scheduleLength);
      const option = document.createElement("option");
      option.value = String(week);
      option.textContent = `Week ${week} — Days ${start}–${end}`;
      if (week === currentWeek) option.selected = true;
      el.weekSelect.appendChild(option);
    }

    el.weekSelect.disabled = false;
    el.coverageSelect.disabled = false;
    el.quoteToggle.disabled = false;
    el.generateButton.disabled = false;
    renderWeekSummary();
  }

  async function loadSave(file) {
    clearStatus();
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      assertSave(parsed);
      state.raw = parsed;
      el.fileName.textContent = file.name;
      populateLeagues();
    } catch (error) {
      state.raw = null;
      el.fileName.textContent = "Could not load save";
      showStatus(`Save load failed: ${error.message}`);
      el.leagueSelect.disabled = true;
      el.weekSelect.disabled = true;
      el.coverageSelect.disabled = true;
      el.quoteToggle.disabled = true;
      el.generateButton.disabled = true;
      el.clearWeekButton.disabled = true;
    }
  }

  el.saveFile.addEventListener("change", event => {
    const file = event.target.files && event.target.files[0];
    if (file) loadSave(file);
  });

  el.leagueSelect.addEventListener("change", configureLeague);
  el.weekSelect.addEventListener("change", renderWeekSummary);
  el.coverageSelect.addEventListener("change", renderWeekSummary);
  el.quoteToggle.addEventListener("change", () => {
    // Existing archived stories stay unchanged; the setting applies only to newly generated stories.
  });
  el.generateButton.addEventListener("click", generateNewStories);
  el.clearWeekButton.addEventListener("click", clearCurrentWeek);
})();
