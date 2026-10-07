/* Archive-backed editorial editions; selection never depends on upload time. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HoopWireNewsroom=factory();
})(globalThis,function(){
  'use strict';
  const priority=(a,b)=>(b.importance||0)-(a.importance||0)||a.id.localeCompare(b.id);
  function leagueInfo(league,stories){
    const types=[...new Set(stories.filter(s=>s.fingerprint===league.id).map(s=>s.seasonSnapshot?.leagueType).filter(t=>t===0||t===1))];
    return {...league,leagueType:[0,1].includes(league.leagueType)?league.leagueType:(types.length===1?types[0]:null)};
  }
  function buildEdition({stories,leagues,fingerprint=null}){
    const known=new Map(leagues.map(l=>[l.id,leagueInfo(l,stories)]));
    const scoped=stories.filter(s=>known.has(s.fingerprint)&&(fingerprint===null||s.fingerprint===fingerprint));
    const editions=[],pool=[];
    for(const league of known.values()){
      const all=scoped.filter(s=>s.fingerprint===league.id);if(!all.length)continue;
      const season=Math.max(...all.map(s=>Number(s.season))),current=all.filter(s=>Number(s.season)===season);
      const days=[...new Set(current.map(s=>s.day))].sort((a,b)=>b-a).slice(0,3);
      const candidates=current.filter(s=>days.includes(s.day));
      for(const story of candidates)pool.push({story,offset:days.indexOf(story.day)});
      const results=league.gameResults?.[season]||{},resultDays=Object.keys(results).map(Number).filter(d=>Object.values(results[d]||{}).some(validGame)).sort((a,b)=>b-a);
      let scoreDay=resultDays[0],games=scoreDay?Object.values(results[scoreDay]).filter(validGame):[];
      if(!games.length){
        const recaps=current.filter(s=>s.gameSummary&&validGame(s.gameSummary));scoreDay=Math.max(0,...recaps.map(s=>s.day));
        games=[...new Map(recaps.filter(s=>s.day===scoreDay).map(s=>[s.gid,{gid:s.gid,...s.gameSummary}])).values()];
      }
      editions.push({league,season,day:days[0],scoreDay,games:games.sort((a,b)=>(a.gid||0)-(b.gid||0))});
    }
    pool.sort((a,b)=>a.offset-b.offset||priority(a.story,b.story));
    const used=new Set(),take=entry=>{if(!entry)return null;used.add(entry.story.id);return entry.story;};
    const lead=take(pool.find(e=>e.offset===0));
    const supporting=[];
    if(fingerprint===null&&lead){const other=pool.find(e=>e.story.fingerprint!==lead.fingerprint&&!used.has(e.story.id));if(other)supporting.push(take(other));}
    while(supporting.length<3){const next=pool.find(e=>!used.has(e.story.id));if(!next)break;supporting.push(take(next));}
    const headlines=[];while(headlines.length<6){const next=pool.find(e=>!used.has(e.story.id));if(!next)break;headlines.push(take(next));}
    const sections=[];
    const addSection=(label,filter,limit)=>{const items=pool.filter(e=>!used.has(e.story.id)&&filter(e.story)).slice(0,limit).map(take);if(items.length)sections.push({label,items});};
    if(fingerprint!==null)addSection(`More from ${known.get(fingerprint)?.name||'the league'}`,()=>true,8);
    else{
      addSection('Pro Basketball',s=>known.get(s.fingerprint)?.leagueType===0,4);
      addSection('College Basketball',s=>known.get(s.fingerprint)?.leagueType===1,4);
      addSection('More coverage',s=>known.get(s.fingerprint)?.leagueType==null,4);
    }
    const tvStory=pool.map(e=>e.story).find(s=>known.get(s.fingerprint)?.studios?.[s.season]?.imageBlob)||null;
    return {lead,supporting,headlines,sections,editions,leagues:[...known.values()],tvStory,title:fingerprint!==null?`${known.get(fingerprint)?.shortName||known.get(fingerprint)?.name||'League'} News`:'The Daily Wire'};
  }
  function validGame(g){return g?.home?.name&&g?.away?.name&&Number.isFinite(g.home.score)&&Number.isFinite(g.away.score);}
  function summary(story,paragraphs){
    const text=(paragraphs||story.paragraphs||[]).find(p=>typeof p==='string'&&p.trim())||'';
    const sentence=text.match(/^.*?[.!?](?:\s|$)/)?.[0]?.trim()||text;
    return sentence.length>180?sentence.slice(0,177).replace(/\s+\S*$/,'')+'…':sentence;
  }
  return {buildEdition,leagueInfo,summary};
});
