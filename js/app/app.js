/* App controller: save loading, archive, newsroom, story pages and HoopWire TV. */
(() => {
  'use strict';
  const C = window.HoopWireCore;
  const archive = new window.HoopWireArchive();
  const el = Object.fromEntries(
    [
      'saveFile',
      'fileName',
      'archiveLeague',
      'archiveSeason',
      'archiveDay',
      'exportButton',
      'importFile',
      'feed',
      'status',
      'articleTemplate',
      'refreshImagesButton',
      'tvStudio',
      'tvStudioCaption',
      'archiveTitle',
      'archiveLeagueSwitch',
      'archiveTree',
      'siteMenuButton',
      'siteMenu',
      'menuUploadSave',
      'menuLoadLatest',
      'saveFolder',
      'saveFolderNew',
      'saveFolderKnown',
      'saveFolderName',
      'saveSlotChoice',
      'saveSlots',
      'chooseSaveFolder',
      'loadLatestSave',
      'changeSaveFolder',
      'resetArchive',
      'resetDialog',
      'resetTitle',
      'resetDescription',
      'cancelReset',
      'confirmReset',
      'historicalTitle',
      'leagueButtons',
      'newsroomLeague',
      'newsroomLeagueLabel',
      'archiveTeam',
      'newsroomDay',
      'tvStorySelect',
      'tvPrevious',
      'tvNext',
      'tvSegment',
      'tvTicker',
      'tvDeskForeground',
      'tv',
    ].map(id => [id, document.getElementById(id)])
  );
  const state = {
    scope: null,
    saveFolder: null,
    raw: null,
    leagueIndex: 0,
    stories: new Map(),
    snapshots: new Map(),
    leagues: [],
    ready: false,
    busy: false,
  };
  const imageURLs = new Map();
  const frontScroll = new Map(),
    storyOrigins = new Map();
  try {
    for (const [id, value] of JSON.parse(sessionStorage.getItem('hoopwire-story-origins') || '[]'))
      storyOrigins.set(id, value);
  } catch {}
  function routeData(hash = location.hash) {
    try {
      if (hash.startsWith('#story/')) return { kind: 'story', id: decodeURIComponent(hash.slice(7)) };
      if (hash.startsWith('#league/')) return { kind: 'front', fingerprint: decodeURIComponent(hash.slice(8)) };
      const old = hash.match(/^#league-(\d+)$/);
      if (old) {
        const i = Number(old[1]),
          raw = state.raw?.seasonLeagues[i];
        return {
          kind: 'front',
          fingerprint: raw ? C.buildFingerprint(raw) : state.scope?.[i] || accessibleLeagues()[i]?.id || '',
        };
      }
    } catch {
      return { kind: 'missing' };
    }
    if (hash === '#newsroom') return { kind: 'front', fingerprint: null };
    return { kind: ['#archive', '#stories', '#tv'].includes(hash) ? hash.slice(1) : 'welcome' };
  }
  const leagueHref = id => '#league/' + encodeURIComponent(id);
  const storyHref = id => '#story/' + encodeURIComponent(id);

  function pruneImageURLs() {
    const live = new Set([...state.stories.values()].map(s => s.imageBlob));
    for (const league of state.leagues)
      for (const studio of Object.values(league.studios || {})) {
        live.add(studio.imageBlob);
        live.add(studio.backdropBlob);
      }
    const displayed = new Set([...document.images].map(img => img.getAttribute('src')));
    for (const [blob, item] of imageURLs)
      if (item.ready && !live.has(blob) && !displayed.has(item.url)) {
        URL.revokeObjectURL(item.url);
        imageURLs.delete(blob);
      }
  }
  function imageURL(blob) {
    let item = imageURLs.get(blob);
    if (!item) {
      item = { url: URL.createObjectURL(blob), ready: false, probe: new Image() };
      imageURLs.set(blob, item);
      // Keep a pending URL alive even when rapid redraws detach its image. A
      // completed load can safely release obsolete archive versions afterward.
      item.probe.onload = item.probe.onerror = () => {
        item.ready = true;
        item.probe = null;
        pruneImageURLs();
      };
      item.probe.src = item.url;
    }
    return item.url;
  }
  // iOS Safari can drop an IndexedDB-backed image while the app sits in the
  // background; scrolling back to it re-reads a blob URL that no longer
  // resolves. Rebuild that image once: copy the bytes into memory, or read the
  // record from the archive again, then point every reference at the copy.
  const recovering = new WeakSet();
  async function freshBlob(blob) {
    try {
      return new Blob([await blob.arrayBuffer()], { type: blob.type || 'image/png' });
    } catch {}
    for (const story of state.stories.values())
      if (story.imageBlob === blob) {
        const again = await archive.get('stories', story.id).catch(() => null);
        if (again?.imageBlob) {
          story.imageBlob = new Blob([await again.imageBlob.arrayBuffer()], {
            type: again.imageBlob.type || 'image/png',
          });
          return story.imageBlob;
        }
      }
    for (const league of state.leagues)
      for (const [season, studio] of Object.entries(league.studios || {}))
        for (const key of ['imageBlob', 'backdropBlob'])
          if (studio[key] === blob) {
            const again = (await archive.get('leagues', league.id).catch(() => null))?.studios?.[season]?.[key];
            if (again) {
              studio[key] = new Blob([await again.arrayBuffer()], { type: again.type || 'image/png' });
              return studio[key];
            }
          }
    return null;
  }
  function replaceBlob(old, copy) {
    for (const story of state.stories.values()) if (story.imageBlob === old) story.imageBlob = copy;
    for (const league of state.leagues)
      for (const studio of Object.values(league.studios || {}))
        for (const key of ['imageBlob', 'backdropBlob']) if (studio[key] === old) studio[key] = copy;
  }
  document.addEventListener(
    'error',
    async event => {
      const img = event.target;
      if (!(img instanceof HTMLImageElement) || recovering.has(img)) return;
      const src = img.getAttribute('src') || '';
      if (!src.startsWith('blob:')) return;
      const entry = [...imageURLs].find(([, item]) => item.url === src);
      if (!entry) return;
      recovering.add(img);
      const [old] = entry,
        copy = await freshBlob(old);
      if (!copy) return;
      replaceBlob(old, copy);
      imageURLs.delete(old);
      const url = imageURL(copy);
      for (const other of document.images) if (other.getAttribute('src') === src) other.src = url;
      URL.revokeObjectURL(src);
    },
    true
  );
  function status(message) {
    el.status.textContent = message;
    el.status.classList.remove('hidden');
  }
  function selectedLeague() {
    return state.raw?.seasonLeagues[state.leagueIndex];
  }
  function pending() {
    const league = selectedLeague();
    if (!league) return [];
    const fingerprint = C.buildFingerprint(league);
    return C.candidates(league, fingerprint, state.snapshots, 'full').filter(ctx =>
      C.shouldGenerate(state.stories.get(C.storyId(fingerprint, ctx.seasonYear, ctx.game.gId)), ctx)
    );
  }
  function accessibleLeagues() {
    return state.leagues.filter(l => !state.scope || state.scope.includes(l.id));
  }
  function accessibleStories() {
    return [...state.stories.values()].filter(s => !state.scope || state.scope.includes(s.fingerprint));
  }
  function canOpen(route) {
    if (!state.ready) return false;
    if (route === '#newsroom' || route.startsWith('#league/')) return !!state.raw || accessibleStories().length > 0;
    if (['#archive', '#stories', '#tv'].includes(route)) return accessibleStories().length > 0;
    return true;
  }
  function controls() {
    document.getElementById('welcome').classList.toggle('has-save', !!state.raw);
    for (const link of document.querySelectorAll('a[href="#newsroom"],a[href="#archive"],a[href="#tv"]')) {
      const disabled = !canOpen(link.getAttribute('href'));
      if (disabled) {
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
      } else {
        link.removeAttribute('aria-disabled');
        link.removeAttribute('tabindex');
      }
    }
    for (const tab of el.archiveLeagueSwitch.querySelectorAll('button')) tab.disabled = state.busy || !state.ready;
    el.menuUploadSave.disabled = state.busy || !state.ready;
    for (const button of [
      el.chooseSaveFolder,
      el.loadLatestSave,
      el.changeSaveFolder,
      el.menuLoadLatest,
      ...el.saveSlots.querySelectorAll('button'),
    ])
      button.disabled = state.busy || !state.ready;
    options(
      el.newsroomLeague,
      (state.raw?.seasonLeagues || []).map((l, i) => [i, l.leagueName || `League ${i + 1}`]),
      state.leagueIndex
    );
    el.newsroomLeague.disabled = state.busy || !state.ready || !state.raw;
    const navLeagues = accessibleLeagues().map(l => window.HoopWireNewsroom.leagueInfo(l, accessibleStories()));
    const buttonState = JSON.stringify([
      navLeagues.map(l => [l.id, l.name, l.shortName, l.leagueType]),
      location.hash,
      state.busy,
    ]);
    if (el.leagueButtons.dataset.state !== buttonState) {
      el.leagueButtons.dataset.state = buttonState;
      el.leagueButtons.replaceChildren();
      navLeagues
        .sort((a, b) => (a.leagueType ?? 2) - (b.leagueType ?? 2))
        .forEach(league => {
          const link = document.createElement('a');
          link.textContent = `${league.shortName || league.name} News`;
          link.href = leagueHref(league.id);
          link.title = league.name;
          if (routeData().fingerprint === league.id) link.setAttribute('aria-current', 'page');
          if (state.busy || !state.ready) {
            link.setAttribute('aria-disabled', 'true');
            link.tabIndex = -1;
          }
          el.leagueButtons.append(link);
        });
    }
    el.saveFile.disabled = state.busy || !state.ready;
    el.resetArchive.disabled = state.busy || !state.ready || !state.stories.size;
    for (const button of el.archiveTree.querySelectorAll('button')) button.disabled = state.busy;
    el.exportButton.disabled = state.busy || !state.ready;
    el.importFile.disabled = state.busy || !state.ready;
    el.refreshImagesButton.disabled = state.busy || !state.ready || !selectedStories().some(s => s.sceneInputs);
    const storyCount = selectedStories().length;
    el.tvStorySelect.disabled = state.busy || !storyCount;
    const index = Number(el.tvStorySelect.value || 0);
    el.tvPrevious.disabled = state.busy || index <= 0;
    el.tvNext.disabled = state.busy || index >= storyCount - 1;
    for (const item of [el.archiveLeague, el.archiveSeason, el.archiveDay])
      item.disabled = state.busy || !item.options.length;
  }
  async function run(action) {
    if (state.busy) return;
    state.busy = true;
    controls();
    let failed = false;
    try {
      await action();
    } catch (error) {
      failed = true;
      status(`${error.message} Nothing was confirmed as archived. Your existing archive has been retained.`);
    } finally {
      state.busy = false;
      controls();
      if (routeData().kind === 'front') {
        render();
        if (!failed) el.status.classList.add('hidden');
      }
    }
  }
  async function readArchive() {
    const [stories, snapshots, leagues] = await Promise.all([
      archive.all('stories'),
      archive.all('snapshots'),
      archive.all('leagues'),
    ]);
    const repaired = window.HoopWireSeason.repairSeasonReviews(stories, state.raw?.seasonLeagues || []);
    if (repaired.length) {
      await archive.write({ stories: repaired });
      const replacements = new Map(repaired.map(s => [s.id, s]));
      for (let i = 0; i < stories.length; i++) stories[i] = replacements.get(stories[i].id) || stories[i];
    }
    // Performance stories from the old percentage rule are re-judged once.
    const stale = stories.filter(s => s.performanceSnapshot && Number(s.editorialVersion || 0) < 3);
    if (stale.length) {
      const kept = [],
        dropped = [];
      for (const s of stale) {
        // Old stories saved no series facts; the archived results and title news still know the stakes.
        const league = leagues.find(l => l.id === s.fingerprint),
          context = window.HoopWireBroadcastContext.buildContext(s, { league, stories });
        const known = {
          playoffs: context.game?.tRound > 0,
          title: context.consequence?.kind === 'championship',
          college: league?.leagueType === 1,
        };
        const next = window.HoopWirePerformance.rejudge(s, known);
        if (next) kept.push(next);
        else dropped.push(s.id);
      }
      if (kept.length) await archive.write({ stories: kept });
      await archive.remove('stories', dropped);
      const replacements = new Map(kept.map(s => [s.id, s])),
        gone = new Set(dropped);
      for (let i = stories.length - 1; i >= 0; i--) {
        if (gone.has(stories[i].id)) stories.splice(i, 1);
        else stories[i] = replacements.get(stories[i].id) || stories[i];
      }
    }
    const refreshed = await window.HoopWireScenes.refreshFraming(stories, leagues);
    if (refreshed.length) {
      await archive.write({ stories: refreshed });
      const replacements = new Map(refreshed.map(s => [s.id, s]));
      for (let i = 0; i < stories.length; i++) stories[i] = replacements.get(stories[i].id) || stories[i];
    }
    state.stories = new Map(stories.map(s => [s.id, s]));
    state.snapshots = new Map(snapshots.map(s => [s.id, s]));
    state.leagues = leagues;
    if (state.scope === null) {
      const saved = await archive.get('meta', 'active-leagues');
      if (Array.isArray(saved?.ids)) state.scope = saved.ids;
    }
  }
  function options(select, items, preferred) {
    select.replaceChildren();
    for (const [value, label] of items) {
      const option = document.createElement('option');
      option.value = String(value);
      option.textContent = label;
      select.appendChild(option);
    }
    if (items.some(([value]) => String(value) === String(preferred))) select.value = String(preferred);
  }
  function archiveNavigation(
    fingerprint = el.archiveLeague.value,
    season = el.archiveSeason.value,
    day = el.archiveDay.value
  ) {
    const leagues = accessibleLeagues();
    if (!leagues.some(l => l.id === fingerprint)) {
      fingerprint = leagues.find(l => [...state.stories.values()].some(s => s.fingerprint === l.id))?.id;
    }
    options(
      el.archiveLeague,
      leagues.map(l => [l.id, l.name]),
      fingerprint
    );
    const stories = [...state.stories.values()].filter(s => s.fingerprint === el.archiveLeague.value);
    const seasons = [...new Set(stories.map(s => String(s.season)))].sort((a, b) =>
      b.localeCompare(a, undefined, { numeric: true })
    );
    options(
      el.archiveSeason,
      seasons.map(y => [y, `Season ${y}`]),
      season
    );
    const days = [...new Set(stories.filter(s => String(s.season) === el.archiveSeason.value).map(s => s.day))].sort(
      (a, b) => b - a
    );
    options(
      el.archiveDay,
      days.map(d => [d, `Day ${d}`]),
      day
    );
    const teamEntries = new Map();
    for (const story of stories.filter(s => String(s.season) === el.archiveSeason.value)) {
      for (const team of storyTeams(story)) if (team?.id != null) teamEntries.set(String(team.id), team.name);
    }
    options(el.archiveTeam, [['', 'All teams'], ...teamEntries.entries()], el.archiveTeam.value);
    renderArchiveTree();
    render();
    renderTV();
    controls();
  }
  function storyTeams(story) {
    if (story.relatedTeams) return story.relatedTeams;
    if (story.gameSummary) return [story.gameSummary.away, story.gameSummary.home];
    const teams = [story.sceneInputs?.team, story.sceneInputs?.opponent]
      .filter(Boolean)
      .map(t => ({ ...t, name: C.teamDisplay(t) }));
    return teams.length ? teams : [{ id: 'unassigned', name: 'Unassigned stories' }];
  }
  function renderArchiveTree() {
    const expanded = new Set([...el.archiveTree.querySelectorAll('details[open]')].map(d => d.dataset.key));
    el.archiveTree.replaceChildren();
    const league = state.leagues.find(l => l.id === el.archiveLeague.value);
    el.archiveTitle.textContent = `${league?.name || 'League'} Archive`;
    const leagues = accessibleLeagues();
    el.archiveLeagueSwitch.hidden = leagues.length < 2;
    el.archiveLeagueSwitch.replaceChildren(
      ...leagues.map(l => {
        const tab = document.createElement('button');
        tab.type = 'button';
        tab.dataset.league = l.id;
        tab.setAttribute('aria-label', l.name);
        const short = window.HoopWireNewsroom.leagueInfo(l, accessibleStories()).shortName || l.name;
        for (const [cls, text] of [
          ['tab-full', l.name],
          ['tab-short', short],
        ]) {
          const span = document.createElement('span');
          span.className = cls;
          span.textContent = text;
          tab.append(span);
        }
        tab.setAttribute('aria-pressed', String(l.id === el.archiveLeague.value));
        tab.disabled = state.busy;
        tab.addEventListener('click', () => {
          if (l.id !== el.archiveLeague.value) archiveNavigation(l.id, '', '');
        });
        return tab;
      })
    );
    const teams = new Map();
    for (const story of state.stories.values())
      if (story.fingerprint === el.archiveLeague.value)
        for (const team of storyTeams(story)) {
          const key = `${story.fingerprint}:${team.id}`;
          if (!teams.has(key))
            teams.set(key, {
              ...team,
              fingerprint: story.fingerprint,
              league: story.leagueName || state.leagues.find(l => l.id === story.fingerprint)?.name,
              years: new Map(),
            });
          const entry = teams.get(key),
            year = String(story.season);
          if (!entry.years.has(year)) entry.years.set(year, new Set());
          entry.years.get(year).add(story.day);
        }
    if (!teams.size) {
      const empty = document.createElement('p');
      empty.className = 'muted';
      empty.textContent = 'No saved coverage yet. Load a save to start your archive.';
      el.archiveTree.append(empty);
      return;
    }
    for (const team of [...teams.values()].sort((a, b) => a.name.localeCompare(b.name))) {
      const branch = document.createElement('details');
      branch.className = 'archive-team';
      branch.dataset.key = `${team.fingerprint}:${team.id}`;
      branch.open = expanded.has(branch.dataset.key);
      const summary = document.createElement('summary');
      const name = document.createElement('strong');
      name.textContent = team.name;
      summary.append(name);
      branch.append(summary);
      for (const [year, days] of [...team.years].sort((a, b) =>
        b[0].localeCompare(a[0], undefined, { numeric: true })
      )) {
        const season = document.createElement('details');
        season.className = 'archive-year';
        season.dataset.key = `${branch.dataset.key}:${year}`;
        season.open = expanded.has(season.dataset.key);
        const heading = document.createElement('summary');
        heading.textContent = year;
        season.append(heading);
        for (const day of [...days].sort((a, b) => b - a)) {
          const row = document.createElement('div');
          row.className = 'archive-day';
          const label = document.createElement('strong');
          label.textContent = `Day ${day}`;
          row.append(label);
          for (const [text, route] of [
            ['Read stories', '#stories'],
            ['Watch TV', '#tv'],
          ]) {
            const button = document.createElement('button');
            button.textContent = text;
            button.addEventListener('click', () => {
              archiveNavigation(team.fingerprint, year, day);
              el.archiveTeam.value = String(team.id);
              el.tvStorySelect.value = '0';
              el.historicalTitle.textContent = `${team.name} · ${year} · Day ${day}`;
              location.hash = route;
              view();
            });
            row.append(button);
          }
          season.append(row);
        }
        branch.append(season);
      }
      el.archiveTree.append(branch);
    }
  }
  function renderEdition(fingerprint) {
    const edition = window.HoopWireNewsroom.buildEdition({
      stories: accessibleStories(),
      leagues: accessibleLeagues(),
      fingerprint,
    });
    window.HoopWireNewsroomView.render(el.feed, edition, {
      imageURL,
      storyHref,
      busy: state.busy,
      caption: window.HoopWireScenes.caption,
      paragraphs: window.HoopWireSeason.articleParagraphs,
      onWatch(story) {
        state.tvRequestedStory = story.id;
        el.archiveTeam.value = '';
        archiveNavigation(story.fingerprint, String(story.season), String(story.day));
        location.hash = '#tv';
      },
    });
  }
  function render() {
    el.feed.replaceChildren();
    const route = routeData();
    el.feed.classList.toggle('front-page', route.kind === 'front');
    if (route.kind === 'front') {
      renderEdition(route.fingerprint);
      pruneImageURLs();
      return;
    }
    const stories =
      route.kind === 'story'
        ? [state.stories.get(route.id)].filter(s => s && accessibleStories().some(a => a.id === s.id))
        : selectedStories();
    if (route.kind === 'story') {
      const back = document.createElement('a');
      back.className = 'article-back text-action';
      const origin = storyOrigins.get(route.id);
      back.href = origin?.route || (stories[0] ? leagueHref(stories[0].fingerprint) : '#newsroom');
      back.textContent = '← Back to coverage';
      el.feed.append(back);
    }
    if (!stories.length) {
      const empty = document.createElement('div');
      empty.className = 'panel muted';
      empty.textContent =
        route.kind === 'story'
          ? 'This story is not available in the active archive.'
          : state.busy && state.raw
            ? 'Preparing your league’s daily coverage…'
            : 'No archived stories for this selection yet. Load a save and generate daily stories to begin.';
      if (route.kind === 'story') {
        for (const [label, href] of [
          ['Home', '#newsroom'],
          ['Archive', '#archive'],
        ]) {
          const a = document.createElement('a');
          a.href = href;
          a.textContent = label;
          a.className = 'text-action';
          empty.append(document.createTextNode(' '), a);
        }
      }
      el.feed.appendChild(empty);
      pruneImageURLs();
      return;
    }
    const storiesForLabels = [...state.stories.values()];
    for (const story of stories) {
      const node = el.articleTemplate.content.cloneNode(true);
      node.querySelector('.article-meta').textContent = tvStoryKicker(story);
      const league = state.leagues.find(l => l.id === story.fingerprint),
        info = league ? window.HoopWireNewsroom.leagueInfo(league, storiesForLabels) : null;
      node.querySelector('.article-byline').textContent =
        `HoopWire Staff · ${info?.leagueType === 0 ? 'Pro · ' : info?.leagueType === 1 ? 'College · ' : ''}${info?.shortName || info?.name || story.leagueName || ''} · ${story.season} · Day ${story.day}`;
      node.querySelector('.article-headline').textContent = story.headline;
      const figure = node.querySelector('.article-image');
      if (story.imageBlob) {
        const url = imageURL(story.imageBlob);
        const caption = window.HoopWireScenes.caption(story.sceneInputs, story) || story.imageCaption || story.headline;
        const image = figure.querySelector('img');
        image.src = url;
        image.alt = caption;
        figure.querySelector('figcaption').textContent = caption;
      } else figure.remove();
      const paragraphs = window.HoopWireSeason.articleParagraphs(story);
      const reviewLists = story.type === 'Regular-season review' ? window.HoopWireSeason.seasonReviewLists(story) : [];
      for (const text of paragraphs) {
        const p = document.createElement('p');
        p.textContent = text;
        node.querySelector('.article-body').appendChild(p);
      }
      const body = node.querySelector('.article-body');
      if (story.kind === 'season' && story.type !== 'Regular-season review') {
        const graphic = tvSeasonGraphic(story, 10);
        if (graphic.childElementCount) {
          graphic.classList.add('article-graphic');
          body.append(graphic);
        }
      } else if (story.gameSummary || story.gid != null) {
        const extra = [performanceBoard(story), postgameBoard(story)].filter(Boolean);
        if (extra.length) {
          const graphic = document.createElement('div');
          graphic.className = 'tv-season-graphic article-graphic';
          graphic.append(...extra);
          body.append(graphic);
        }
      }
      for (const group of reviewLists) {
        const section = document.createElement('section');
        section.className = 'season-summary';
        const heading = document.createElement('h3');
        heading.textContent = group.label;
        if (Array.isArray(group.headers) && group.headers.length && Array.isArray(group.rows) && group.rows.length) {
          section.append(
            statBoard({
              kicker: `${story.season} season`,
              title: group.label,
              headers: group.headers,
              rows: group.rows,
            })
          );
        } else {
          const list = document.createElement('ul');
          list.className = 'season-summary-list';
          for (const text of group.items) {
            const item = document.createElement('li'),
              separator = text.indexOf(': ');
            if (separator >= 0) {
              const name = document.createElement('strong');
              name.textContent = text.slice(0, separator);
              const stats = document.createElement('span');
              stats.textContent = ' ' + text.slice(separator + 2);
              item.append(name, stats);
            } else item.textContent = text;
            list.appendChild(item);
          }
          section.append(heading, list);
        }
        node.querySelector('.article-body').appendChild(section);
      }
      el.feed.appendChild(node);
    }
    pruneImageURLs();
  }
  function selectedStories() {
    return [...state.stories.values()]
      .filter(
        s =>
          s.fingerprint === el.archiveLeague.value &&
          String(s.season) === el.archiveSeason.value &&
          s.day === Number(el.archiveDay.value) &&
          (!el.archiveTeam.value || storyTeams(s).some(t => String(t.id) === el.archiveTeam.value))
      )
      .sort((a, b) => b.importance - a.importance || (b.gid || 0) - (a.gid || 0) || a.id.localeCompare(b.id));
  }
  function courtWarnings(stories) {
    const count = stories.filter(s => s.customCourt?.status === 'unavailable').length;
    return count
      ? ` ${count} custom court ${count === 1 ? 'image could' : 'images could'} not load; saved court layouts were used.`
      : '';
  }
  async function loadSave(file) {
    status('Loading the save and preparing the HoopWire TV studio…');
    const parsed = JSON.parse(await file.text());
    C.assertSave(parsed);
    state.raw = parsed;
    state.leagueIndex = 0;
    state.scope = parsed.seasonLeagues.map(C.buildFingerprint);
    archiveNavigation();
    controls();
    location.hash = '#newsroom';
    view();
    const snapshots = [],
      leagues = [];
    for (const league of parsed.seasonLeagues) {
      const fingerprint = C.buildFingerprint(league);
      const previous = state.leagues.find(l => l.id === fingerprint);
      const studios = { ...previous?.studios };
      const year = C.seasonYear(league);
      if (!studios[year] || studios[year].inputs?.version < window.HoopWireTV.version)
        studios[year] = await window.HoopWireTV.render(window.HoopWireTV.inputs(league));
      const gameResults = structuredClone(previous?.gameResults || {});
      gameResults[year] ||= {};
      const lookup = C.buildLookups(league);
      for (const { game, dayIndex } of lookup.completed) {
        gameResults[year][dayIndex + 1] ||= {};
        const result = {
          gid: game.gId,
          home: { id: game.homeTeam, name: C.teamDisplay(lookup.teams.get(game.homeTeam)), score: game.homeScore },
          away: { id: game.awayTeam, name: C.teamDisplay(lookup.teams.get(game.awayTeam)), score: game.awayScore },
          homeRecord: game.homeRecord,
          awayRecord: game.awayRecord,
          gameType: game.gameType,
          tRound: game.tRound,
        };
        gameResults[year][dayIndex + 1][game.gId] = window.HoopWireBroadcastContext.enrichResult(
          gameResults[year][dayIndex + 1][game.gId],
          result
        );
      }
      leagues.push({
        ...previous,
        id: fingerprint,
        name: league.leagueName || 'League',
        shortName: league.shortName || null,
        leagueType: league.leagueType,
        logoURL: league.logoURL || null,
        asOf: { season: year, day: Math.max(1, lookup.latestDay + 1) },
        studios,
        gameResults,
      });
      // The active save is authoritative for its current verified player box scores.
      // Rewriting the same snapshot id refreshes stale browser-archive values.
      for (const snapshot of C.captureSnapshots(league, fingerprint)) {
        const previousSnapshot = state.snapshots.get(snapshot.id);
        const comparable = value => JSON.stringify({ ...value, capturedAt: null });
        snapshots.push(
          previousSnapshot && comparable(previousSnapshot) === comparable(snapshot) ? previousSnapshot : snapshot
        );
      }
    }
    await archive.write({ snapshots, leagues, meta: [{ id: 'active-leagues', ids: state.scope }] });
    state.raw = parsed;
    state.leagueIndex = 0;
    el.fileName.textContent = file.name;

    await readArchive();
    const archived = [];
    for (let index = 0; index < parsed.seasonLeagues.length; index++) {
      state.leagueIndex = index;
      archived.push(...(await generate()));
    }
    // Open on the first league with coverage this season; a career save can start with only college news.
    const covered = parsed.seasonLeagues.findIndex(l =>
      [...state.stories.values()].some(
        s => s.fingerprint === C.buildFingerprint(l) && String(s.season) === String(C.seasonYear(l))
      )
    );
    state.leagueIndex = Math.max(0, covered);
    const league = selectedLeague();
    archiveNavigation(C.buildFingerprint(league), C.seasonYear(league), C.buildLookups(league).latestDay + 1);
    view();
    status(`Save loaded.${courtWarnings(archived)}`);
  }
  async function generate() {
    const league = selectedLeague(),
      fingerprint = C.buildFingerprint(league);
    const stories = [];
    const contexts = pending();
    const composed = await Promise.all(
      contexts.map(async ctx => {
        const existing = state.stories.get(C.storyId(fingerprint, ctx.seasonYear, ctx.game.gId));
        const story = C.generateArticle(ctx, fingerprint, existing?.quotesEnabled ?? true);
        window.HoopWireRecords.enrich(story, league);
        if (story.cumulativeStats && story.day === C.buildLookups(league).latestDay + 1) {
          story.broadcastSnapshot = {
            fingerprint,
            season: story.season,
            day: story.day,
            playerId: story.playerId,
            period: story.cumulativeStats.period,
            average: structuredClone(story.cumulativeStats.season),
          };
        }
        if (existing) story.createdAt = existing.createdAt;
        if (existing?.imageBlob && existing.playerStats && existing.coach?.id === story.coach?.id) {
          for (const key of ['imageBlob', 'sceneInputs', 'imageAlt', 'imageCaption', 'customCourt'])
            if (existing[key] !== undefined) story[key] = existing[key];
        } else
          Object.assign(
            story,
            await window.HoopWireScenes.render(window.HoopWireScenes.inputs(ctx, story.id, league), story)
          );
        return story;
      })
    );
    stories.push(...composed);
    const milestoneIds = new Set();
    const milestones = [
      ...window.HoopWireSeason.candidates(league, state.raw.seasonLeagues),
      ...window.HoopWireRecords.candidates(league),
      ...window.HoopWireNews.candidates(league, state.raw.seasonLeagues),
      ...window.HoopWireNews.offseason(league, state.raw.seasonLeagues),
      ...window.HoopWirePerformance.candidates(league),
      ...window.HoopWireCareer.candidates(league),
    ].filter(x => {
      if (milestoneIds.has(x.story.id)) return false;
      milestoneIds.add(x.story.id);
      const existing = state.stories.get(x.story.id);
      return !existing || Number(x.story.editorialVersion || 0) > Number(existing.editorialVersion || 0);
    });
    // Compose in small batches to keep long season uploads responsive.
    for (let i = 0; i < milestones.length; i += 4) {
      stories.push(
        ...(await Promise.all(
          milestones.slice(i, i + 4).map(async ({ story, context }) => {
            story.broadcastAsOfDay = C.buildLookups(league).latestDay + 1;
            const old = state.stories.get(story.id);
            // Coach stories show the coach at the podium; an archived action image is redrawn.
            const redraw = context.coachScene
              ? old?.sceneInputs?.kind !== `coach-${context.coachScene}` || (old?.sceneInputs?.version || 0) < 32
              : context.injury
                ? old?.sceneInputs?.pose !== 'injured-leg'
                : context.coach && !old?.sceneInputs?.player?.isCoach;
            if (old && !redraw) {
              for (const key of [
                'day',
                'createdAt',
                'imageBlob',
                'sceneInputs',
                'imageAlt',
                'imageCaption',
                'customCourt',
              ])
                if (old[key] !== undefined) story[key] = old[key];
              return story;
            }
            if (old) for (const key of ['day', 'createdAt']) if (old[key] !== undefined) story[key] = old[key];
            if (context.coachScene)
              return Object.assign(
                story,
                await window.HoopWireScenes.render(
                  window.HoopWireCoachScenes.inputs(context, story.id, league, story.season),
                  story
                )
              );
            const scene = window.HoopWireScenes.inputs(context, story.id, league);
            if (context.potg && !context.injury) scene.kind = 'interview';
            if (context.coach)
              Object.assign(scene, {
                kind: 'interview',
                player: context.coach,
                coach: null,
                teammates: [],
                interview: {
                  variant: window.HoopWireCore.choose(story.id, ['player-close-up', 'player-profile'], 'coach-framing'),
                },
              });
            Object.assign(story, await window.HoopWireScenes.render(scene, story));
            return story;
          })
        ))
      );
    }
    await archive.write({ stories });
    await readArchive();
    archiveNavigation(fingerprint, C.seasonYear(league), C.buildLookups(league).latestDay + 1);
    return stories;
  }
  async function refreshImages() {
    const selected = selectedStories().filter(s => s.sceneInputs);
    status(`Refreshing ${selected.length} story images…`);
    const contexts = new Map();
    for (const league of state.raw?.seasonLeagues || []) {
      const fingerprint = C.buildFingerprint(league);
      for (const ctx of C.candidates(league, fingerprint, state.snapshots, 'full'))
        contexts.set(C.storyId(fingerprint, ctx.seasonYear, ctx.game.gId), ctx);
    }
    const stories = await Promise.all(
      selected.map(async original => {
        const story = structuredClone(original);
        const scene = window.HoopWireScenes.upgrade(story.sceneInputs, story, contexts.get(story.id));
        Object.assign(story, await window.HoopWireScenes.render(scene, story));
        return story;
      })
    );
    await archive.write({ stories });
    await readArchive();
    render();
    renderTV();
    status(`Refreshed ${stories.length} story images. Article text and stats were preserved.${courtWarnings(stories)}`);
  }
  function view() {
    let route = routeData();
    if (
      state.ready &&
      ((route.kind === 'front' && !canOpen('#newsroom')) ||
        (['archive', 'tv', 'stories'].includes(route.kind) && !canOpen('#' + route.kind)))
    ) {
      history.replaceState(null, '', '#welcome');
      route = { kind: 'welcome' };
    }
    document.body.classList.toggle('entry-screen', route.kind === 'welcome');
    for (const id of ['welcome', 'newsroom', 'archive', 'tv'])
      document.getElementById(id).classList.toggle('hidden', route.kind !== id);
    document.getElementById('newsroom').classList.add('hidden');
    document.getElementById('historicalStories').classList.toggle('hidden', route.kind !== 'stories');
    el.feed.classList.toggle('hidden', !['front', 'story', 'stories'].includes(route.kind));
    el.status.classList.toggle('hidden', ['tv', 'front', 'story'].includes(route.kind) || !el.status.textContent);
    for (const link of document.querySelectorAll('.nav a')) {
      if (
        link.getAttribute('href') === location.hash ||
        (route.kind === 'front' && route.fingerprint && link.getAttribute('href') === leagueHref(route.fingerprint))
      )
        link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    }
    render();
    if (route.kind === 'tv') renderTV();
    else window.HoopWireBroadcast?.stop();
    if (route.kind === 'front') requestAnimationFrame(() => scrollTo(0, frontScroll.get(location.hash) || 0));
    else if (route.kind === 'story') requestAnimationFrame(() => scrollTo(0, 0));
  }
  function currentLeagueForStory(story) {
    return (
      (state.raw?.seasonLeagues || []).find(
        l => C.buildFingerprint(l) === story.fingerprint && String(C.seasonYear(l)) === String(story.season)
      ) || null
    );
  }
  function currentSaveSnapshots(story) {
    const league = currentLeagueForStory(story);
    if (!league) return [];
    return C.captureSnapshots(league, story.fingerprint).filter(s => s.gid === story.gid);
  }
  function tvStoryFromCurrentSave(story) {
    if (story.performanceSnapshot) return structuredClone(story);
    const league = currentLeagueForStory(story),
      live = window.HoopWireSeason.refreshTVStory(story, league, state.raw?.seasonLeagues);
    if (!league) return live;
    if (live.gameSummary) {
      const snaps = currentSaveSnapshots(story);
      const snap = snaps.find(s => s.pid === live.playerId) || (snaps.length === 1 ? snaps[0] : null);
      if (snap) {
        live.playerId = snap.pid;
        live.playerStats = structuredClone(snap.stats);
      }
    }
    return live;
  }
  function boxScore(story) {
    const box = document.createElement('div');
    box.className = 'box-score';
    const label = document.createElement('div');
    label.className = 'box-result';
    label.textContent = `Final · ${story.season} · Day ${story.day}`;
    box.append(label);
    const teams = storyTeams(story);
    const scoreRow = document.createElement('div');
    scoreRow.className = 'scoreboard';
    // Older articles retain their text; recover only an unambiguous result from the opening recap.
    if (!story.gameSummary) {
      const opening = story.paragraphs?.[0] || '',
        match = opening.match(/(\d+)[–-](\d+)/);
      const winner = teams.find(t => opening.startsWith(t.name));
      if (match && winner) {
        teams.forEach(t => (t.score = Number(match[t.id === winner.id ? 1 : 2])));
      }
    }
    for (const team of teams) {
      const side = document.createElement('div');
      side.className = 'score-team';
      if (window.HoopWireCourt.validURL(team.logoURL)) {
        const logo = document.createElement('img');
        logo.src = team.logoURL;
        logo.alt = `${team.name} logo`;
        logo.addEventListener('error', () => logo.remove(), { once: true });
        side.append(logo);
      }
      const name = document.createElement('strong');
      name.textContent = team.name;
      const score = document.createElement('b');
      score.textContent = team.score ?? '—';
      side.append(name, score);
      scoreRow.append(side);
    }
    box.append(scoreRow);
    const comparison = performanceBoard(story);
    if (comparison) box.append(comparison);
    const performers = postgameBoard(story, teams);
    if (performers) box.append(performers);
    return box;
  }
  function performanceBoard(story) {
    const baseline = story.performanceSnapshot?.baseline;
    if (!baseline) return null;
    const rows = Object.entries(window.HoopWirePerformance.categories)
      .filter(([key]) => Number.isFinite(story.playerStats?.[key]) && Number.isFinite(baseline[key]))
      .map(([key, label]) => [C.capitalize(label), story.playerStats[key], (baseline[key] / baseline.GP).toFixed(1)]);
    return rows.length
      ? statBoard({
          kicker: 'This game',
          title: `${story.playerName} vs season average`,
          headers: ['Statistic', 'Game', 'Season avg'],
          rows,
          people: false,
          highlight: false,
        })
      : null;
  }
  // Each team's player of the game (or scoring leader) on one board.
  function postgameBoard(story, teams = storyTeams(story)) {
    const liveSnaps = currentSaveSnapshots(story);
    const snaps = liveSnaps.length
      ? liveSnaps
      : [...state.snapshots.values()].filter(
          s => s.fingerprint === story.fingerprint && String(s.season) === String(story.season) && s.gid === story.gid
        );
    const rows = [],
      subs = [],
      tags = [];
    for (const team of teams) {
      const list = snaps
        .filter(s => s.team.id === team.id && C.validStats(s.stats))
        .sort((a, b) => b.stats.PTS - a.stats.PTS || a.pid - b.pid);
      let snap = list.find(s => s.pid === story.playerId) || list[0];
      if (story.performanceSnapshot && story.sceneInputs?.team?.id === team.id)
        snap = { pid: story.playerId, player: story.sceneInputs.player, stats: story.playerStats };
      if (!snap) continue;
      const st = snap.stats,
        shot = (m, a) =>
          Number.isInteger(st[m]) && Number.isInteger(st[a]) && st[a] > 0 && st[m] <= st[a] ? `${st[m]}-${st[a]}` : '—';
      rows.push([
        C.playerDisplay(snap.player),
        st.PTS,
        st.REB,
        st.AST,
        st.STL,
        st.BLK,
        shot('FGM', 'FGA'),
        shot('TPM', 'TPA'),
      ]);
      subs.push(team.name);
      tags.push(snap.pid === story.playerId ? (story.performanceSnapshot ? 'Featured' : 'POTG') : '');
    }
    return rows.length
      ? statBoard({
          kicker: 'Postgame',
          title: 'Top performers',
          headers: ['Player', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG', '3PT'],
          rows,
          subs,
          tags,
          optional: ['STL', 'BLK'],
        })
      : null;
  }
  function tvStoryKicker(story) {
    if (story.eventKey?.startsWith('award-') || story.type === 'Award announcement') return 'AWARD SPOTLIGHT';
    if (story.eventKey?.startsWith('playoff-round-') || story.type === 'Playoff preview') return 'PLAYOFF DESK';
    if (story.type === 'Seeding snub') return 'BRACKET WATCH';
    if (story.eventKey === 'championship' || story.type === 'Championship review') return 'CHAMPIONSHIP DESK';
    if (
      story.type === 'Regular-season review' ||
      story.type === 'Team season review' ||
      story.type === 'Season leaders'
    )
      return 'SEASON WRAP';
    if (story.type === 'Draft watch' || story.type === 'Draft class') return 'DRAFT WATCH';
    if (story.type === 'Preseason poll') return 'PRESEASON';
    if (story.type === 'College offseason') return 'COLLEGE OFFSEASON';
    if (story.performanceSnapshot) return 'PLAYER WATCH';
    if (/record|milestone/i.test(story.type || '')) return 'RECORD BOOK';
    if (story.gameSummary) return 'POSTGAME';
    return 'HOOPWIRE DESK';
  }
  function tvSeasonGraphic(story, limit = 6) {
    const shell = document.createElement('div');
    shell.className = 'tv-season-graphic';
    const facts = window.HoopWireSeason.factsForStory(story),
      headers = facts.headers || [],
      rows = facts.rows || [];
    if (story.eventKey?.startsWith('award-') && rows[0]) {
      // A one-game line (a title game) shows totals; there is no "1 GP".
      const wanted = headers.includes('GP')
        ? ['Player', 'GP', 'PPG', 'RPG', 'APG', 'FG%', '3P%']
        : ['Player', 'PTS', 'REB', 'AST', 'STL', 'BLK', 'FG%', '3P%'];
      const cols = wanted.map(h => headers.indexOf(h)).filter(i => i >= 0),
        row = rows[0];
      row[0] = story.seasonSnapshot?.featuredPlayer?.name || row[0];
      const kicker = facts.single
        ? 'Title game'
        : /postseason/i.test(facts.label || '')
          ? 'Postseason'
          : 'Regular season';
      shell.append(
        statBoard({ kicker, title: 'Stat line', headers: cols.map(i => headers[i]), rows: [cols.map(i => row[i])] })
      );
      return shell;
    }
    if (story.eventKey?.startsWith('playoff-round-')) {
      const grid = document.createElement('div');
      grid.className = 'tv-matchup-grid';
      for (const row of story.seasonSnapshot?.rows || []) {
        const card = document.createElement('div');
        card.className = 'tv-matchup-card';
        const teams = document.createElement('div');
        teams.className = 'tv-matchup-teams';
        const a = document.createElement('strong');
        a.textContent = row[0];
        const vs = document.createElement('span');
        vs.textContent = 'vs';
        const b = document.createElement('strong');
        b.textContent = row[1];
        teams.append(a, vs, b);
        card.append(teams);
        if (row[2]) {
          const format = document.createElement('small');
          format.textContent = row[2];
          card.append(format);
        }
        grid.append(card);
      }
      shell.append(grid);
      return shell;
    }
    // Records and milestones get a record card: the mark, what it beat, the game.
    if (story.seasonSnapshot?.source === 'uploaded-save' && story.seasonSnapshot.evidence?.length) {
      shell.append(recordCard(story));
      return shell;
    }
    // Offseason boards carry their own caption, ranks and school lines.
    const board = story.seasonSnapshot?.board;
    if (board?.rows?.length) {
      shell.append(
        statBoard({
          kicker: board.kicker,
          title: board.title,
          headers: board.headers,
          rows: board.rows.slice(0, limit),
          ranked: !!board.ranked,
          marker: board.lead !== false,
          subs: board.subs?.slice(0, limit) || null,
        })
      );
      return shell;
    }
    // A championship gets a title card: the champion, the road through the
    // bracket round by round, and the Finals or tournament MVP.
    if (story.eventKey === 'championship' && story.seasonSnapshot?.rows?.[0]) {
      shell.append(titleCard(story));
      return shell;
    }
    if (!rows.length) return shell;
    shell.append(
      rows.length === 1 && headers.length <= 3 ? tvCallout(headers, rows[0]) : tvBoard(story, headers, rows.slice(0, 6))
    );
    return shell;
  }
  // Broadcast stat graphics: a captioned table with each column's leader lit,
  // or a single big number for a milestone.
  const tvNumber = v => {
    const t = String(v ?? '').trim();
    return /^-?\d[\d,]*(\.\d+)?%?$/.test(t) ? Number(t.replace(/[,%]/g, '')) : null;
  };
  const tvFormat = v => {
    const n = tvNumber(v);
    return n !== null && Number.isInteger(n) && Math.abs(n) >= 1000 && !/[.%]/.test(String(v))
      ? n.toLocaleString('en-US')
      : String(v ?? '');
  };
  function tvBoardCaption(story, headers) {
    if (story.type === 'Team season review') return ['Regular season', 'Team leaders'];
    if (story.type === 'Regular-season review') return ['Standings', 'Best records'];
    if (story.type === 'Season leaders') return ['League leaders', 'Per game'];
    return ['By the numbers', headers[0] || ''];
  }
  function tvBoard(story, headers, rows) {
    const [kicker, title] = tvBoardCaption(story, headers);
    // College standings switch between the bracket seed and the poll behind it.
    const toggle = headers.includes('Seed') && headers.includes('Poll') ? ['Seed', 'Poll'] : null;
    return statBoard({ kicker, title, headers, rows, ranked: story.type === 'Regular-season review', toggle });
  }
  // The one stat-table style for TV and articles. subs puts a small line
  // (a team) under each name; tags marks a row (player of the game).
  function statBoard({
    kicker,
    title,
    headers,
    rows,
    ranked = false,
    people = /^player$/i.test(headers[0] || ''),
    subs = null,
    tags = null,
    highlight = true,
    marker = true,
    optional = [],
    toggle = null,
  }) {
    const board = document.createElement('figure');
    board.className = 'tv-board';
    const caption = document.createElement('figcaption');
    caption.className = 'tv-board-head';
    const k = document.createElement('span');
    k.className = 'tv-board-kicker';
    k.textContent = kicker;
    const t = document.createElement('span');
    t.className = 'tv-board-title';
    t.textContent = title;
    caption.append(k, t);
    board.append(caption);
    // Drop columns with nothing in them (seeds before the bracket is set).
    const keep = headers.map((_, i) => i === 0 || rows.some(r => r[i] != null && r[i] !== '' && r[i] !== '—'));
    headers = headers.filter((_, i) => keep[i]);
    rows = rows.map(r => r.filter((_, i) => keep[i]));
    const madeAttempt = v => /^\d+[–-]\d+$/.test(String(v ?? '').trim());
    const numeric = headers.map(
      (_, i) =>
        i > 0 &&
        rows.every(r => r[i] == null || r[i] === '—' || tvNumber(r[i]) !== null || madeAttempt(r[i])) &&
        rows.some(r => tvNumber(r[i]) !== null || madeAttempt(r[i]))
    );
    // Light the best mark in each stat column; games played and seeds aren't contests.
    const lead = headers.map((h, i) => {
      if (!highlight || !people || !numeric[i] || rows.length < 2 || /^(GP|GS|MIN)$/i.test(h)) return null;
      const vals = rows.map(r => tvNumber(r[i])).filter(v => v !== null),
        top = Math.max(...vals);
      // Nothing to light when everyone is level or the best mark is zero.
      return vals.length && top > 0 && vals.some(v => v !== top) ? top : null;
    });
    const table = document.createElement('table');
    table.className = marker ? 'tv-board-table' : 'tv-board-table no-lead';
    const head = document.createElement('tr');
    if (ranked) {
      const th = document.createElement('th');
      th.className = 'is-rank';
      th.textContent = '#';
      th.scope = 'col';
      head.append(th);
    }
    headers.forEach((h, i) => {
      const th = document.createElement('th');
      th.scope = 'col';
      th.textContent = h;
      th.className = numeric[i] ? 'is-num' : 'is-text';
      if (optional.includes(h)) th.classList.add('is-optional');
      head.append(th);
    });
    const thead = document.createElement('thead');
    thead.append(head);
    const tbody = document.createElement('tbody');
    rows.forEach((row, r) => {
      const tr = document.createElement('tr');
      if (ranked) {
        const td = document.createElement('td');
        td.className = 'is-rank';
        td.textContent = r + 1;
        tr.append(td);
      }
      headers.forEach((_, i) => {
        const cell = document.createElement(i === 0 ? 'th' : 'td');
        const value = row[i];
        if (i === 0) {
          cell.scope = 'row';
          cell.className = 'is-name';
          // Phones get "B. Rhodes" so the stat columns keep their room.
          const full = document.createElement('span');
          full.className = 'tv-name-full';
          full.textContent = value ?? '';
          cell.append(full);
          const parts = String(value ?? '')
            .trim()
            .split(/\s+/);
          if (people && parts.length > 1) {
            const short = document.createElement('span');
            short.className = 'tv-name-short';
            short.textContent = `${parts[0][0]}.\u00a0${parts.slice(1).join('\u00a0')}`;
            cell.append(short);
          }
          if (tags?.[r]) {
            const tag = document.createElement('span');
            tag.className = 'tv-name-tag';
            tag.textContent = tags[r];
            cell.append(tag);
          }
          if (subs?.[r]) {
            const sub = document.createElement('small');
            sub.className = 'tv-name-sub';
            sub.textContent = subs[r];
            cell.append(sub);
          }
        } else {
          cell.className = numeric[i] ? 'is-num' : 'is-text';
          if (optional.includes(headers[i])) cell.classList.add('is-optional');
          if (value == null || value === '—') {
            cell.textContent = '—';
            cell.classList.add('is-empty');
          } else {
            cell.textContent = tvFormat(value);
            if (lead[i] !== null && tvNumber(value) === lead[i]) cell.classList.add('is-lead');
          }
        }
        tr.append(cell);
      });
      tbody.append(tr);
    });
    table.append(thead, tbody);
    const scroll = document.createElement('div');
    scroll.className = 'tv-board-scroll';
    scroll.append(table);
    board.append(scroll);
    // A two-way column switch (seed or poll): one column shows at a time.
    const cols = toggle?.map(h => headers.indexOf(h));
    if (cols?.every(i => i > 0)) {
      const offset = ranked ? 1 : 0,
        group = document.createElement('div');
      group.className = 'tv-board-toggle';
      group.setAttribute('role', 'group');
      group.setAttribute('aria-label', 'Column');
      const show = active => {
        for (const tr of table.rows)
          toggle.forEach((h, i) => {
            const cell = tr.cells[cols[i] + offset];
            if (cell) cell.hidden = h !== active;
          });
        for (const b of group.children) b.setAttribute('aria-pressed', String(b.dataset.col === active));
      };
      for (const h of toggle) {
        const b = document.createElement('button');
        b.type = 'button';
        b.dataset.col = h;
        b.textContent = h;
        b.addEventListener('click', () => show(h));
        group.append(b);
      }
      caption.append(group);
      show(toggle[0]);
    }
    return board;
  }
  // One card per record story: the mark beside what it beat, a progress bar
  // for a record chase, and the game and stat line it came from.
  const recordStat = {
    PTS: 'points',
    REB: 'rebounds',
    AST: 'assists',
    STL: 'steals',
    BLK: 'blocks',
    TPM: 'three-pointers',
    FGM: 'field goals',
    FTM: 'free throws',
    TO: 'turnovers',
  };
  function recordSpec(e) {
    const label = String(e.label || ''),
      detail = String(e.detail || ''),
      n = v => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
    const stat =
      recordStat[e.stat] ||
      label
        .split(': ')
        .at(-1)
        .replace(/^(season|career|single-game)\s+/i, '');
    const scope = e.scope || (/^career\b/i.test(label) ? 'career' : /^season\b/i.test(label) ? 'season' : null);
    const stageName = v =>
      ({
        'regular-season': 'Regular season',
        season: 'Regular season',
        playoff: 'Playoffs',
        playoffs: 'Playoffs',
        finals: 'Finals',
        Finals: 'Finals',
      })[v] || null;
    const signed = v => (v == null ? null : v > 0 ? `+${v}` : String(v));
    if (e.watch || / behind /.test(detail)) {
      const target = n(e.target),
        holder = e.holderName || /^\d[\d,]* behind (.+)$/.exec(detail)?.[1] || null;
      return {
        kicker: 'Record watch',
        title: `${scope === 'career' ? 'Career' : 'Single-season'} ${stat}`,
        value: e.value,
        unit: stat,
        progress: target ? { now: n(e.value), target } : null,
        facts: [
          ['Record', target],
          ['To go', target != null ? target - n(e.value) : null],
          ['Held by', holder],
        ],
      };
    }
    if (e.mark)
      return {
        kicker: 'Milestone',
        title: `${scope === 'career' ? 'Career' : 'Season'} ${stat}`,
        value: e.mark,
        unit: `${scope === 'career' ? 'career ' : ''}${stat}`,
        facts: [
          ['Total now', n(e.value)],
          ['This game', n(e.before) != null ? n(e.value) - n(e.before) : null],
          ['Stage', stageName(e.stage)],
        ],
      };
    if (/^Previous mark/.test(detail)) {
      const target = n(e.target) ?? n(/(\d[\d,]*)/.exec(detail)?.[1]?.replace(/,/g, ''));
      return {
        kicker: 'League record',
        title: `${scope === 'career' ? 'Career' : 'Single-season'} ${stat}`,
        value: e.value,
        unit: stat,
        facts: [
          [e.tie ? 'Matches' : 'Previous mark', target],
          ['Previous holder', e.holderName || null],
          ['Margin', e.tie ? 'Tied' : signed(target != null ? n(e.value) - target : null)],
        ],
      };
    }
    if (/^Career game high/i.test(label))
      return {
        kicker: 'Career high',
        title: `${C.capitalize(stat)} in a game`,
        value: e.value,
        unit: stat,
        facts: [
          ['Season average', n(e.average)],
          ['Stage', stageName(e.stage || detail)],
        ],
      };
    if (/^(League game record|Single-game)/i.test(label))
      return {
        kicker: 'League record',
        title: `Single-game ${stat}`,
        value: e.value,
        unit: stat,
        facts: [
          ['Previous record', n(e.previous)],
          ['Stage', stageName(e.stage || detail)],
        ],
      };
    if (/^Team player game record/i.test(label))
      return {
        kicker: 'Franchise record',
        title: `Single-game ${stat}`,
        value: e.value,
        unit: stat,
        facts: [
          ['Previous record', n(e.previous)],
          ['Team', detail || null],
        ],
      };
    if (/^Team season scoring/i.test(label)) {
      const dir = e.direction || (/low/i.test(label) ? 'low' : 'high'),
        prev = n(e.previous) ?? n(/Previous: (\d+)/.exec(detail)?.[1]);
      return {
        kicker: 'Team record',
        title: `Season scoring ${dir}`,
        value: e.value,
        unit: 'points',
        facts: [
          [`Previous ${dir}`, prev],
          ['Difference', signed(prev != null ? n(e.value) - prev : null)],
          ['Season average', n(e.average)],
        ],
      };
    }
    return {
      kicker: 'Record book',
      title: C.capitalize(label),
      value: e.value,
      unit: '',
      facts: [['Context', detail || null]],
    };
  }
  function recordGame(story, gid) {
    const days = state.leagues.find(l => l.id === story.fingerprint)?.gameResults?.[story.season] || {};
    for (const [day, games] of Object.entries(days)) if (games?.[gid]) return { day: Number(day), ...games[gid] };
    return null;
  }
  function recordCard(story) {
    const snap = story.seasonSnapshot,
      evidence = snap.evidence,
      lead = evidence[0],
      spec = recordSpec(lead);
    const make = (tag, className, text) => {
      const node = document.createElement(tag);
      if (className) node.className = className;
      if (text != null) node.textContent = text;
      return node;
    };
    const board = make('figure', 'tv-board tv-record'),
      head = make('figcaption', 'tv-board-head');
    head.append(make('span', 'tv-board-kicker', spec.kicker), make('span', 'tv-board-title', spec.title));
    board.append(head);
    const body = make('div', 'tv-record-body'),
      hero = make('div', 'tv-record-hero');
    hero.append(make('strong', 'tv-record-value', tvFormat(spec.value)));
    if (spec.unit) hero.append(make('span', 'tv-record-unit', spec.unit));
    const facts = make('dl', 'tv-record-facts');
    for (const [k, v] of spec.facts.filter(([, v]) => v != null && v !== '')) {
      const row = make('div', 'tv-record-fact');
      row.append(make('dt', '', k), make('dd', '', typeof v === 'number' ? tvFormat(v) : String(v)));
      facts.append(row);
    }
    body.append(hero);
    if (facts.childElementCount) body.append(facts);
    board.append(body);
    if (spec.progress?.target > 0 && spec.progress.now != null) {
      const share = Math.max(0, Math.min(1, spec.progress.now / spec.progress.target)),
        bar = make('div', 'tv-record-progress'),
        track = make('div', 'tv-record-track'),
        fill = make('span', 'tv-record-fill');
      fill.style.width = `${(share * 100).toFixed(1)}%`;
      track.append(fill);
      track.setAttribute('role', 'img');
      track.setAttribute('aria-label', `${tvFormat(spec.progress.now)} of ${tvFormat(spec.progress.target)}`);
      const ends = make('div', 'tv-record-ends');
      ends.append(
        make('span', '', `${tvFormat(spec.progress.now)} now`),
        make('span', '', `${tvFormat(spec.progress.target)} record`)
      );
      bar.append(track, ends);
      board.append(bar);
    }
    if (evidence.length > 1) {
      const also = make('ul', 'tv-record-also');
      for (const e of evidence.slice(1, 4)) {
        const x = recordSpec(e),
          li = make('li', '');
        li.append(make('span', '', x.kicker), make('strong', '', `${tvFormat(x.value)} ${x.unit}`.trim()));
        also.append(li);
      }
      board.append(also);
    }
    // The game it happened in, from the archived final and the box score.
    const gid = snap.gid ?? lead.gameId ?? lead.record?.gameResults?.gId,
      game = gid != null ? recordGame(story, gid) : null;
    if (game?.home && game?.away) {
      const foot = make('div', 'tv-record-game'),
        score = make('div', 'tv-record-score');
      score.append(make('span', 'tv-record-final', `Final · Day ${game.day}`));
      for (const side of [game.away, game.home]) {
        const row = make('div', side.score > Math.min(game.away.score, game.home.score) ? 'is-win' : '');
        row.append(make('span', '', side.name), make('strong', '', String(side.score)));
        score.append(row);
      }
      foot.append(score);
      const pid = snap.pid ?? lead.record?.pid,
        line = pid != null ? state.snapshots.get(C.snapshotId(story.fingerprint, story.season, gid, pid)) : null;
      if (line?.stats) {
        const strip = make('div', 'tv-record-line'),
          keys = ['PTS', 'REB', 'AST', 'STL', 'BLK'],
          key = evidence.map(e => e.stat).find(Boolean);
        for (const k of keys) {
          if (!Number.isFinite(line.stats[k])) continue;
          const cell = make('div', k === key ? 'is-lead' : '');
          cell.append(make('strong', '', String(line.stats[k])), make('span', '', k));
          strip.append(cell);
        }
        if (strip.childElementCount) foot.append(strip);
      }
      board.append(foot);
    }
    return board;
  }
  // Two columns: the champion and the MVP on the left, the road through the
  // bracket on the right; they stack on a narrow screen.
  function titleCard(story) {
    const snap = story.seasonSnapshot,
      [champion, runnerUp, year] = snap.rows[0];
    const box = document.createElement('div');
    box.className = 'tv-callout tv-title-card';
    const main = document.createElement('div');
    main.className = 'tv-title-card-main';
    const label = document.createElement('span');
    label.className = 'tv-callout-label';
    label.textContent = `${year} champions`;
    const value = document.createElement('strong');
    value.className = 'tv-title-card-team';
    value.textContent = champion;
    main.append(label, value);
    const mvp = snap.finalsMvp;
    if (mvp) {
      const award = document.createElement('span');
      award.className = 'tv-title-card-award';
      award.textContent = mvp.award;
      const line = document.createElement('span');
      line.className = 'tv-callout-context';
      line.textContent = `${mvp.name}: ${mvp.GP > 1 ? `${(mvp.PTS / mvp.GP).toFixed(1)} PPG, ${(mvp.REB / mvp.GP).toFixed(1)} RPG, ${(mvp.AST / mvp.GP).toFixed(1)} APG` : `${mvp.PTS} PTS, ${mvp.REB} REB, ${mvp.AST} AST`}`;
      main.append(award, line);
    }
    box.append(main);
    const run = snap.run || [],
      road = document.createElement('div');
    road.className = 'tv-title-card-road';
    const heading = document.createElement('span');
    heading.className = 'tv-title-card-award';
    heading.textContent = 'Road to the title';
    road.append(heading);
    const list = document.createElement('ol');
    list.className = 'tv-title-card-run';
    const rounds = run.length
      ? run
      : runnerUp && runnerUp !== 'Not available'
        ? [{ label: 'Final', opponent: runnerUp, firstTo: 1 }]
        : [];
    rounds.forEach((r, i) => {
      const item = document.createElement('li'),
        round = document.createElement('span'),
        result = document.createElement('span');
      round.className = 'tv-title-card-round';
      round.textContent = r.label.replace(/^\w/, c => c.toUpperCase());
      const score =
        r.firstTo > 1 ? `${r.wins}-${r.losses}` : i === rounds.length - 1 && snap.finalScore ? snap.finalScore : '';
      result.textContent = `Beat ${r.opponent}${score ? `, ${score}` : ''}`;
      item.append(round, result);
      list.append(item);
    });
    if (rounds.length) {
      road.append(list);
      box.append(road);
    }
    return box;
  }
  function tvCallout(headers, row) {
    const box = document.createElement('div');
    box.className = 'tv-callout';
    const label = document.createElement('span');
    label.className = 'tv-callout-label';
    label.textContent = row[0] ?? headers[0] ?? '';
    const value = document.createElement('strong');
    value.className = 'tv-callout-value';
    value.textContent = tvFormat(row[1]);
    box.append(label, value);
    if (row[2] != null && row[2] !== '—') {
      const context = document.createElement('span');
      context.className = 'tv-callout-context';
      context.textContent = String(row[2]).replace(/\d{4,}/g, n => Number(n).toLocaleString('en-US'));
      box.append(context);
    }
    return box;
  }
  function tvStoryPanel(story) {
    const panel = document.createElement('section');
    panel.className = 'tv-story-details';
    const header = document.createElement('header');
    header.className = 'tv-story-header';
    const kicker = document.createElement('span');
    kicker.className = 'tv-story-kicker';
    kicker.textContent = tvStoryKicker(story);
    const title = document.createElement('h2');
    title.textContent = story.headline;
    header.append(kicker, title);
    panel.append(header);
    panel.append(story.kind === 'season' ? tvSeasonGraphic(story) : boxScore(story));
    return panel;
  }
  function renderTV() {
    window.HoopWireBroadcast?.stop();
    const stories = selectedStories();
    const league = state.leagues.find(l => l.id === el.archiveLeague.value);
    const studio = league?.studios?.[el.archiveSeason.value];
    el.tvStudio.hidden = !studio?.imageBlob;
    el.tvDeskForeground.hidden = !studio?.backdropBlob;
    el.tvDeskForeground.removeAttribute('src');
    if (studio?.imageBlob) {
      const url = imageURL(studio.backdropBlob || studio.imageBlob);
      el.tvStudio.src = url;
      el.tvStudio.alt = studio.imageAlt;
      // The archived desk must cover animated hosts, just as in the still composition.
      if (studio.backdropBlob) el.tvDeskForeground.src = url;
      el.tvStudioCaption.textContent = `Illustrated broadcast with exclusive HoopWire hosts${studio.adsStatus === 'loaded' ? ' and league advertisement artwork' : studio.adsStatus === 'unavailable' ? '; league ads could not load' : ''}.`;
    } else {
      el.tvStudio.removeAttribute('src');
      el.tvStudioCaption.textContent = 'Load a league save to create the HoopWire studio for this season.';
    }
    const requestedIndex = stories.findIndex(s => s.id === state.tvRequestedStory);
    const previousIndex =
      requestedIndex >= 0
        ? requestedIndex
        : Math.min(Number(el.tvStorySelect.value || 0), Math.max(0, stories.length - 1));
    state.tvRequestedStory = null;
    options(
      el.tvStorySelect,
      stories.map((s, i) => [i, s.headline]),
      previousIndex
    );
    el.tvSegment.replaceChildren();
    const story = stories[previousIndex],
      tvStory = story ? tvStoryFromCurrentSave(story) : null;
    const context = tvStory
      ? window.HoopWireBroadcastContext.buildContext(tvStory, {
          league,
          stories: [...state.stories.values()],
          snapshots: [...state.snapshots.values()],
        })
      : {};
    window.HoopWireBroadcast?.mount(tvStory, studio, false, context);
    if (tvStory) el.tvSegment.appendChild(tvStoryPanel(tvStory));
    else el.tvSegment.textContent = 'Choose an archived day with stories to start the broadcast.';
    const results = new Map(
      Object.values(league?.gameResults?.[el.archiveSeason.value]?.[el.archiveDay.value] || {}).map(g => [g.gid, g])
    );
    for (const article of state.stories.values())
      if (
        article.fingerprint === league?.id &&
        String(article.season) === el.archiveSeason.value &&
        article.day === Number(el.archiveDay.value) &&
        article.gameSummary &&
        !results.has(article.gid)
      )
        results.set(article.gid, { gid: article.gid, ...article.gameSummary });
    el.tvTicker.replaceChildren();
    el.tvTicker.hidden = !studio?.imageBlob || !results.size;
    if (results.size) {
      const text = [...results.values()]
        .sort((a, b) => a.gid - b.gid)
        .map(g => `${g.away.name} ${g.away.score} — ${g.home.name} ${g.home.score}`)
        .join('   •   ');
      el.tvTicker.setAttribute('aria-label', `Day ${el.archiveDay.value} final results: ${text}`);
      const badge = document.createElement('strong');
      badge.className = 'results-badge';
      badge.textContent = 'FINAL';
      const window = document.createElement('div');
      window.className = 'results-window';
      window.tabIndex = 0;
      const track = document.createElement('div');
      track.className = 'results-track';
      track.style.animationDuration = `${Math.max(25, text.length * 0.12)}s`;
      for (let i = 0; i < 2; i++) {
        const copy = document.createElement('span');
        copy.textContent = text + '   •   ';
        copy.setAttribute('aria-hidden', 'true');
        track.append(copy);
      }
      window.append(track);
      el.tvTicker.append(badge, window);
    }
    pruneImageURLs();
    controls();
  }
  el.resetArchive.addEventListener('click', () => {
    el.resetTitle.textContent = 'Reset the archive?';
    el.resetDescription.textContent =
      'This removes every league’s saved stories, images, box scores, and TV episodes from this browser, pro and college alike. Export a backup first if you want to keep a copy.';
    el.resetDialog.showModal();
  });
  el.cancelReset.addEventListener('click', () => el.resetDialog.close());
  el.confirmReset.addEventListener('click', () => {
    el.resetDialog.close();
    run(async () => {
      await archive.resetAll();
      await readArchive();
      archiveNavigation();
      view();
      status('Archive reset. Every league was cleared.');
    });
  });
  el.newsroomLeague.addEventListener('change', () => {
    state.leagueIndex = Number(el.newsroomLeague.value);
    el.archiveTeam.value = '';
    view();
  });
  function siteMenu(open) {
    el.siteMenu.hidden = !open;
    el.siteMenuButton.setAttribute('aria-expanded', String(open));
  }
  el.siteMenuButton.addEventListener('click', event => {
    event.stopPropagation();
    siteMenu(el.siteMenu.hidden);
    if (!el.siteMenu.hidden) el.siteMenu.querySelector('a:not([aria-disabled]), button:not(:disabled)')?.focus();
  });
  el.menuUploadSave.addEventListener('click', () => {
    siteMenu(false);
    el.saveFile.click();
  });
  document.addEventListener('click', event => {
    if (!el.siteMenu.hidden && !event.target.closest('.site-menu')) siteMenu(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !el.siteMenu.hidden) {
      siteMenu(false);
      el.siteMenuButton.focus();
    }
  });
  window.addEventListener('hashchange', () => siteMenu(false));
  // Chrome and Edge can remember the game's save folder and this league's save slot, then open
  // the newest save in that slot. Saves from other slots (other leagues) are never picked.
  const folder = window.HoopWireSaveFolder,
    isSave = data => Array.isArray(data?.seasonLeagues);
  const describeSave = data => {
    const league = data.seasonLeagues[0] || {};
    return [league.leagueName, league.season?.mode === 2 ? 'career' : null, league.season?.currentYear]
      .filter(Boolean)
      .join(' · ');
  };
  // Show the save location for this computer; both when it can't tell.
  const platform = (navigator.userAgentData?.platform || navigator.platform || '').toLowerCase();
  for (const hint of document.querySelectorAll('[data-platform]'))
    hint.hidden = /mac|win/.test(platform) && !platform.includes(hint.dataset.platform.slice(0, 3));
  function folderControls(choosing = false) {
    const saved = state.saveFolder;
    el.saveFolder.hidden = !folder.supported();
    el.saveSlotChoice.hidden = !choosing;
    el.saveFolderNew.hidden = choosing || !!saved?.slot;
    el.saveFolderKnown.hidden = choosing || !saved?.slot;
    el.menuLoadLatest.hidden = !saved?.slot;
    el.saveFolderName.textContent = saved?.slot ? `${saved.folder.name} · slot ${saved.slot}` : '';
  }
  async function useSlot(handle, slot) {
    state.saveFolder = { folder: handle, slot };
    folderControls();
    await folder.remember(state.saveFolder).catch(() => {});
    await loadLatest();
  }
  async function loadLatest() {
    const { folder: handle, slot } = state.saveFolder;
    if (!(await folder.permitted(handle, true)))
      throw new Error(`HoopWire needs permission to read the ${handle.name} folder.`);
    const file = await folder.latestSave(handle, isSave, slot);
    if (!file) throw new Error(`No save was found in slot ${slot} of the ${handle.name} folder.`);
    await loadSave(file);
  }
  async function chooseFolder() {
    let handle;
    try {
      handle = await window.showDirectoryPicker({ id: 'hoop-land-saves', mode: 'read' });
    } catch (error) {
      if (error.name === 'AbortError') return;
      throw error;
    }
    if (!(await folder.permitted(handle, true)))
      throw new Error(`HoopWire needs permission to read the ${handle.name} folder.`);
    const found = await folder.slots(handle, isSave, describeSave);
    if (!found.length) throw new Error(`No Hoop Land saves were found in the ${handle.name} folder.`);
    if (found.length === 1) return useSlot(handle, found[0].slot);
    // Several leagues share the folder: the player says which slot this one is.
    el.saveSlots.replaceChildren(
      ...found.map(({ slot, label }) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = `Slot ${slot} · ${label}`;
        button.addEventListener('click', () => run(() => useSlot(handle, slot)));
        return button;
      })
    );
    folderControls(true);
  }
  el.chooseSaveFolder.addEventListener('click', () => run(chooseFolder));
  el.changeSaveFolder.addEventListener('click', () => run(chooseFolder));
  el.loadLatestSave.addEventListener('click', () => run(loadLatest));
  el.menuLoadLatest.addEventListener('click', () => {
    siteMenu(false);
    run(loadLatest);
  });
  el.saveFile.addEventListener('change', () => {
    const file = el.saveFile.files[0];
    // A save chosen by hand from another slot becomes the slot to follow.
    const slot = folder.slotOf(file?.name);
    if (file && slot && state.saveFolder && slot !== state.saveFolder.slot) {
      state.saveFolder = { ...state.saveFolder, slot };
      folder.remember(state.saveFolder).catch(() => {});
      folderControls();
    }
    if (file) run(() => loadSave(file));
    el.saveFile.value = '';
  });
  el.archiveLeague.addEventListener('change', () => archiveNavigation(el.archiveLeague.value, '', ''));
  el.archiveSeason.addEventListener('change', () =>
    archiveNavigation(el.archiveLeague.value, el.archiveSeason.value, '')
  );
  el.archiveTeam.addEventListener('change', () => {
    render();
    renderTV();
    controls();
  });
  el.archiveDay.addEventListener('change', () => {
    render();
    renderTV();
    controls();
  });
  el.refreshImagesButton.addEventListener('click', () => run(refreshImages));
  el.tvStorySelect.addEventListener('change', renderTV);
  el.tvPrevious.addEventListener('click', () => {
    el.tvStorySelect.value = String(Number(el.tvStorySelect.value) - 1);
    renderTV();
  });
  el.tvNext.addEventListener('click', () => {
    el.tvStorySelect.value = String(Number(el.tvStorySelect.value) + 1);
    renderTV();
  });
  window.addEventListener('hashchange', view);
  el.exportButton.addEventListener('click', () =>
    run(async () => {
      const backup = await archive.exportData(el.archiveLeague.value);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `hoopwire-archive-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      status(`Exported ${backup.stories.length} archived stories with images and stat snapshots.`);
    })
  );
  for (const input of [el.importFile])
    input.addEventListener('change', () => {
      const file = input.files[0];
      input.value = '';
      if (file)
        run(async () => {
          const data = JSON.parse(await file.text());
          const count = await archive.importData(data);
          if (!state.raw) {
            state.scope = data.leagues.map(l => l.id);
            await archive.write({ meta: [{ id: 'active-leagues', ids: state.scope }] });
          }
          await readArchive();
          archiveNavigation();
          controls();
          status(`Imported ${count} stories. Existing archived records were preserved.`);
        });
    });
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const target = link.getAttribute('href'),
      current = routeData();
    const route = target.startsWith('#league') ? '#newsroom' : target;
    if (
      ['#newsroom', '#archive', '#tv', '#stories'].includes(route) &&
      (!canOpen(route) || link.getAttribute('aria-disabled') === 'true')
    ) {
      event.preventDefault();
      return;
    }
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (current.kind === 'front') {
      frontScroll.set(location.hash, scrollY);
      if (target.startsWith('#story/')) {
        storyOrigins.set(decodeURIComponent(target.slice(7)), { route: location.hash, scroll: scrollY });
        try {
          sessionStorage.setItem('hoopwire-story-origins', JSON.stringify([...storyOrigins]));
        } catch {}
      }
    }
    if (link.classList.contains('article-back')) {
      const origin = storyOrigins.get(current.id);
      if (origin) frontScroll.set(origin.route, origin.scroll);
    }
  });
  controls();
  view();
  run(async () => {
    await archive.open();
    await readArchive();
    if (folder.supported()) state.saveFolder = await folder.recall();
    folderControls();
    state.ready = true;
    archiveNavigation();
    view();
    const upgraded = [];
    for (const league of state.leagues) {
      const studios = { ...league.studios };
      let changed = false;
      for (const [season, studio] of Object.entries(studios))
        if (studio.inputs?.version < window.HoopWireTV.version) {
          status('Updating the HoopWire TV studio…');
          const fresh = await window.HoopWireTV.render({ ...studio.inputs, version: window.HoopWireTV.version });
          if (studio.adsStatus === 'loaded' && fresh.adsStatus === 'unavailable')
            throw new Error(
              'TV studio could not be updated because its advertisement artwork is unavailable. The saved studio was preserved.'
            );
          studios[season] = fresh;
          changed = true;
        }
      if (changed) upgraded.push({ ...league, studios });
    }
    if (upgraded.length) {
      await archive.write({ leagues: upgraded });
      await readArchive();
      archiveNavigation();
      status('HoopWire TV is ready with host discussions and fitted sponsor artwork.');
    }
    if (archive.migrationError)
      status(
        `The old archive could not be migrated: ${archive.migrationError} Its original copy has been retained. Your daily archive is still available.`
      );
  });
})();
