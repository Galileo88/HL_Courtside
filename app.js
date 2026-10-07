(() => {
  "use strict";
  const C = window.HoopWireCore;
  const archive = new window.HoopWireArchive();
  const el = Object.fromEntries(["saveFile","fileName","archiveLeague","archiveSeason","archiveDay","exportButton",
    "importFile","feed","status","articleTemplate","refreshImagesButton","tvStudio","tvStudioCaption",
    "archiveTitle","archiveLeagueSwitch","previousArchiveLeague","nextArchiveLeague","archiveTree","resetArchive","resetDialog","resetTitle","resetDescription","cancelReset","confirmReset","historicalTitle","leagueButtons","newsroomLeague","newsroomLeagueLabel","archiveTeam","newsroomDay","tvHosts","tvStorySelect","tvPrevious","tvNext","tvSegment","tvTicker","tvDeskForeground","tv"].map(id => [id, document.getElementById(id)]));
  const state = {scope:null,raw: null, leagueIndex: 0, stories: new Map(), snapshots: new Map(), leagues: [], ready: false, busy: false};
  const imageURLs=new Map();
  function pruneImageURLs(){
    const live=new Set([...state.stories.values()].map(s=>s.imageBlob));
    for(const league of state.leagues)for(const studio of Object.values(league.studios||{})){live.add(studio.imageBlob);live.add(studio.backdropBlob);}
    const displayed=new Set([...document.images].map(img=>img.getAttribute('src')));
    for(const [blob,item] of imageURLs)if(item.ready&&!live.has(blob)&&!displayed.has(item.url)){URL.revokeObjectURL(item.url);imageURLs.delete(blob);}
  }
  function imageURL(blob){
    let item=imageURLs.get(blob);
    if(!item){
      item={url:URL.createObjectURL(blob),ready:false,probe:new Image()};imageURLs.set(blob,item);
      // Keep a pending URL alive even when rapid redraws detach its image. A
      // completed load can safely release obsolete archive versions afterward.
      item.probe.onload=item.probe.onerror=()=>{item.ready=true;item.probe=null;pruneImageURLs();};
      item.probe.src=item.url;
    }
    return item.url;
  }
  function status(message) { el.status.textContent = message; el.status.classList.remove("hidden"); }
  function selectedLeague() { return state.raw?.seasonLeagues[state.leagueIndex]; }
  function pending() {
    const league = selectedLeague();
    if (!league) return [];
    const fingerprint = C.buildFingerprint(league);
    return C.candidates(league, fingerprint, state.snapshots, "full")
      .filter(ctx => C.shouldGenerate(state.stories.get(C.storyId(fingerprint,ctx.seasonYear,ctx.game.gId)),ctx));
  }
  function accessibleLeagues() {return state.leagues.filter(l=>!state.scope||state.scope.includes(l.id));}
  function accessibleStories() {return [...state.stories.values()].filter(s=>!state.scope||state.scope.includes(s.fingerprint));}
  function canOpen(route) {
    if(!state.ready)return false;
    if(route==='#newsroom')return !!state.raw;
    if(['#archive','#stories','#tv'].includes(route))return accessibleStories().length>0;
    return true;
  }
  function controls() {
    document.getElementById("welcome").classList.toggle("has-save",!!state.raw);
    for(const link of document.querySelectorAll('a[href="#newsroom"],a[href="#archive"],a[href="#tv"]')){
      const disabled=!canOpen(link.getAttribute('href'));
      if(disabled){link.setAttribute('aria-disabled','true');link.setAttribute('tabindex','-1');}
      else{link.removeAttribute('aria-disabled');link.removeAttribute('tabindex');}
    }
    el.previousArchiveLeague.disabled=el.nextArchiveLeague.disabled=state.busy || !state.ready;
    options(el.newsroomLeague,(state.raw?.seasonLeagues || []).map((l,i)=>[i,l.leagueName || `League ${i+1}`]),state.leagueIndex);
    el.newsroomLeague.disabled=state.busy || !state.ready || !state.raw;
    const buttonState=JSON.stringify([state.raw?.seasonLeagues.map(l=>[l.leagueName,l.shortName,l.leagueType]),location.hash,state.leagueIndex,state.busy]);
    if(el.leagueButtons.dataset.state!==buttonState){
      el.leagueButtons.dataset.state=buttonState;el.leagueButtons.replaceChildren();
      (state.raw?.seasonLeagues || []).map((league,index)=>({league,index})).sort((a,b)=>(a.league.leagueType ?? 2)-(b.league.leagueType ?? 2)).forEach(({league,index})=>{
        const link=document.createElement('a');link.textContent=`${league.shortName || (league.leagueType===1?'College':'Pro')} News`;link.href=`#league-${index}`;link.title=league.leagueName;
        if(location.hash===`#league-${index}`)link.setAttribute('aria-current','page');
        if(state.busy||!state.ready){link.setAttribute('aria-disabled','true');link.tabIndex=-1;}
        el.leagueButtons.append(link);
      });
    }
    el.saveFile.disabled = state.busy || !state.ready;
    el.resetArchive.disabled = state.busy || !state.ready || ![...state.stories.values()].some(s=>s.fingerprint===el.archiveLeague.value);
    for(const button of el.archiveTree.querySelectorAll("button"))button.disabled=state.busy;
    el.exportButton.disabled = state.busy || !state.ready;
    el.importFile.disabled = state.busy || !state.ready;
    el.refreshImagesButton.disabled = state.busy || !state.ready || !selectedStories().some(s => s.sceneInputs);
    const storyCount = selectedStories().length;
    el.tvStorySelect.disabled = state.busy || !storyCount;
    const index = Number(el.tvStorySelect.value || 0);
    el.tvPrevious.disabled = state.busy || index <= 0;
    el.tvNext.disabled = state.busy || index >= storyCount-1;
    for (const item of [el.archiveLeague, el.archiveSeason, el.archiveDay]) item.disabled = state.busy || !item.options.length;

  }
  async function run(action) {
    if (state.busy) return;
    state.busy = true; controls();
    try { await action(); }
    catch (error) { status(`${error.message} Nothing was confirmed as archived. Your existing archive has been retained.`); }
    finally { state.busy = false; controls(); if(location.hash==="#newsroom"||/^#league-/.test(location.hash))render(); }
  }
  async function readArchive() {
    const [stories,snapshots,leagues] = await Promise.all([archive.all("stories"),archive.all("snapshots"),archive.all("leagues")]);
    state.stories = new Map(stories.map(s => [s.id,s]));
    state.snapshots = new Map(snapshots.map(s => [s.id,s]));
    state.leagues = leagues;
    if(state.scope===null){const saved=await archive.get("meta","active-leagues");if(Array.isArray(saved?.ids))state.scope=saved.ids;}
  }
  function options(select, items, preferred) {
    select.replaceChildren();
    for (const [value,label] of items) {
      const option = document.createElement("option"); option.value = String(value); option.textContent = label; select.appendChild(option);
    }
    if (items.some(([value]) => String(value) === String(preferred))) select.value = String(preferred);
  }
  function archiveNavigation(fingerprint = el.archiveLeague.value, season = el.archiveSeason.value, day = el.archiveDay.value) {
    const leagues=accessibleLeagues();
    if (!leagues.some(l => l.id === fingerprint)) {
      fingerprint = leagues.find(l => [...state.stories.values()].some(s => s.fingerprint === l.id))?.id;
    }
    options(el.archiveLeague, leagues.map(l => [l.id,l.name]),fingerprint);
    const stories = [...state.stories.values()].filter(s => s.fingerprint === el.archiveLeague.value);
    const seasons = [...new Set(stories.map(s => String(s.season)))].sort((a,b) => b.localeCompare(a,undefined,{numeric:true}));
    options(el.archiveSeason,seasons.map(y => [y,`Season ${y}`]),season);
    const days = [...new Set(stories.filter(s => String(s.season) === el.archiveSeason.value).map(s => s.day))].sort((a,b) => b-a);
    options(el.archiveDay,days.map(d => [d,`Day ${d}`]),day);
    const teamEntries = new Map();
    for (const story of stories.filter(s => String(s.season) === el.archiveSeason.value)) {
      for (const team of storyTeams(story)) if(team?.id != null) teamEntries.set(String(team.id),team.name);
    }
    options(el.archiveTeam,[["","All teams"],...teamEntries.entries()],el.archiveTeam.value);
    renderArchiveTree();render(); renderTV(); controls();
  }
  function storyTeams(story) {
    if(story.relatedTeams) return story.relatedTeams;
    if(story.gameSummary) return [story.gameSummary.away,story.gameSummary.home];
    const teams=[story.sceneInputs?.team,story.sceneInputs?.opponent].filter(Boolean).map(t=>({...t,name:C.teamDisplay(t)}));
    return teams.length?teams:[{id:"unassigned",name:"Unassigned stories"}];
  }
  function renderArchiveTree() {
    const expanded=new Set([...el.archiveTree.querySelectorAll('details[open]')].map(d=>d.dataset.key));
    el.archiveTree.replaceChildren();
    const league=state.leagues.find(l=>l.id===el.archiveLeague.value);
    el.archiveTitle.textContent=`${league?.name || 'League'} Archive`;
    el.archiveLeagueSwitch.hidden=accessibleLeagues().length<2;
    el.previousArchiveLeague.disabled=el.nextArchiveLeague.disabled=state.busy;
    const teams=new Map();
    for(const story of state.stories.values())if(story.fingerprint===el.archiveLeague.value)for(const team of storyTeams(story)){
      const key=`${story.fingerprint}:${team.id}`;
      if(!teams.has(key))teams.set(key,{...team,fingerprint:story.fingerprint,league:story.leagueName || state.leagues.find(l=>l.id===story.fingerprint)?.name,years:new Map()});
      const entry=teams.get(key),year=String(story.season);
      if(!entry.years.has(year))entry.years.set(year,new Set());
      entry.years.get(year).add(story.day);
    }
    if(!teams.size){const empty=document.createElement('p');empty.className='muted';empty.textContent='No saved coverage yet. Load a save to start your archive.';el.archiveTree.append(empty);return;}
    for(const team of [...teams.values()].sort((a,b)=>a.name.localeCompare(b.name))){
      const branch=document.createElement('details');branch.className='archive-team';branch.dataset.key=`${team.fingerprint}:${team.id}`;branch.open=expanded.has(branch.dataset.key);const summary=document.createElement('summary');
      const name=document.createElement('strong');name.textContent=team.name;summary.append(name);
branch.append(summary);
      for(const [year,days] of [...team.years].sort((a,b)=>b[0].localeCompare(a[0],undefined,{numeric:true}))){
        const season=document.createElement('details');season.className='archive-year';season.dataset.key=`${branch.dataset.key}:${year}`;season.open=expanded.has(season.dataset.key);const heading=document.createElement('summary');heading.textContent=year;season.append(heading);
        for(const day of [...days].sort((a,b)=>b-a)){
          const row=document.createElement('div');row.className='archive-day';const label=document.createElement('strong');label.textContent=`Day ${day}`;row.append(label);
          for(const [text,route] of [['Read stories','#stories'],['Watch TV','#tv']]){
            const button=document.createElement('button');button.textContent=text;
            button.addEventListener('click',()=>{
              archiveNavigation(team.fingerprint,year,day);el.archiveTeam.value=String(team.id);el.tvStorySelect.value='0';
              el.historicalTitle.textContent=`${team.name} · ${year} · Day ${day}`;
              location.hash=route;view();
            });row.append(button);
          }season.append(row);
        }branch.append(season);
      }el.archiveTree.append(branch);
    }
  }
  function render() {
    el.feed.replaceChildren();
    const stories = selectedStories();
    if (!stories.length) {
      const empty = document.createElement("div"); empty.className = "panel muted";
      empty.textContent = state.busy&&state.raw ? "Preparing your league’s daily coverage…" : "No archived stories for this selection yet. Load a save and generate daily stories to begin.";
      el.feed.appendChild(empty);pruneImageURLs();return;
    }
    for (const story of stories) {
      const node = el.articleTemplate.content.cloneNode(true);
      node.querySelector(".article-meta").textContent = `${story.type} · Season ${story.season} · Day ${story.day}`;
      node.querySelector(".article-headline").textContent = story.headline;
      const figure = node.querySelector(".article-image");
      if (story.imageBlob) {
        const url = imageURL(story.imageBlob);
        const caption=window.HoopWireScenes.caption(story.sceneInputs,story)||story.imageCaption||story.headline;
        const image = figure.querySelector("img"); image.src = url; image.alt = caption;
        figure.querySelector("figcaption").textContent = caption;
      } else figure.remove();
      const paragraphs=window.HoopWireSeason.articleParagraphs(story);
      const reviewLists=story.type==='Regular-season review'?window.HoopWireSeason.seasonReviewLists(story):[];
      for(const group of reviewLists){
        const section=document.createElement('section');section.className='season-summary';
        const heading=document.createElement('h3');heading.textContent=group.label;
        const list=document.createElement('ul');list.className='season-summary-list';
        for(const text of group.items){
          const item=document.createElement('li'),separator=text.indexOf(': ');
          if(separator>=0){
            const name=document.createElement('strong');name.textContent=text.slice(0,separator);
            const stats=document.createElement('span');stats.textContent=' '+text.slice(separator+2);
            item.append(name,stats);
          }else item.textContent=text;
          list.appendChild(item);
        }
        section.append(heading,list);node.querySelector('.article-body').appendChild(section);
      }
      for (const text of reviewLists.length?[]:paragraphs) {
        const p = document.createElement("p"); p.textContent = text; node.querySelector(".article-body").appendChild(p);
      }
      el.feed.appendChild(node);
    }
    pruneImageURLs();
  }
  function selectedStories() {
    return [...state.stories.values()].filter(s => s.fingerprint === el.archiveLeague.value &&
      String(s.season) === el.archiveSeason.value && s.day === Number(el.archiveDay.value) && (!el.archiveTeam.value || storyTeams(s).some(t=>String(t.id)===el.archiveTeam.value)))
      .sort((a,b) => b.importance - a.importance || (b.gid||0)-(a.gid||0) || a.id.localeCompare(b.id));
  }
  function courtWarnings(stories) {
    const count = stories.filter(s => s.customCourt?.status === "unavailable").length;
    return count ? ` ${count} custom court ${count === 1 ? "image could" : "images could"} not load; saved court layouts were used.` : "";
  }
  async function loadSave(file) {
    status("Loading the save and preparing the HoopWire TV studio…");
    const parsed = JSON.parse(await file.text()); C.assertSave(parsed);
    state.raw = parsed; state.leagueIndex = 0;state.scope=parsed.seasonLeagues.map(C.buildFingerprint);
    archiveNavigation();controls();
    location.hash="#newsroom";view();
    const snapshots = [], leagues = [];
    for (const league of parsed.seasonLeagues) {
      const fingerprint = C.buildFingerprint(league);
      const previous = state.leagues.find(l => l.id === fingerprint);
      const studios = {...previous?.studios};
      const year = C.seasonYear(league);
      if (!studios[year] || studios[year].inputs?.version < 4) studios[year] = await window.HoopWireTV.render(window.HoopWireTV.inputs(league));
      const gameResults=structuredClone(previous?.gameResults || {});
      gameResults[year] ||= {};
      const lookup=C.buildLookups(league);
      for(const {game,dayIndex} of lookup.completed){
        gameResults[year][dayIndex+1] ||= {};
        gameResults[year][dayIndex+1][game.gId] ||= {gid:game.gId,home:{id:game.homeTeam,name:C.teamDisplay(lookup.teams.get(game.homeTeam)),score:game.homeScore},away:{id:game.awayTeam,name:C.teamDisplay(lookup.teams.get(game.awayTeam)),score:game.awayScore}};
      }
      leagues.push({id:fingerprint, name:league.leagueName || "League",studios,gameResults});
      // The active save is authoritative for its current verified player box scores.
      // Rewriting the same snapshot id refreshes stale browser-archive values.
      snapshots.push(...C.captureSnapshots(league,fingerprint));
    }
    await archive.write({snapshots,leagues,meta:[{id:"active-leagues",ids:state.scope}]});
    state.raw = parsed; state.leagueIndex = 0;
    el.fileName.textContent = file.name;

    await readArchive();
    let total=0;
    for(let index=0;index<parsed.seasonLeagues.length;index++){
      state.leagueIndex=index;
      total+=await generate();
    }
    state.leagueIndex=0;
    const league=selectedLeague();
    archiveNavigation(C.buildFingerprint(league),C.seasonYear(league),C.buildLookups(league).latestDay+1);
    view();
    status(`Save loaded. Archived ${total} new or upgraded stories across ${parsed.seasonLeagues.length} leagues. Refreshed ${snapshots.length} verified player box scores from this save.`);

  }
  async function generate() {
    const league = selectedLeague(), fingerprint = C.buildFingerprint(league);
    const stories = [];
    const contexts = pending();
    status(`Composing ${contexts.length} story images…`);
    const composed = await Promise.all(contexts.map(async ctx => {
      const existing = state.stories.get(C.storyId(fingerprint,ctx.seasonYear,ctx.game.gId));
      const story = C.generateArticle(ctx,fingerprint,existing?.quotesEnabled ?? true);
      window.HoopWireRecords.enrich(story,league);
      if (existing) story.createdAt = existing.createdAt;
      if(existing?.imageBlob&&existing.playerStats&&existing.coach?.id===story.coach?.id){for(const key of ['imageBlob','sceneInputs','imageAlt','imageCaption','customCourt'])if(existing[key]!==undefined)story[key]=existing[key];}
      else Object.assign(story, await window.HoopWireScenes.render(window.HoopWireScenes.inputs(ctx,story.id)));
      return story;
    }));
    stories.push(...composed);
    const milestoneIds=new Set();
    const milestones=[...window.HoopWireSeason.candidates(league,state.raw.seasonLeagues),...window.HoopWireRecords.candidates(league),...window.HoopWireNews.candidates(league)].filter(x=>{if(milestoneIds.has(x.story.id))return false;milestoneIds.add(x.story.id);const existing=state.stories.get(x.story.id);return !existing||Number(x.story.editorialVersion||0)>Number(existing.editorialVersion||0);});
    // Compose in small batches to keep long season uploads responsive.
    for(let i=0;i<milestones.length;i+=4){
      stories.push(...await Promise.all(milestones.slice(i,i+4).map(async ({story,context})=>{
        const old=state.stories.get(story.id);
        if(old){for(const key of ['day','createdAt','imageBlob','sceneInputs','imageAlt','imageCaption','customCourt'])if(old[key]!==undefined)story[key]=old[key];return story;}
        const scene=window.HoopWireScenes.inputs(context,story.id);
        if(context.potg)scene.kind='interview';
        Object.assign(story,await window.HoopWireScenes.render(scene));return story;
      })));
    }
    await archive.write({stories});
    await readArchive();
    archiveNavigation(fingerprint,C.seasonYear(league),C.buildLookups(league).latestDay+1);
    status(`Archived ${stories.length} new or upgraded ${stories.length === 1 ? "story" : "stories"}, including images and stats.${courtWarnings(stories)}`);
    return stories.length;
  }
  async function refreshImages() {
    const selected = selectedStories().filter(s => s.sceneInputs);
    status(`Refreshing ${selected.length} story images…`);
    const contexts = new Map();
    for (const league of state.raw?.seasonLeagues || []) {
      const fingerprint = C.buildFingerprint(league);
      for (const ctx of C.candidates(league,fingerprint,state.snapshots,"full")) contexts.set(C.storyId(fingerprint,ctx.seasonYear,ctx.game.gId),ctx);
    }
    const stories = await Promise.all(selected.map(async original => {
      const story = structuredClone(original);
      const scene = window.HoopWireScenes.upgrade(story.sceneInputs,story,contexts.get(story.id));
      Object.assign(story,await window.HoopWireScenes.render(scene));
      return story;
    }));
    await archive.write({stories}); await readArchive(); render(); renderTV();
    status(`Refreshed ${stories.length} story images. Article text and stats were preserved.${courtWarnings(stories)}`);
  }
  function view() {
    const leagueRoute=location.hash.match(/^#league-(\d+)$/);
    if(leagueRoute&&state.raw?.seasonLeagues[Number(leagueRoute[1])])state.leagueIndex=Number(leagueRoute[1]);
    let route = leagueRoute ? '#newsroom' : ["#newsroom","#tv","#archive","#stories"].includes(location.hash) ? location.hash : "#welcome";
    if(state.ready&&!canOpen(route)){history.replaceState(null,'','#welcome');route='#welcome';}
    document.body.classList.toggle("entry-screen",route==="#welcome");
    for(const id of ["welcome","newsroom","archive","tv"]) document.getElementById(id).classList.toggle("hidden",route !== `#${id}`);
    document.getElementById("historicalStories").classList.toggle("hidden",route!=="#stories");
    el.feed.classList.toggle("hidden",!["#newsroom","#stories"].includes(route));
    el.status.classList.toggle("hidden",["#tv","#newsroom"].includes(route)||!el.status.textContent);
    if(route==="#newsroom") {
      el.archiveTeam.value="";
      const league=selectedLeague();
      if(league) archiveNavigation(C.buildFingerprint(league),C.seasonYear(league),C.buildLookups(league).latestDay+1);
      else archiveNavigation(el.archiveLeague.value,"","");
      el.newsroomDay.textContent=el.archiveSeason.value ? `${el.archiveLeague.selectedOptions[0]?.textContent} · ${el.archiveSeason.value} · Day ${el.archiveDay.value}` : "Load a save to create today's coverage, or browse the archive.";
    }
    for (const link of document.querySelectorAll(".nav a")) {
      if (link.getAttribute("href") === location.hash) link.setAttribute("aria-current","page");
      else link.removeAttribute("aria-current");
    }
    render();renderTV();
  }
  function currentLeagueForStory(story) {
    return (state.raw?.seasonLeagues||[]).find(l=>C.buildFingerprint(l)===story.fingerprint&&String(C.seasonYear(l))===String(story.season))||null;
  }
  function currentSaveSnapshots(story) {
    const league=currentLeagueForStory(story);
    if(!league)return [];
    return C.captureSnapshots(league,story.fingerprint).filter(s=>s.gid===story.gid);
  }
  function tvStoryFromCurrentSave(story) {
    const live=structuredClone(story),league=currentLeagueForStory(story);
    if(!league)return live;
    if(live.gameSummary){
      const snaps=currentSaveSnapshots(story);
      const snap=snaps.find(s=>s.pid===live.playerId)||(snaps.length===1?snaps[0]:null);
      if(snap){
        live.playerId=snap.pid;
        live.playerStats=structuredClone(snap.stats);
      }
    }
    const featured=live.seasonSnapshot?.featuredPlayer;
    if(featured?.id!=null){
      const player=C.buildLookups(league).players.get(featured.id);
      if(player){
        featured.regularStats=window.HoopWireSeason.stats(player,league,story.season,'season');
        featured.playoffStats=window.HoopWireSeason.stats(player,league,story.season,'playoffs');
        featured.finalsStats=window.HoopWireSeason.stats(player,league,story.season,'finals');
      }
    }
    return live;
  }
  function boxScore(story) {
    const box=document.createElement('div');box.className='box-score';
    if(story.kind==='season'){
      const facts=window.HoopWireSeason.factsForStory(story);
      const meta=document.createElement('div');meta.className='season-facts-meta';
      const type=document.createElement('strong');type.textContent=story.type;
      const year=document.createElement('span');year.textContent=String(story.season);
      meta.append(type,year);box.append(meta);
      const wrap=document.createElement('div');wrap.className='box-table-scroll season-facts-scroll';
      const table=document.createElement('table');table.className='season-facts-table';
      const head=document.createElement('thead'),hr=document.createElement('tr');
      for(const text of facts.headers){const th=document.createElement('th');th.scope='col';th.textContent=text;hr.append(th);}head.append(hr);table.append(head);
      const body=document.createElement('tbody');for(const values of facts.rows){const tr=document.createElement('tr');for(const [i,value] of values.entries()){const td=document.createElement('td');td.dataset.label=facts.headers[i];td.textContent=value;tr.append(td);}body.append(tr);}table.append(body);wrap.append(table);box.append(wrap);return box;
    }
    const label=document.createElement('div');label.className='box-result';label.textContent=`Final · ${story.season} · Day ${story.day}`;box.append(label);
    const teams=storyTeams(story);
    const scoreRow=document.createElement('div');scoreRow.className='scoreboard';
    // Older articles retain their text; recover only an unambiguous result from the opening recap.
    if(!story.gameSummary){const opening=story.paragraphs?.[0] || '',match=opening.match(/(\d+)[–-](\d+)/);const winner=teams.find(t=>opening.startsWith(t.name));if(match&&winner){teams.forEach(t=>t.score=Number(match[t.id===winner.id?1:2]));}}
    for(const team of teams){
      const side=document.createElement('div');side.className='score-team';
      if(window.HoopWireCourt.validURL(team.logoURL)){const logo=document.createElement('img');logo.src=team.logoURL;logo.alt=`${team.name} logo`;logo.addEventListener('error',()=>logo.remove(),{once:true});side.append(logo);}
      const name=document.createElement('strong');name.textContent=team.name;
      const score=document.createElement('b');score.textContent=team.score ?? '—';side.append(name,score);scoreRow.append(side);
    }
    box.append(scoreRow);
    const liveSnaps=currentSaveSnapshots(story);
    const snaps=liveSnaps.length?liveSnaps:[...state.snapshots.values()].filter(s=>s.fingerprint===story.fingerprint&&String(s.season)===String(story.season)&&s.gid===story.gid);
    const highlights=document.createElement('div');highlights.className='tv-postgame-highlights';
    for(const team of teams){
      const rows=snaps.filter(s=>s.team.id===team.id&&C.validStats(s.stats)).sort((a,b)=>b.stats.PTS-a.stats.PTS||a.pid-b.pid);
      const snap=rows.find(s=>s.pid===story.playerId)||rows[0];
      const card=document.createElement('section');card.className='tv-postgame-player';
      const label=document.createElement('span');label.className='tv-postgame-label';label.textContent=`${team.name} · ${snap?.pid===story.playerId?'Player of the game':'Scoring leader'}`;
      card.append(label);
      if(!snap){label.textContent=team.name;const note=document.createElement('p');note.className='muted';note.textContent='Player stats unavailable.';card.append(note);highlights.append(card);continue;}
      const name=document.createElement('h3');name.textContent=C.playerDisplay(snap.player);card.append(name);
      card.append(tvStatGrid(['Player','PTS','REB','AST','STL','BLK'],[name.textContent,snap.stats.PTS,snap.stats.REB,snap.stats.AST,snap.stats.STL,snap.stats.BLK]));
      const shooting=[];
      for(const [m,a,label] of [['FGM','FGA','FG'],['TPM','TPA','3PT']])if(Number.isInteger(snap.stats[m])&&Number.isInteger(snap.stats[a])&&snap.stats[a]>0&&snap.stats[m]>=0&&snap.stats[m]<=snap.stats[a])shooting.push(`${snap.stats[m]}–${snap.stats[a]} ${label}`);
      if(Number.isInteger(snap.stats.TO)&&snap.stats.TO>=0)shooting.push(`${snap.stats.TO} TO`);
      if(shooting.length){const line=document.createElement('p');line.className='tv-postgame-shooting';line.textContent=shooting.join(' · ');card.append(line);}
      highlights.append(card);
    }
    box.append(highlights);
    return box;
  }
  function tvStoryKicker(story) {
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return 'AWARD SPOTLIGHT';
    if(story.eventKey?.startsWith('playoff-round-')||story.type==='Playoff preview')return 'PLAYOFF DESK';
    if(story.eventKey==='championship'||story.type==='Championship review')return 'CHAMPIONSHIP DESK';
    if(story.type==='Regular-season review'||story.type==='Team season review'||story.type==='Season leaders')return 'SEASON WRAP';
    if(story.gameSummary)return 'POSTGAME';
    return 'HOOPWIRE DESK';
  }
  function tvStatGrid(headers,row,preferred=null) {
    const grid=document.createElement('div');grid.className='tv-stat-grid';
    const choices=(preferred||headers.map((_,i)=>i)).filter(i=>i>0&&i<headers.length&&row[i]!=null&&row[i]!=='—').slice(0,6);
    for(const i of choices){
      const card=document.createElement('div');card.className='tv-stat-card';
      const value=document.createElement('strong');value.textContent=row[i];
      const label=document.createElement('span');label.textContent=headers[i];
      card.append(value,label);grid.append(card);
    }
    return grid;
  }
  function tvSeasonGraphic(story) {
    const shell=document.createElement('div');shell.className='tv-season-graphic';
    const facts=window.HoopWireSeason.factsForStory(story),headers=facts.headers||[],rows=facts.rows||[];
    if(story.eventKey?.startsWith('award-')&&rows[0]){
      const featured=story.seasonSnapshot?.featuredPlayer?.name||rows[0][0];
      const name=document.createElement('div');name.className='tv-feature-name';name.textContent=featured;shell.append(name);
      const preferred=['GP','PPG','RPG','APG','FG%','3P%'].map(label=>headers.indexOf(label)).filter(i=>i>0);
      shell.append(tvStatGrid(headers,rows[0],preferred));
      return shell;
    }
    if(story.eventKey?.startsWith('playoff-round-')){
      const grid=document.createElement('div');grid.className='tv-matchup-grid';
      for(const row of (story.seasonSnapshot?.rows||[])){
        const card=document.createElement('div');card.className='tv-matchup-card';
        const teams=document.createElement('div');teams.className='tv-matchup-teams';
        const a=document.createElement('strong');a.textContent=row[0];
        const vs=document.createElement('span');vs.textContent='vs';
        const b=document.createElement('strong');b.textContent=row[1];
        teams.append(a,vs,b);card.append(teams);
        if(row[2]){const format=document.createElement('small');format.textContent=row[2];card.append(format);}
        grid.append(card);
      }
      shell.append(grid);return shell;
    }
    const grid=document.createElement('div');grid.className='tv-fact-grid';
    for(const row of rows.slice(0,6)){
      const card=document.createElement('div');card.className='tv-fact-card';
      const title=document.createElement('strong');title.textContent=row[0]??story.headline;card.append(title);
      const details=document.createElement('div');details.className='tv-fact-values';
      for(let i=1;i<Math.min(headers.length,row.length);i++){
        if(row[i]==null||row[i]==='—')continue;
        const item=document.createElement('span');
        const label=document.createElement('small');label.textContent=headers[i];
        const value=document.createElement('b');value.textContent=row[i];
        item.append(label,value);details.append(item);
      }
      card.append(details);grid.append(card);
    }
    shell.append(grid);return shell;
  }
  function tvStoryPanel(story) {
    const panel=document.createElement('section');panel.className='tv-story-details';
    const header=document.createElement('header');header.className='tv-story-header';
    const kicker=document.createElement('span');kicker.className='tv-story-kicker';kicker.textContent=tvStoryKicker(story);
    const title=document.createElement('h2');title.textContent=story.headline;
    header.append(kicker,title);panel.append(header);
    panel.append(story.kind==='season'?tvSeasonGraphic(story):boxScore(story));
    return panel;
  }
  function renderTV() {
    window.HoopWireBroadcast?.stop();
    const stories = selectedStories();
    const league = state.leagues.find(l => l.id === el.archiveLeague.value);
    const studio = league?.studios?.[el.archiveSeason.value];
    el.tvStudio.hidden = !studio?.imageBlob;
    el.tvDeskForeground.hidden = !studio?.backdropBlob;
    el.tvDeskForeground.removeAttribute("src");
    el.tvHosts.replaceChildren();
    if(studio?.imageBlob) {
      const url = imageURL(studio.backdropBlob || studio.imageBlob);el.tvStudio.src=url;el.tvStudio.alt=studio.imageAlt;
      // The archived desk must cover animated hosts, just as in the still composition.
      if(studio.backdropBlob) el.tvDeskForeground.src=url;
      el.tvStudioCaption.textContent = `Illustrated broadcast with exclusive HoopWire hosts${studio.adsStatus === "loaded" ? " and league advertisement artwork" : studio.adsStatus === "unavailable" ? "; league ads could not load" : ""}.`;
      for(const person of studio.inputs.announcers) {const span=document.createElement("span");span.textContent=C.playerDisplay(person);el.tvHosts.appendChild(span);}
    } else {
      el.tvStudio.removeAttribute("src");
      el.tvStudioCaption.textContent = "Load a league save to create the HoopWire studio for this season.";
    }
    const previousIndex = Math.min(Number(el.tvStorySelect.value || 0),Math.max(0,stories.length-1));
    options(el.tvStorySelect,stories.map((s,i)=>[i,s.headline]),previousIndex);
    el.tvSegment.replaceChildren();
    const story=stories[previousIndex],tvStory=story?tvStoryFromCurrentSave(story):null;
    window.HoopWireBroadcast?.mount(tvStory,studio,false);
    if(tvStory) el.tvSegment.appendChild(tvStoryPanel(tvStory));
    else el.tvSegment.textContent="Choose an archived day with stories to start the broadcast.";
    const results=new Map(Object.values(league?.gameResults?.[el.archiveSeason.value]?.[el.archiveDay.value] || {}).map(g=>[g.gid,g]));
    for(const article of state.stories.values())if(article.fingerprint===league?.id&&String(article.season)===el.archiveSeason.value&&article.day===Number(el.archiveDay.value)&&article.gameSummary&&!results.has(article.gid))results.set(article.gid,{gid:article.gid,...article.gameSummary});
    el.tvTicker.replaceChildren();el.tvTicker.hidden=!studio?.imageBlob||!results.size;
    if(results.size){
      const text=[...results.values()].sort((a,b)=>a.gid-b.gid).map(g=>`${g.away.name} ${g.away.score} — ${g.home.name} ${g.home.score}`).join('   •   ');
      el.tvTicker.setAttribute('aria-label',`Day ${el.archiveDay.value} final results: ${text}`);
      const badge=document.createElement('strong');badge.className='results-badge';badge.textContent='FINAL';
      const window=document.createElement('div');window.className='results-window';window.tabIndex=0;
      const track=document.createElement('div');track.className='results-track';track.style.animationDuration=`${Math.max(25,text.length*.12)}s`;
      for(let i=0;i<2;i++){const copy=document.createElement('span');copy.textContent=text+'   •   ';copy.setAttribute('aria-hidden','true');track.append(copy);}
      window.append(track);el.tvTicker.append(badge,window);
    }
    pruneImageURLs();
    controls();
  }
  for(const [button,step] of [[el.previousArchiveLeague,-1],[el.nextArchiveLeague,1]])button.addEventListener('click',()=>{
    const leagues=accessibleLeagues();
    const index=leagues.findIndex(l=>l.id===el.archiveLeague.value);
    const next=leagues[(index+step+leagues.length)%leagues.length];
    if(next)archiveNavigation(next.id,'','');
  });
  el.resetArchive.addEventListener('click',()=>{
    state.resetFingerprint=el.archiveLeague.value;
    const league=state.leagues.find(l=>l.id===state.resetFingerprint);
    el.resetTitle.textContent=`Reset ${league?.name || 'league'} Archive?`;
    el.resetDescription.textContent='This removes this league’s saved stories, images, box scores, and TV episodes from this browser. Other leagues are kept. Export a backup first if you want to keep a copy.';
    el.resetDialog.showModal();
  });
  el.cancelReset.addEventListener('click',()=>el.resetDialog.close());
  el.confirmReset.addEventListener('click',()=>{
    el.resetDialog.close();
    run(async()=>{await archive.reset(state.resetFingerprint);await readArchive();archiveNavigation();view();status('League archive reset. Other leagues were preserved.');});
  });
  el.newsroomLeague.addEventListener('change',()=>{
    state.leagueIndex=Number(el.newsroomLeague.value);
    el.archiveTeam.value='';
    view();
  });
  el.saveFile.addEventListener("change", () => { const file = el.saveFile.files[0]; if(file) run(() => loadSave(file)); el.saveFile.value = ""; });
  el.archiveLeague.addEventListener("change", () => archiveNavigation(el.archiveLeague.value,"",""));
  el.archiveSeason.addEventListener("change", () => archiveNavigation(el.archiveLeague.value,el.archiveSeason.value,""));
  el.archiveTeam.addEventListener("change",()=>{render();renderTV();controls();});
  el.archiveDay.addEventListener("change",() => {render();renderTV();controls();});
  el.refreshImagesButton.addEventListener("click",() => run(refreshImages));
  el.tvStorySelect.addEventListener("change",renderTV);
  el.tvPrevious.addEventListener("click",()=>{el.tvStorySelect.value=String(Number(el.tvStorySelect.value)-1);renderTV();});
  el.tvNext.addEventListener("click",()=>{el.tvStorySelect.value=String(Number(el.tvStorySelect.value)+1);renderTV();});
  window.addEventListener("hashchange",view);
  el.exportButton.addEventListener("click", () => run(async () => {
    const backup = await archive.exportData(el.archiveLeague.value);
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)],{type:"application/json"}));
    const link = document.createElement("a"); link.href = url; link.download = `hoopwire-archive-${new Date().toISOString().slice(0,10)}.json`; link.click();
    setTimeout(() => URL.revokeObjectURL(url),10000);
    status(`Exported ${backup.stories.length} archived stories with images and stat snapshots.`);
  }));
  for(const input of [el.importFile])input.addEventListener('change',()=>{
    const file=input.files[0];input.value='';
    if(file)run(async()=>{const data=JSON.parse(await file.text());const count=await archive.importData(data);if(!state.raw){state.scope=data.leagues.map(l=>l.id);await archive.write({meta:[{id:'active-leagues',ids:state.scope}]});}await readArchive();archiveNavigation();controls();status(`Imported ${count} stories. Existing archived records were preserved.`);});
  });
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');
    if(link){const target=link.getAttribute('href');const route=/^#league-/.test(target)?'#newsroom':target;if(['#newsroom','#archive','#tv','#stories'].includes(route)&&(!canOpen(route)||link.getAttribute('aria-disabled')==='true'))event.preventDefault();}
  });
  controls(); view();
  run(async () => {
    await archive.open(); await readArchive(); state.ready = true; archiveNavigation();view();
    const upgraded=[];
    for(const league of state.leagues){
      const studios={...league.studios};let changed=false;
      for(const [season,studio] of Object.entries(studios))if(studio.inputs?.version<4){
        status('Updating the HoopWire TV studio…');
        const fresh=await window.HoopWireTV.render({...studio.inputs,version:4});
        if(studio.adsStatus==='loaded'&&fresh.adsStatus==='unavailable')throw new Error('TV studio could not be updated because its advertisement artwork is unavailable. The saved studio was preserved.');
        studios[season]=fresh;changed=true;
      }
      if(changed)upgraded.push({...league,studios});
    }
    if(upgraded.length){await archive.write({leagues:upgraded});await readArchive();archiveNavigation();status('HoopWire TV is ready with host discussions and fitted sponsor artwork.');}
    if (archive.migrationError) status(`The old archive could not be migrated: ${archive.migrationError} Its original copy has been retained. Your daily archive is still available.`);
  });
})();
