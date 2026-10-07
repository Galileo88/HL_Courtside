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
  function candidates(league){
    const lookup=C.buildLookups(league),year=C.seasonYear(league),fp=C.buildFingerprint(league),players=new Map(lookup.players),result=[];
    for(const p of [...(league.retirees||[]),...(league.hallOfFame||[])])if(p&&Number.isInteger(p.id)&&!players.has(p.id))players.set(p.id,p);
    const coaches=new Map((league.coaches||[]).map(p=>[p.id,p]));
    for(const t of lookup.teams.values())for(const p of t.frontOffice?.staff||[])coaches.set(p.id,p);
    const currentDay=Number.isInteger(league.season?.currentDay)?league.season.currentDay:lookup.latestDay;
    const firstDay=lookup.latestDay<=currentDay?Math.max(0,lookup.latestDay):Math.max(0,currentDay);
    const events=(league.season?.news||[]).filter(n=>n.league===league.leagueType&&n.phase===league.season.phase&&Number.isInteger(n.date)&&n.date>=firstDay&&n.date<=currentDay&&types[n.type]);
    for(const event of events){
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
        if(!team)continue;headline=`${C.teamRef(team).nickname} crowned ${year} champions`;paragraphs=[`${C.capitalize(C.teamRef(team).full)} are the ${year} ${league.shortName||league.leagueName} champions.`];rows=[['Champion',teamName,year]];
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
          case 12:{const award=(league.awards||[]).find(a=>a.id===info.awardId);if(!award||award.id===0)continue;headline=`${name} wins ${award.name}`;paragraphs=[`${name} has won the ${year} ${award.name} award in ${league.shortName||league.leagueName}.`];break;}
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
        rows.unshift(['Event',type,name]);
      }
      if(event.type===10&&team){const record=(team.season||[]).find(r=>r.yr===year);paragraphs.push(...S.quoteLines(`${fp}:${year}:injury:${event.pid}:${event.date}`,record,false,C.coachForTeam(team),player,'injury'));}
      // An unattached retired player can still receive league-wide Hall of Fame coverage.
      if(!related.length)related=[...lookup.teams.values()];
      team ||= related[0];if(!team)continue;
      const key=event.type===12?`award-${info.awardId}-${event.pid}`:event.type===13?'championship':`news-${C.hashString(JSON.stringify(canonical({league:event.league,phase:event.phase,date:event.date,type:event.type,tid:event.tid,pid:event.pid,gid:event.gid,data:info})))}`;
      if(result.some(x=>x.story.eventKey===key))continue;
      const story={id:`${fp}:${year}:season:${key}`,eventKey:key,kind:'season',fingerprint:fp,season:year,day:Math.max(1,lookup.latestDay+1),type,headline,paragraphs,importance:[16,17,22,25].includes(event.type)?125:85,templateVersion:event.type===10?6:5,editorialVersion:1,quotesEnabled:true,leagueName:league.leagueName,createdAt:new Date().toISOString(),
        relatedTeams:related.map(t=>({id:t.id,name:C.teamDisplay(t),logoURL:t.logoURL||null})),seasonSnapshot:{headers:event.type===7?['From','Asset','To']:['Category','Value','Context'],rows,newsEvent:structuredClone(event),source:'season.news'}};
      const opponent=related.find(t=>t.id!==team.id)||[...lookup.teams.values()].find(t=>t.id!==team.id);
      const featured=!coachEvent&&player&&related.some(t=>t.id===event.tid)?player:null;
      result.push({story,context:{winner:team,loser:opponent,home:team,game:{homeTeam:team.id},scenePlayer:featured||team.roster?.[0],potg:featured,potgStatsTrusted:!!featured,gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}}});
    }
    return result;
  }
  return {candidates,types};
});
