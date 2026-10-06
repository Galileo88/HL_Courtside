/* NewsData event values verified from the game's enum metadata, not sample outcomes. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./records-coverage'),require('./season-coverage'));
  else root.HoopWireNews=factory(root.HoopWireCore,root.HoopWireRecords,root.HoopWireSeason);
})(globalThis,function(C,R,S){
  'use strict';
  const types={2:'Draft',3:'Signing',5:'Roster move',6:'Waivers',7:'Trade',10:'Injury',11:'Injury return',12:'Award announcement',13:'Championship review',14:'Commitment',15:'Draft declaration',16:'Retirement announcement',17:'Retirement',18:'Player option',19:'Player option',20:'Team option',21:'Team option',22:'Hall of Fame',25:'Jersey retirement',26:'Coaching change',27:'Coaching change',28:'Coaching change',29:'Coach retirement',30:'Contract extension',31:'Trade request'};
  function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])]));return value;}
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
            else if(asset.draftPick?.yr>0&&asset.draftPick?.rd>0)item=`a ${asset.draftPick.yr} round-${asset.draftPick.rd} pick`;
            else {invalid=true;break;}
            outgoing.push(`${item} to ${C.teamDisplay(destination)}`);rows.push([C.teamDisplay(lookup.teams.get(side.tid)),item,C.teamDisplay(destination)]);
          }
          if(outgoing.length)paragraphs.push(`${C.teamDisplay(lookup.teams.get(side.tid))} send ${outgoing.join(' and ')}.`);
        }
        if(invalid||!rows.length)continue;
        headline=`${related.map(C.teamDisplay).join(' and ')} complete a trade`;
      }else if(event.type===13){
        if(!team)continue;headline=`${teamName} crowned ${year} champions`;paragraphs=[`${teamName} have won the ${league.shortName||league.leagueName} championship.`];rows=[['Champion',teamName,year]];
      }else{
        if(!player)continue;
        if(!team&&[16,17,22,29].includes(event.type)){team=lookup.teams.get(player.tid);related=team?[team]:[];}
        if(!team&&![16,17,22,29].includes(event.type))continue;
        switch(event.type){
          case 2:{const pick=info.draftPick;if(!Number.isInteger(pick?.rd)||pick.rd<1)continue;headline=`${teamName} select ${name}`;paragraphs=[`${teamName} select ${name} in round ${pick.rd}${pick.pk>0?`, pick ${pick.pk}`:''} of the draft.`];break;}
          case 3:headline=`${name} signs with ${teamName}`;paragraphs=[`${teamName} have signed ${name}${info.contract?.yrs>0?` to a ${info.contract.yrs}-year deal`:''}.`];break;
          case 5:case 6:headline=`${teamName} ${event.type===6?'waive':'release'} ${name}`;paragraphs=[`${teamName} have ${event.type===6?'waived':'released'} ${name}.`];break;
          case 10:{const games=info.injury?.gamesOut;headline=`${teamName} lose ${name} to injury`;paragraphs=[`${name} has been sidelined by an injury${Number.isInteger(games)&&games>0?`, with an expected absence of ${games} game${games===1?'':'s'}`:''}.`];break;}
          case 11:headline=`${name} cleared to return for ${teamName}`;paragraphs=[`${name} has recovered from injury, giving ${teamName} another option in the rotation.`];break;
          case 12:{const award=(league.awards||[]).find(a=>a.id===info.awardId);if(!award||award.id===0)continue;headline=`${name} wins ${award.name}`;paragraphs=[`${name} has won the ${year} ${award.name} award in ${league.shortName||league.leagueName}.`];break;}
          case 14:headline=`${name} commits to ${teamName}`;paragraphs=[`${teamName} have landed a commitment from ${name}.`];break;
          case 15:headline=`${name} declares for the draft`;paragraphs=[`${name} has declared for the draft.`];break;
          case 16:headline=`${name} announces plans to retire`;paragraphs=[`${name} has announced plans to retire. The announcement brings a career in ${league.shortName||league.leagueName} toward its closing chapter.`];break;
          case 17:headline=`${name} calls it a career`;paragraphs=[`${name} has retired from basketball.`];break;
          case 18:case 19:case 20:case 21:{const accepted=[18,20].includes(event.type),owner=event.type<20?'player':'team';headline=`${name}: ${owner} option ${accepted?'accepted':'declined'}`;paragraphs=[`${event.type<20?name:teamName} ${accepted?'exercised':'declined'} the ${owner} option on ${name}'s contract.`];break;}
          case 22:headline=`${name} enters the Hall of Fame`;paragraphs=[`${name} has been inducted into the ${league.shortName||league.leagueName} Hall of Fame.`];break;
          case 25:if(!Number.isInteger(jersey?.num)||jersey.num<0)continue;headline=`${teamName} retire ${name}'s No. ${jersey.num}`;paragraphs=[`${teamName} have retired No. ${jersey.num} in honor of ${name}.`];break;
          case 26:headline=`${teamName} hire ${name}`;paragraphs=[`${name} joins the ${teamName} coaching staff.`];break;
          case 27:case 28:headline=`${teamName} part ways with ${name}`;paragraphs=[`${teamName} have ${event.type===28?'fired':'released'} coach ${name}.`];break;
          case 29:headline=`Coach ${name} retires`;paragraphs=[`${name} has retired from coaching.`];break;
          case 30:headline=`${teamName} extend ${name}`;paragraphs=[`${teamName} and ${name} have agreed to a contract extension${info.contract?.ext?.yrs>0?` for ${info.contract.ext.yrs} years`:''}.`];break;
          case 31:headline=`${name} requests a trade`;paragraphs=[`${name} has requested a trade from ${teamName}. A request does not establish that a deal has been completed.`];break;
        }
        if(!headline)continue;
        if(!coachEvent){
          const career=R.history(player,league);
          if(career&&[16,17,22,25].includes(event.type)){paragraphs.push(`${name}'s ${league.shortName||league.leagueName} regular-season career spans ${career.GP} games, ${career.PTS} points, ${career.REB} rebounds and ${career.AST} assists.`);rows.push(['Career points',career.PTS,'Regular season'],['Career rebounds',career.REB,'Regular season'],['Career assists',career.AST,'Regular season']);}
        }
        rows.unshift(['Event',type,name]);
      }
      if(event.type===10&&team){const record=(team.season||[]).find(r=>r.yr===year);paragraphs.push(...S.quoteLines(`${fp}:${year}:injury:${event.pid}:${event.date}`,record,false,C.coachForTeam(team),player,'injury'));}
      // An unattached retired player can still receive league-wide Hall of Fame coverage.
      if(!related.length)related=[...lookup.teams.values()];
      team ||= related[0];if(!team)continue;
      const key=event.type===12?`award-${info.awardId}-${event.pid}`:event.type===13?'championship':`news-${C.hashString(JSON.stringify(canonical({league:event.league,phase:event.phase,date:event.date,type:event.type,tid:event.tid,pid:event.pid,gid:event.gid,data:info})))}`;
      if(result.some(x=>x.story.eventKey===key))continue;
      const story={id:`${fp}:${year}:season:${key}`,eventKey:key,kind:'season',fingerprint:fp,season:year,day:Math.max(1,lookup.latestDay+1),type,headline,paragraphs,importance:[16,17,22,25].includes(event.type)?125:85,templateVersion:event.type===10?6:5,quotesEnabled:true,leagueName:league.leagueName,createdAt:new Date().toISOString(),
        relatedTeams:related.map(t=>({id:t.id,name:C.teamDisplay(t),logoURL:t.logoURL||null})),seasonSnapshot:{headers:event.type===7?['From','Asset','To']:['Category','Value','Context'],rows,newsEvent:structuredClone(event),source:'season.news'}};
      const opponent=related.find(t=>t.id!==team.id)||[...lookup.teams.values()].find(t=>t.id!==team.id);
      const featured=!coachEvent&&player&&related.some(t=>t.id===event.tid)?player:null;
      result.push({story,context:{winner:team,loser:opponent,home:team,game:{homeTeam:team.id},scenePlayer:featured||team.roster?.[0],potg:featured,potgStatsTrusted:!!featured,gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}}});
    }
    return result;
  }
  return {candidates,types};
});
