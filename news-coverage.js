/* NewsData event values verified from the game's enum metadata, not sample outcomes. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./records-coverage'),require('./season-coverage'));
  else root.HoopWireNews=factory(root.HoopWireCore,root.HoopWireRecords,root.HoopWireSeason);
})(globalThis,function(C,R,S){
  'use strict';
  const types={2:'Draft',3:'Signing',5:'Roster move',6:'Waivers',7:'Trade',10:'Injury',11:'Injury return',12:'Award announcement',13:'Championship review',14:'Commitment',15:'Draft declaration',16:'Retirement announcement',17:'Retirement',18:'Player option',19:'Player option',20:'Team option',21:'Team option',22:'Hall of Fame',25:'Jersey retirement',26:'Coaching change',27:'Coaching change',28:'Coaching change',29:'Coach retirement',30:'Contract extension',31:'Trade request'};
  function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
  const rounds=['','first-round','second-round','third-round','fourth-round','fifth-round'];
  function seasonLine(player,league,year){
    const s=S.stats(player,league,year);if(!s||s.GP<1)return '';
    const last=player.ln||C.surname(C.playerDisplay(player)),a=k=>(s[k]/s.GP).toFixed(1);
    return `${last} ${player.retired?'averaged':'is averaging'} ${a('PTS')} points, ${a('REB')} rebounds and ${a('AST')} assists in ${C.plural(s.GP,'game')} this season.`;
  }
  const roundupTypes=new Set([2,3,14,15]),roundupSize=4;
  const perGame=(s,k)=>s?.GP>0&&Number.isFinite(s[k])?(s[k]/s.GP).toFixed(1):null;
  function college(p){const s=p?.history?.collegeStats?.season;return s?.GP>0&&Number.isFinite(s.PTS)?s:null;}
  function contextFor(team,lookup,league,player){
    const opponent=[...lookup.teams.values()].find(t=>t.id!==team.id);
    return {winner:team,loser:opponent,home:team,game:{homeTeam:team.id},scenePlayer:player||team.roster?.[0],potg:player||null,potgStatsTrusted:!!player,
      gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}};
  }
  function roundup(list,{league,lookup,players,year,fp,result,day}){
    const type=list[0].type,short=league.shortName||league.leagueName,cap=C.capitalize;
    const rows=list.map(n=>({n,p:players.get(n.pid),t:lookup.teams.get(n.tid)})).filter(x=>x.p&&x.t);
    if(!rows.length)return;
    const T=t=>C.teamRef(t),name=p=>C.playerDisplay(p),last=p=>p.ln||C.surname(name(p));
    let headline,paragraphs=[],table,lead,storyType,headers;
    if(type===2){
      rows.sort((a,b)=>(a.n.data?.draftPick?.rd||9)-(b.n.data?.draftPick?.rd||9)||(a.n.data?.draftPick?.pk||99)-(b.n.data?.draftPick?.pk||99));
      const pick=x=>x.n.data?.draftPick||{},via=x=>{const o=lookup.teams.get(pick(x).otid);return o&&o.id!==x.t.id?` (from ${T(o).nick})`:'';};
      const resume=x=>{const c=college(x.p);return c?` ${C.capitalize(x.p.age?`the ${x.p.age}-year-old`:last(x.p))} averaged ${perGame(c,'PTS')} points, ${perGame(c,'REB')} rebounds and ${perGame(c,'AST')} assists in college.`:'';};
      lead=rows[0];storyType='Draft';
      headline=`${T(lead.t).nickname} ${C.verb(T(lead.t),'take')} ${name(lead.p)} No. ${pick(lead).pk||1} in ${year} draft`;
      paragraphs.push(`${cap(T(lead.t).full)} selected ${name(lead.p)} with the No. ${pick(lead).pk||1} pick in the ${year} ${short} draft${via(lead)}.${resume(lead)}`);
      const next=rows.slice(1,3);
      if(next.length)paragraphs.push(next.map(x=>`${cap(T(x.t).full)} took ${name(x.p)} at No. ${pick(x).pk}${via(x)}.${resume(x)}`).join(' '));
      const rest=rows.slice(3,10);
      if(rest.length)paragraphs.push(`The rest of the top ${C.num(Math.min(10,rows.length))}: ${C.listJoin(rest.map(x=>`${name(x.p)} to ${T(x.t).nick} at No. ${pick(x).pk}`))}.`);
      const roundsUsed=new Set(rows.map(x=>pick(x).rd)).size;
      paragraphs.push(`In all, ${C.plural(rows.length,'player')} ${rows.length===1?'was':'were'} selected over ${C.plural(roundsUsed,'round')}.`);
      headers=['Pick','Team','Player'];table=rows.map(x=>[`${pick(x).rd}-${pick(x).pk}`,C.teamDisplay(x.t),name(x.p)]);
    }else if(type===3){
      const rookie=x=>x.p.history?.draft?.yr===year||x.p.yrs===0;
      const prior=x=>S.stats(x.p,league,year-1)||S.stats(x.p,league,year);
      const vets=rows.filter(x=>!rookie(x)).sort((a,b)=>(Number(perGame(prior(b),'PTS'))||0)-(Number(perGame(prior(a),'PTS'))||0));
      const rookies=rows.filter(rookie).sort((a,b)=>(a.p.history?.draft?.rd||9)-(b.p.history?.draft?.rd||9)||(a.p.history?.draft?.pk||99)-(b.p.history?.draft?.pk||99));
      const deal=x=>x.n.data?.contract?.yrs>0?`${C.num(x.n.data.contract.yrs)}-year deal`:'deal';
      lead=vets[0]||rookies[0];storyType='Free agency';
      const line=x=>{const s=prior(x),ppg=perGame(s,'PTS');return ppg?` ${C.capitalize(last(x.p))} averaged ${ppg} points and ${perGame(s,'REB')} rebounds last season.`:'';};
      if(vets.length){
        headline=`${name(vets[0].p)} signs with ${T(vets[0].t).nickname}${vets.length>1?` as free agency heats up`:''}`;
        paragraphs.push(`${name(vets[0].p)} signed a ${deal(vets[0])} with ${T(vets[0].t).full}, the biggest name in a busy stretch of free agency.${line(vets[0])}`);
        if(vets.length>1)paragraphs.push(`Also on the move: ${C.listJoin(vets.slice(1,6).map(x=>`${name(x.p)} to ${T(x.t).nick}`))}${vets.length>6?`, among ${C.plural(vets.length-6,'other veteran')}`:''}.`);
      }else{
        const top=rookies.find(x=>x.p.history?.draft?.yr===year)||rookies[0],no=top.p.history?.draft?.yr===year&&top.p.history.draft.rd===1?`No. ${top.p.history.draft.pk} pick `:'';
        headline=`${C.plural(rookies.length,'rookie')} sign first contracts, led by ${name(top.p)}`;
        paragraphs.push(`${C.capitalize(C.plural(rookies.length,'rookie'))} signed ${rookies.length===1?'a first contract':'their first contracts'}, led by ${no}${name(top.p)} with ${T(top.t).full}.`);
      }
      if(vets.length&&rookies.length)paragraphs.push(`The rest was routine business: ${C.plural(rookies.length,'rookie')} signed first contracts, including ${name(rookies[0].p)} with ${T(rookies[0].t).full}.`);
      headers=['Team','Player','Years'];table=rows.map(x=>[C.teamDisplay(x.t),name(x.p),x.n.data?.contract?.yrs||'—']);
    }else if(type===14){
      rows.sort((a,b)=>(b.p.pot||0)-(a.p.pot||0)||(b.p.rating||0)-(a.p.rating||0)||a.p.id-b.p.id);
      lead=rows[0];storyType='Recruiting';
      const counts=new Map();for(const x of rows)counts.set(x.t.id,(counts.get(x.t.id)||0)+1);
      const busiest=[...counts].sort((a,b)=>b[1]-a[1])[0];
      headline=`${name(lead.p)} headlines a ${rows.length}-commitment recruiting haul`;
      paragraphs.push(`${name(lead.p)}${lead.p.age?`, ${lead.p.age},`:''} committed to ${T(lead.t).full}, the headliner on a day when ${C.plural(rows.length,'recruit')} made their college choices.`);
      if(rows.length>1)paragraphs.push(`Other top names: ${C.listJoin(rows.slice(1,5).map(x=>`${name(x.p)} to ${T(x.t).nick}`))}.`);
      if(busiest&&busiest[1]>=3)paragraphs.push(`${cap(T(lookup.teams.get(busiest[0])).full)} had the busiest day, landing ${C.plural(busiest[1],'commitment')}.`);
      headers=['School','Recruit','Age'];table=rows.map(x=>[C.teamDisplay(x.t),name(x.p),x.p.age||'—']);
    }else{
      const s=x=>S.stats(x.p,league,year);
      rows.sort((a,b)=>(Number(perGame(s(b),'PTS'))||0)-(Number(perGame(s(a),'PTS'))||0));
      lead=rows[0];storyType='Draft declaration';
      headline=`${name(lead.p)} leads ${C.plural(rows.length,'early entrant')} into the draft`;
      const ppg=x=>perGame(s(x),'PTS');
      paragraphs.push(`${name(lead.p)} of ${T(lead.t).full} declared for the draft${ppg(lead)?` after averaging ${ppg(lead)} points and ${perGame(s(lead),'REB')} rebounds this season`:''}, headlining a group of ${C.plural(rows.length,'player')} who are turning pro.`);
      if(rows.length>1)paragraphs.push(`Also declaring: ${C.listJoin(rows.slice(1,6).map(x=>`${name(x.p)} (${T(x.t).nick}${ppg(x)?`, ${ppg(x)} points per game`:''})`))}.`);
      headers=['Player','School','PPG'];table=rows.map(x=>[name(x.p),C.teamDisplay(x.t),ppg(x)||'—']);
    }
    const item=x=>{const c=college(x.p),cur=S.stats(x.p,league,year),prev=S.stats(x.p,league,year-1);
      return {name:name(x.p),team:C.teamDisplay(x.t),teamCity:x.t.city||null,teamNickname:x.t.name||null,age:x.p.age||null,pick:x.n.data?.draftPick?.pk||null,round:x.n.data?.draftPick?.rd||null,
        years:x.n.data?.contract?.yrs||null,rookie:x.p.yrs===0,college:c?{PTS:perGame(c,'PTS'),REB:perGame(c,'REB'),AST:perGame(c,'AST')}:null,
        season:cur?.GP>0?{PTS:perGame(cur,'PTS'),REB:perGame(cur,'REB')}:null,last:prev?.GP>0?{PTS:perGame(prev,'PTS'),REB:perGame(prev,'REB')}:null};};
    const ordered=type===2?rows:type===3?[...rows].sort((a,b)=>Number(a.p.yrs===0)-Number(b.p.yrs===0)):rows;
    const key=`roundup-${type}-${list[0].phase}-${type===2?year:list[0].date}`;
    if(result.some(x=>x.story.eventKey===key))return;
    const related=[...new Map(rows.map(x=>[x.t.id,x.t])).values()];
    const story={id:`${fp}:${year}:season:${key}`,eventKey:key,kind:'season',fingerprint:fp,season:year,day,type:storyType,headline,paragraphs,
      importance:type===2?120:95,templateVersion:5,editorialVersion:2,quotesEnabled:false,leagueName:league.leagueName,createdAt:new Date().toISOString(),
      relatedTeams:related.map(t=>({id:t.id,name:C.teamDisplay(t),logoURL:t.logoURL||null})),
      seasonSnapshot:{headers,rows:table,source:'season.news',roundup:{type,count:rows.length,items:(type===3?[lead,...ordered.filter(x=>x!==lead)]:ordered).slice(0,12).map(item)}}};
    result.push({story,context:contextFor(lead.t,lookup,league,lead.p)});
  }
  function candidates(league,leagues=[]){
    const cal=calendar(league,leagues);
    // News from the college season keeps its own date; news after it follows the pro calendar.
    const dayOf=n=>cal.over?Math.min(cal.day,Math.max(cal.own,Number(n.date)+1)):cal.own;
    const lookup=C.buildLookups(league),year=C.seasonYear(league),fp=C.buildFingerprint(league),players=new Map(lookup.players),result=[];
    for(const p of [...(league.retirees||[]),...(league.hallOfFame||[])])if(p&&Number.isInteger(p.id)&&!players.has(p.id))players.set(p.id,p);
    const coaches=new Map((league.coaches||[]).map(p=>[p.id,p]));
    for(const t of lookup.teams.values())for(const p of t.frontOffice?.staff||[])coaches.set(p.id,p);
    const currentDay=Number.isInteger(league.season?.currentDay)?league.season.currentDay:lookup.latestDay;
    const firstDay=lookup.latestDay<=currentDay?Math.max(0,lookup.latestDay):Math.max(0,currentDay);
    const phase=league.season?.phase;
    // Offseason phases turn over quickly; the draft, signings and recruiting
    // from the last few phases are still today's news.
    const recentPhase=n=>Number.isInteger(n.phase)&&n.phase<phase&&n.phase>=phase-3&&roundupTypes.has(n.type);
    const events=(league.season?.news||[]).filter(n=>n.league===league.leagueType&&Number.isInteger(n.date)&&types[n.type]&&
      (n.phase===phase?n.date>=firstDay&&n.date<=currentDay:recentPhase(n)));
    // A day with many routine moves becomes one roundup instead of a feed of briefs.
    const grouped=new Map();
    for(const n of events)if(roundupTypes.has(n.type)){const k=`${n.type}:${n.phase}:${n.type===2?'all':n.date}`;if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(n);}
    const bundled=new Set([...grouped.values()].filter(list=>list.length>=roundupSize||list[0].type===2).flat());
    for(const [k,list] of grouped)if(bundled.has(list[0]))roundup(list,{league,lookup,players,year,fp,result,day:dayOf(list[0])});
    for(const event of events.filter(n=>!bundled.has(n))){
      const info=event.data||{},jersey=info.retiredNumber;
      let coachEvent=[26,27,28,29].includes(event.type);
      const personId=event.type===25&&jersey?.pid>0?jersey.pid:event.pid;
      const player=(coachEvent?coaches:players).get(personId)||([22,25].includes(event.type)?coaches.get(personId):null);
      if(player&&[22,25].includes(event.type)&&!players.has(personId))coachEvent=true;
      let team=lookup.teams.get(event.tid),related=team?[team]:[],headline='',paragraphs=[],rows=[];
      const name=player?C.playerDisplay(player):'',teamName=team?C.teamDisplay(team):'',type=types[event.type];
      if(event.type===7){
        const trade=info.trade;
        if(trade?.status!==1||!Array.isArray(trade.teams)||trade.teams.length<2)continue;
        related=trade.teams.map(t=>lookup.teams.get(t.tid));if(related.some(t=>!t))continue;team=related[0];
        let invalid=false;
        for(const side of trade.teams){
          const outgoing=[];
          for(const asset of side.assets||[]){
            // Each side lists its outgoing assets; asset.tid is the destination.
            const destination=lookup.teams.get(asset.tid);if(!destination||destination.id===side.tid){invalid=true;break;}
            let item='';
            if(asset.pid>0){const p=players.get(asset.pid);if(!p){invalid=true;break;}item=C.playerDisplay(p);}
            else if(asset.draftPick?.yr>0&&asset.draftPick?.rd>0)item=`a ${asset.draftPick.yr} ${rounds[asset.draftPick.rd]||`round-${asset.draftPick.rd}`} pick`;
            else {invalid=true;break;}
            outgoing.push(`${item} to ${C.teamDisplay(destination)}`);rows.push([C.teamDisplay(lookup.teams.get(side.tid)),item,C.teamDisplay(destination)]);
          }
          if(outgoing.length)paragraphs.push(`${C.capitalize(C.teamRef(lookup.teams.get(side.tid)).full)} sent ${C.listJoin(outgoing)}.`);
        }
        if(invalid||!rows.length)continue;
        // Two-team deals read as one sentence: who got whom, for what.
        if(trade.teams.length===2){
          const [x,y]=trade.teams.map(t=>({ref:C.teamRef(lookup.teams.get(t.tid)),items:rows.filter(r=>r[0]===C.teamDisplay(lookup.teams.get(t.tid))).map(r=>r[1])}));
          if(x.items.length&&y.items.length)paragraphs=[`${C.capitalize(x.ref.full)} acquired ${C.listJoin(y.items)} from ${y.ref.full} in exchange for ${C.listJoin(x.items)}.`];
        }
        const playerAssets=trade.teams.flatMap(t=>(t.assets||[]).filter(a=>a.pid>0).map(a=>({from:lookup.teams.get(t.tid),to:lookup.teams.get(a.tid),player:players.get(a.pid)})));
        for(const {player:p} of playerAssets.slice(0,2)){const line=seasonLine(p,league,year);if(line)paragraphs.push(line);}
        const lead=playerAssets[0];
        headline=lead?`${C.teamRef(lead.to).nickname} ${C.verb(C.teamRef(lead.to),'acquire')} ${C.playerDisplay(lead.player)} from ${C.teamRef(lead.from).nickname}`:`${related.map(t=>C.teamRef(t).nickname).join(' and ')} ${related.length===2?'swap':'complete'} draft picks`;
      }else if(event.type===13){
        if(!team)continue;headline=`${C.teamRef(team).nickname} crowned ${year} champions`;paragraphs=[`${C.capitalize(C.teamRef(team).full)} are the ${year} ${league.shortName||league.leagueName} champions.`];rows=[[teamName,'Not available',year]];
      }else{
        if(!player)continue;
        if(!team&&[16,17,22,29].includes(event.type)){team=lookup.teams.get(player.tid);related=team?[team]:[];}
        if(!team&&![16,17,22,29].includes(event.type))continue;
        const T=team?C.teamRef(team):null,Full=T?C.capitalize(T.full):'',nick=T?.nickname||'',last=player.ln||C.surname(name),season=coachEvent?'':seasonLine(player,league,year);
        const record=team&&(team.season||[]).find(r=>r.yr===year)?.seasonStats,standing=record&&Number.isInteger(record.W)&&Number.isInteger(record.L)&&record.W+record.L>0?` (${record.W}-${record.L})`:'';
        switch(event.type){
          case 2:{const pick=info.draftPick;if(!Number.isInteger(pick?.rd)||pick.rd<1)continue;headline=`${nick} ${C.verb(T,'take')} ${name}${pick.pk>0?` at No. ${pick.pk}`:` in round ${pick.rd}`}`;paragraphs=[`${Full} selected ${name}${pick.pk>0?` with the No. ${pick.pk} pick`:''}${pick.rd>1||!(pick.pk>0)?` in the ${rounds[pick.rd]?rounds[pick.rd].replace('-round',' round'):`round ${pick.rd}`}`:''} of the draft.`];break;}
          case 3:headline=`${name} signs with ${nick}`;paragraphs=[`${name} signed with ${T.full}${info.contract?.yrs>0?` on a ${C.num(info.contract.yrs)}-year deal`:''}.`,season].filter(Boolean);break;
          case 5:case 6:headline=`${nick} ${C.verb(T,event.type===6?'waive':'release')} ${name}`;paragraphs=[`${Full} ${event.type===6?'waived':'released'} ${name}.`,season].filter(Boolean);break;
          case 10:{const games=info.injury?.gamesOut,known=Number.isInteger(games)&&games>0;headline=known?`${name} out ${C.plural(games,'game')} for ${nick}`:`${nick} ${C.verb(T,'lose')} ${name} to injury`;
            paragraphs=[`${name} will miss ${known?`an estimated ${C.plural(games,'game')}`:'time'} with an injury, a blow to ${T.full}${standing}.`,season?`${season} ${C.capitalize(T.short)} will have to find that production elsewhere.`:''].filter(Boolean);break;}
          case 11:headline=`${name} cleared to return for ${nick}`;paragraphs=[`${name} has recovered from injury, giving ${T.full} another option in the rotation.`,season].filter(Boolean);break;
          case 12:{const award=(league.awards||[]).find(a=>a.id===info.awardId);if(!award||award.id===0)continue;headline=`${name} wins ${award.name}`;paragraphs=[`${name} has won the ${year} ${award.name}${/award$/i.test(award.name)?'':' award'}.`];rows=[[award.name,name,year]];break;}
          case 14:headline=`${name} commits to ${nick}`;paragraphs=[`${Full} landed a commitment from ${name}.`];break;
          case 15:headline=`${name} declares for the draft`;paragraphs=[`${name} has declared for the draft.`,season.replace(' is averaging ',' averaged ')].filter(Boolean);break;
          case 16:headline=`${name} announces plans to retire`;paragraphs=[`${name} has announced plans to retire, putting a ${league.shortName||league.leagueName} career on its final lap.`];break;
          case 17:headline=`${name} calls it a career`;paragraphs=[`${name} has retired from basketball.`];break;
          case 18:case 19:case 20:case 21:{const accepted=[18,20].includes(event.type),owner=event.type<20?'player':'team';headline=`${name}: ${owner} option ${accepted?'accepted':'declined'}`;
            paragraphs=[owner==='player'?`${name} ${accepted?'exercised':'declined'} a player option with ${T.full}.`:`${Full} ${accepted?'picked up':'declined'} the team option on ${C.possessive(name)} contract.`,season].filter(Boolean);break;}
          case 22:headline=`${name} enters the Hall of Fame`;paragraphs=[`${name} has been inducted into the ${league.shortName||league.leagueName} Hall of Fame.`];break;
          case 25:if(!Number.isInteger(jersey?.num)||jersey.num<0)continue;headline=`${nick} ${C.verb(T,'retire')} ${C.possessive(name)} No. ${jersey.num}`;paragraphs=[`${Full} retired No. ${jersey.num} in honor of ${name}. Nobody will wear it for the franchise again.`];break;
          case 26:headline=`${nick} ${C.verb(T,'hire')} ${name}`;paragraphs=[`${name} is joining the ${T.display} coaching staff.`];break;
          case 27:case 28:headline=`${nick} ${C.verb(T,'part')} ways with ${name}`;paragraphs=[`${Full} ${event.type===28?'fired':'released'} coach ${name}${standing?`, with the team at ${standing.slice(2,-1)}`:''}.`];break;
          case 29:headline=`Coach ${name} retires`;paragraphs=[`${name} has retired from coaching.`];break;
          case 30:headline=`${nick} ${C.verb(T,'extend')} ${name}`;paragraphs=[`${Full} and ${name} agreed to a contract extension${info.contract?.ext?.yrs>0?` that adds ${C.plural(info.contract.ext.yrs,'year')}`:''}.`,season].filter(Boolean);break;
          case 31:headline=`${name} requests a trade`;paragraphs=[`${name} has asked ${T.full} for a trade. No deal is in place yet.`,season].filter(Boolean);break;
        }
        if(!headline)continue;
        if(!coachEvent){
          const career=R.history(player,league);
          if(career&&[16,17,22,25].includes(event.type)){paragraphs.push(`${C.surname(name)} averaged ${(career.PTS/career.GP).toFixed(1)} points, ${(career.REB/career.GP).toFixed(1)} rebounds and ${(career.AST/career.GP).toFixed(1)} assists over ${career.GP} regular-season games in ${league.shortName||league.leagueName}.`);rows.push(['Career PPG',(career.PTS/career.GP).toFixed(1),'Regular season'],['Career RPG',(career.REB/career.GP).toFixed(1),'Regular season'],['Career APG',(career.AST/career.GP).toFixed(1),'Regular season']);}
        }
        if(event.type!==12)rows.unshift(['Event',type,name]);
      }
      if(event.type===10&&team){const record=(team.season||[]).find(r=>r.yr===year);paragraphs.push(...S.quoteLines(`${fp}:${year}:injury:${event.pid}:${event.date}`,record,false,C.coachForTeam(team),player,'injury'));}
      // An unattached retired player can still receive league-wide Hall of Fame coverage.
      if(!related.length)related=[...lookup.teams.values()];
      team ||= related[0];if(!team)continue;
      const key=event.type===12?`award-${info.awardId}-${event.pid}`:event.type===13?'championship':`news-${C.hashString(JSON.stringify(canonical({league:event.league,phase:event.phase,date:event.date,type:event.type,tid:event.tid,pid:event.pid,gid:event.gid,data:info})))}`;
      if(result.some(x=>x.story.eventKey===key))continue;
      const story={id:`${fp}:${year}:season:${key}`,eventKey:key,kind:'season',fingerprint:fp,season:year,day:dayOf(event),type,headline,paragraphs,importance:[16,17,22,25].includes(event.type)?125:85,templateVersion:event.type===10?6:5,editorialVersion:1,quotesEnabled:true,leagueName:league.leagueName,createdAt:new Date().toISOString(),
        relatedTeams:related.map(t=>({id:t.id,name:C.teamDisplay(t),logoURL:t.logoURL||null})),seasonSnapshot:{headers:event.type===7?['From','Asset','To']:['Category','Value','Context'],rows,newsEvent:structuredClone(event),source:'season.news'}};
      const opponent=related.find(t=>t.id!==team.id)||[...lookup.teams.values()].find(t=>t.id!==team.id);
      const featured=!coachEvent&&player&&related.some(t=>t.id===event.tid)?player:null;
      result.push({story,context:{winner:team,loser:opponent,home:team,game:{homeTeam:team.id},scenePlayer:featured||team.roster?.[0],potg:featured,potgStatsTrusted:!!featured,gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}}});
    }
    return result;
  }
  // College stops at its title game while the pro league keeps the shared
  // calendar running; coverage written in that gap carries the pro date.
  function calendar(league,leagues=[]){
    const own=Math.max(1,C.buildLookups(league).latestDay+1),year=C.seasonYear(league);
    const over=league.leagueType===1&&(league.season?.news||[]).some(n=>n.type===13&&n.league===league.leagueType&&n.phase===league.season?.phase);
    const pro=over?leagues.find(l=>l!==league&&l.leagueType===0&&C.seasonYear(l)===year):null;
    const proDay=pro?Math.max(1,C.buildLookups(pro).latestDay+1):0;
    return {day:Math.max(own,proDay),own,over,elapsed:Math.max(0,proDay-own)};
  }
  const classes=['Fr.','So.','Jr.','Sr.'],classOf=p=>classes[Math.min(3,Math.max(0,p.yrs|0))];
  // Between the college title game and the new season, the desk keeps the
  // college beat going: who's headed to the draft, who's coming back, and an
  // early look at next season. Each piece runs once, a week apart on the
  // pro calendar, and every number comes from the save.
  function offseason(league,leagues=[]){
    const cal=calendar(league,leagues);if(!cal.over||cal.elapsed<1)return [];
    const lookup=C.buildLookups(league),year=C.seasonYear(league),fp=C.buildFingerprint(league),short=league.shortName||league.leagueName,result=[];
    const name=p=>C.playerDisplay(p),last=p=>p.ln||C.surname(name(p)),T=t=>C.teamRef(t),cap=C.capitalize;
    const rows=[...lookup.players.values()].map(p=>({p,t:lookup.teams.get(p.tid),s:S.stats(p,league,year)})).filter(x=>x.t&&x.s?.GP>0);
    if(rows.length<10)return [];
    const pg=(x,k)=>Number(perGame(x.s,k))||0,line=x=>`${perGame(x.s,'PTS')} points, ${perGame(x.s,'REB')} rebounds and ${perGame(x.s,'AST')} assists`;
    const champion=lookup.teams.get((league.season?.news||[]).find(n=>n.type===13&&n.league===league.leagueType&&n.phase===league.season?.phase)?.tid);
    const statRow=x=>[name(x.p),classOf(x.p),perGame(x.s,'PTS'),perGame(x.s,'REB'),perGame(x.s,'AST')];
    const item=x=>({name:name(x.p),team:C.teamDisplay(x.t),teamCity:x.t.city||null,teamNickname:x.t.name||null,age:x.p.age||null,year:classOf(x.p),senior:x.p.yrs>=3,pronoun:C.pronoun(x.p),season:{PTS:perGame(x.s,'PTS'),REB:perGame(x.s,'REB'),AST:perGame(x.s,'AST')}});
    const push=(key,{type,headline,paragraphs,board,items,lead,kind,extra={}})=>{
      const related=[...new Map((items||[]).map(x=>[x.t.id,x.t])).values()];
      const story={id:`${fp}:${year}:season:${key}`,eventKey:key,kind:'season',fingerprint:fp,season:year,day:cal.day,type,headline,paragraphs,
        importance:90,templateVersion:5,editorialVersion:3,quotesEnabled:false,leagueName:league.leagueName,createdAt:new Date().toISOString(),
        relatedTeams:related.map(t=>({id:t.id,name:C.teamDisplay(t),logoURL:t.logoURL||null})),
        seasonSnapshot:{headers:board.headers,rows:board.rows,board,source:'season.offseason',roundup:{type:kind,count:items.length,items:items.slice(0,12).map(item),...extra}}};
      result.push({story,context:contextFor(lead.t,lookup,league,lead.p)});
    };
    const subs=list=>list.map(x=>C.teamDisplay(x.t));
    // 1. The big board: ceiling first, production as the tiebreaker.
    // Pro teams draft on potential, so it leads the grade; what a player
    // actually produced in college moves him up or down from there.
    const grade=x=>(x.p.pot||0)+(pg(x,'PTS')+pg(x,'REB')/2+pg(x,'AST')*.7)/8;
    const board=[...rows].sort((a,b)=>grade(b)-grade(a)||a.p.id-b.p.id).slice(0,10),onBoard=new Set(board.map(x=>x.p.id));
    {
      const top=board[0],seniors=board.filter(x=>x.p.yrs>=3).length,he=C.pronoun(top.p);
      const paragraphs=[`With the ${year} ${short} season in the books, the draft conversation starts now. ${name(top.p)}, a ${({'Fr.':'freshman','So.':'sophomore','Jr.':'junior','Sr.':'senior'})[classOf(top.p)]} at ${T(top.t).short}, tops HoopWire's big board after averaging ${line(top)}.`,
        top.p.yrs>=3?`${cap(last(top.p))} is out of college eligibility, so the pros are next.`:`${cap(last(top.p))} has college eligibility left, so the question is whether ${he||last(top.p)} leaves early.`,
        `Next on the board: ${C.listJoin(board.slice(1,4).map(x=>`${name(x.p)} (${T(x.t).short}, ${classOf(x.p)})`))}.`,
        ...board.slice(0,4).filter(x=>pg(x,'PTS')<8).slice(0,1).map(x=>`${name(x.p)} scored only ${perGame(x.s,'PTS')} points a game. The board is betting on ${C.possessive(last(x.p))} ceiling, not the box score.`),
        seniors===board.length?`All ten are seniors on their way out.`:seniors===1?`Only one of the top ten is a senior on the way out; the other nine would have to declare early.`:seniors?`${cap(C.num(seniors))} of the top ten are seniors on their way out; the other ${C.num(board.length-seniors)} would have to declare early.`:`None of the top ten are seniors. Every one of them would have to declare early.`];
      push('offseason-draft-watch',{type:'Draft watch',kind:'draft-watch',headline:`Draft watch: ${name(top.p)} tops HoopWire's big board`,paragraphs,items:board,lead:top,
        board:{kicker:'Draft watch',title:'Big board',headers:['Player','Class','PPG','RPG','APG'],rows:board.map(statRow),subs:subs(board),ranked:true},extra:{seniors}});
    }
    // 2. Who's back: the best underclassmen not on the big board's way out.
    if(cal.elapsed>=7){
      const back=rows.filter(x=>x.p.yrs<3&&!onBoard.has(x.p.id)&&x.s.GP>=Math.max(1,Math.floor(Math.max(...rows.map(r=>r.s.GP))/2))).sort((a,b)=>pg(b,'PTS')-pg(a,'PTS')||a.p.id-b.p.id).slice(0,8);
      if(back.length>=3){
        const top=back[0],next=back.slice(1,4),fromChamp=champion&&back.find(x=>x.t.id===champion.id);
        const paragraphs=[`The best scorer coming back next season is ${name(top.p)} of ${T(top.t).full}. The ${classOf(top.p)==='Fr.'?'freshman':classOf(top.p)==='So.'?'sophomore':'junior'} averaged ${line(top)}.`,
          `Also returning: ${C.listJoin(next.map(x=>`${name(x.p)} (${T(x.t).short}, ${perGame(x.s,'PTS')} points)`))}.`,
          fromChamp?`${cap(T(champion).full)} ${C.verb(T(champion),'bring')} back ${name(fromChamp.p)}, who averaged ${perGame(fromChamp.s,'PTS')} points for the ${year} champions.`:'',
          board.some(x=>x.p.yrs<3)?`That list leaves out the underclassmen on HoopWire's big board, who could turn pro early: ${C.listJoin([...board.filter(x=>x.p.yrs<3).slice(0,3).map(x=>name(x.p)),...(board.filter(x=>x.p.yrs<3).length>3?['others']:[])])}.`:'',
          `Declarations could still change this list before next season.`].filter(Boolean);
        push('offseason-returning',{type:'College offseason',kind:'returning',headline:`${name(top.p)} leads the stars returning next season`,paragraphs,items:back,lead:top,
          board:{kicker:'Next season',title:'Top returning scorers',headers:['Player','Class','PPG','RPG','APG'],rows:back.map(statRow),subs:subs(back),ranked:true}});
      }
    }
    // 3. An early top ten, built only from who is back and how much they scored.
    if(cal.elapsed>=14){
      const ranked=[...lookup.teams.values()].map(t=>{
        const roster=rows.filter(x=>x.t.id===t.id),pts=roster.reduce((n,x)=>n+x.s.PTS,0),back=roster.filter(x=>x.p.yrs<3&&!onBoard.has(x.p.id));
        const kept=pts>0?back.reduce((n,x)=>n+x.s.PTS,0)/pts:0,talent=back.map(x=>x.p.pot||0).sort((a,b)=>b-a).slice(0,7),record=(t.season||[]).find(r=>r.yr===year);
        const games=(record?.seasonStats?.W||0)+(record?.seasonStats?.L||0),win=games?record.seasonStats.W/games:0,ceiling=talent.length?talent.reduce((a,b)=>a+b,0)/talent.length:0;
        // Last season's results, scaled by how much of that team returns, plus the ceiling of who's back.
        return {t,back,kept,score:win*kept+ceiling/20,record:record?.seasonStats,poll:record?.poll,star:back.sort((a,b)=>pg(b,'PTS')-pg(a,'PTS'))[0]};
      }).filter(x=>x.back.length&&x.star).sort((a,b)=>b.score-a.score||a.t.id-b.t.id),teams=ranked.slice(0,10);
      if(teams.length>=5){
        const top=teams[0],rec=x=>x.record?`${x.record.W}-${x.record.L}`:'—',pct=x=>Math.round(x.kept*100);
        const paragraphs=[`It is never too early. HoopWire's first look at next season puts ${T(top.t).full} at No. 1. ${T(top.t).plural?'They bring':'It brings'} back ${pct(top)} percent of their scoring, led by ${name(top.star.p)} at ${perGame(top.star.s,'PTS')} points a game.`,
          `Rounding out the top five: ${C.listJoin(teams.slice(1,5).map(x=>`${T(x.t).short} (${rec(x)})`))}.`,
          ...ranked.filter(x=>x.t.id===champion?.id).map(x=>{const at=ranked.indexOf(x)+1;return at<=10?`The ${year} champions, ${T(champion).full}, open at No. ${at}.`:`The ${year} champions, ${T(champion).full}, come in at No. ${at}, with ${pct(x)} percent of their scoring back.`;}),
          `The voters get their say when the new season opens. Until then, this is how we see it: last season's record, the scoring coming back and the talent left on the roster, with every underclassman on our big board already out the door.`].filter(Boolean);
        const lead={p:top.star.p,t:top.t};
        push('offseason-early-top-ten',{type:'College offseason',kind:'early-top-ten',headline:`Way-too-early top 10: ${T(top.t).nickname} ${C.verb(T(top.t),'open')} next season at No. 1`,paragraphs,items:teams.map(x=>x.star),lead,
          board:{kicker:'Next season',title:'HoopWire early top 10',headers:['School','Record','Final poll','Scoring back','Top returner'],rows:teams.map(x=>[C.teamDisplay(x.t),rec(x),x.poll>0?x.poll:'—',`${pct(x)}%`,name(x.star.p)]),ranked:true},
          extra:{championRank:champion?ranked.findIndex(x=>x.t.id===champion.id)+1||null:null,teams:teams.map(x=>({team:C.teamDisplay(x.t),teamCity:x.t.city||null,teamNickname:x.t.name||null,record:rec(x),poll:x.poll||null,kept:pct(x),star:name(x.star.p),starPTS:perGame(x.star.s,'PTS')})),champion:champion?C.teamDisplay(champion):null}});
      }
    }
    return result;
  }
  return {candidates,offseason,calendar,types};
});
