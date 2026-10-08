/* Renders the newsroom front page. */
(() => {
  'use strict';
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function render(target, edition, { imageURL, caption, paragraphs, storyHref, onWatch, busy = false }) {
    const N = window.HoopWireNewsroom;
    const leagueFor = story => edition.leagues.find(l => l.id === story.fingerprint);
    const label = story => {
      const l = leagueFor(story);
      return `${l?.leagueType === 0 ? 'PRO · ' : l?.leagueType === 1 ? 'COLLEGE · ' : ''}${l?.shortName || l?.name || story.leagueName} · ${story.season} · Day ${story.day}`;
    };
    const image = (story, className) => {
      if (story.imageBlob) {
        const img = element('img', className);
        img.src = imageURL(story.imageBlob);
        img.alt = caption(story.sceneInputs, story) || story.headline;
        img.width = 768;
        img.height = 432;
        img.addEventListener('error', () => img.replaceWith(image({ ...story, imageBlob: null }, className)), {
          once: true,
        });
        return img;
      }
      const placeholder = element('div', `${className} wire-placeholder`),
        logo = element('img');
      logo.src = 'assets/brand/hoopwire_banner.png';
      logo.alt = '';
      placeholder.setAttribute('aria-hidden', 'true');
      placeholder.append(logo);
      return placeholder;
    };
    const card = (story, lead = false) => {
      const a = element('a', lead ? 'wire-card wire-lead' : 'wire-card');
      a.href = storyHref(story.id);
      a.dataset.storyId = story.id;
      a.dataset.leagueId = story.fingerprint;
      a.append(image(story, 'wire-image'));
      const body = element('div', 'wire-card-body');
      body.append(element('div', 'wire-meta', label(story)), element(lead ? 'h2' : 'h3', '', story.headline));
      if (lead)
        body.append(
          element('p', 'wire-summary', N.summary(story, paragraphs(story))),
          element('div', 'wire-byline', 'HoopWire Staff'),
          element('span', 'wire-read', 'Read story →')
        );
      a.append(body);
      return a;
    };
    const scores = edition.editions.filter(e => e.games.length && !e.scoresStale);
    if (scores.length) {
      const strip = element('section', 'wire-scores');
      strip.setAttribute('aria-label', 'Latest final scores');
      strip.tabIndex = 0;
      for (const e of scores)
        for (const game of e.games) {
          const result = element('div', 'wire-score');
          result.append(
            element('div', 'wire-meta', `${e.league.shortName || e.league.name} · ${e.season} · Day ${e.scoreDay}`),
            element('strong', 'wire-final', 'FINAL')
          );
          for (const team of [game.away, game.home]) {
            const row = element('div', 'wire-score-team');
            row.append(element('span', '', team.name), element('strong', '', String(team.score)));
            result.append(row);
          }
          strip.append(result);
        }
      target.append(strip);
    }
    const header = element('header', 'wire-heading');
    header.append(element('span', 'landing-kicker', 'HOOPWIRE NEWS'), element('h1', '', edition.title));
    if (edition.date) {
      const only = edition.editions.length === 1 ? edition.editions[0].league : null;
      header.append(
        element(
          'p',
          'muted',
          `${only ? `${only.shortName || only.name} · ` : ''}${edition.date.season} · Day ${edition.date.day}`
        )
      );
    }
    target.append(header);
    if (!edition.lead) {
      target.append(
        element(
          'div',
          'panel muted',
          busy
            ? 'Preparing the latest coverage…'
            : 'No saved stories for this league yet. Load a save to create coverage.'
        )
      );
      return;
    }
    const opening = element('div', 'wire-opening'),
      main = element('div', 'wire-main'),
      lead = card(edition.lead, true);
    let sidebar = null;
    if (edition.headlines.length) {
      const aside = element('aside', 'wire-headlines');
      aside.append(element('h2', '', 'Top Headlines'));
      const list = element('ul', '');
      for (const story of edition.headlines) {
        const li = element('li', ''),
          a = element('a', '');
        a.href = storyHref(story.id);
        a.dataset.storyId = story.id;
        a.dataset.leagueId = story.fingerprint;
        a.append(element('span', 'wire-meta', label(story)), element('strong', '', story.headline));
        li.append(a);
        list.append(li);
      }
      aside.append(list);
      sidebar = element('div', 'wire-sidebar');
      sidebar.append(
        aside,
        window.HoopWireNewsroomPromos.render({
          studio: edition.tvStory ? leagueFor(edition.tvStory).studios[edition.tvStory.season] : null,
          story: edition.tvStory,
          onWatch,
        })
      );
    }
    main.append(lead);
    opening.append(main);
    if (sidebar) opening.append(sidebar);
    const feedStudio = edition.tvStory ? leagueFor(edition.tvStory).studios[edition.tvStory.season] : null;
    // Each grid ends with a sponsor tile that CSS shows only to fill an empty last-row cell.
    const sponsor = index => window.HoopWireNewsroomPromos.feedCard({ studio: feedStudio, index });
    if (edition.supporting.length) {
      const supporting = element('section', 'wire-supporting');
      supporting.setAttribute('aria-label', 'More featured stories');
      for (const story of edition.supporting) supporting.append(card(story));
      supporting.append(sponsor(0));
      main.append(supporting);
    }
    target.append(opening);
    for (const section of edition.sections) {
      const node = element('section', 'wire-section');
      node.append(element('h2', '', section.label));
      const grid = element('div', 'wire-story-grid');
      for (const story of section.items) grid.append(card(story));
      grid.append(sponsor(edition.sections.indexOf(section) + 1));
      node.append(grid);
      target.append(node);
    }
    if (edition.tvStory) {
      const story = edition.tvStory,
        studio = leagueFor(story).studios[story.season],
        feature = element('section', 'wire-tv');
      const poster = element('img', 'wire-tv-poster');
      poster.src = imageURL(studio.imageBlob);
      poster.alt = 'HoopWire TV studio';
      poster.width = 960;
      poster.height = 540;
      const details = element('div', 'wire-tv-details');
      const logo = element('img', 'wire-tv-logo');
      logo.src = 'assets/brand/hoopwire_logo.png';
      logo.alt = 'HoopWire TV';
      logo.width = 1336;
      logo.height = 366;
      details.append(element('h2', '', 'The Daily Desk'), logo);
      const air = element('div', 'wire-tv-air-row'),
        time = element('div', 'wire-tv-time');
      time.append(
        element('p', 'wire-tv-airtime', 'Nightly · 10 PM'),
        element('span', 'wire-tv-timezone', 'League time · Available on demand')
      );
      const watch = element('button', 'primary', 'Watch Now!');
      watch.addEventListener('click', () => onWatch(story));
      air.append(time, watch);
      details.append(air);
      feature.append(poster, details);
      target.append(feature);
    }
  }
  window.HoopWireNewsroomView = { render };
})();
