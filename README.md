# HoopWire

An offline newsroom and TV show for Hoop Land leagues. Load a save and HoopWire writes the day's stories, draws their
scenes and builds a HoopWire TV episode, all in the browser. Stories are kept in a local archive (IndexedDB).

## Run locally

```sh
node scripts/serve.cjs   # http://127.0.0.1:8123
```

## Layout

```
index.html
css/                 styles.css, newsroom.css, theme.css (design tokens, loaded last)
js/coverage/         story generation from the save: games, season, records, news, performances
js/render/           canvas art: players, courts, press wall, story scenes, TV studio
js/broadcast/        HoopWire TV: evidence, desk scripts, playback and voices
js/newsroom/         front-page edition selection, layout and ads
js/app/              archive storage and the app controller
assets/              brand, court, player, scene and team-logo art
vendor/animalese/    host voice synthesis
tests/               unit tests (*.test.cjs) and Playwright browser scripts (*-browser.cjs, browser.cjs, ...)
```

## Tests

```sh
node --test tests/*.test.cjs
```

The browser scripts need Playwright on `NODE_PATH` and, for most of them, the local server running. They launch Edge
by default; set `HOOPWIRE_BROWSER=chromium` to use Chromium instead.

```sh
node tests/browser.cjs
```

Pushing to `main` runs the unit tests and deploys the site to GitHub Pages.
