/* In-season context and record watches. All statistics originate in the uploaded save. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./season-coverage'));
  else root.HoopWireRecords=factory(root.HoopWireCore,root.HoopWireSeason);
})(globalThis,function(C,S){
  'use strict';
  const names={PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',BLK:'blocks',TPM:'three-pointers',FGM:'field goals',FTM:'free throws',TO:'turnovers'};
  const steps={PTS:1000,REB:500,AST:500,STL:100,BLK:100,TPM:250,FGM:1000,FTM:500};
  const notableHigh={PTS:20,REB:15,AST:10,STL:5,BLK:5,TPM:5,FGM:10,FTM:10};
  const valid=n=>Number.isInteger(n)&&n>=0;
  function history(p,league,period='season'){
    const years=[...new Set((p.stats||[]).filter(x=>x.league===league.leagueType&&x.yr<=C.seasonYear(league)).map(x=>x.yr))];
    const lines=years.filter(y=>{
      const entries=(p.stats||[]).filter(s=>s.league===league.leagueType&&s.yr===y).flatMap(s=>s[period]||[]);
      return entries.length&&!entries.every(s=>['GP','PTS','REB','AST'].every(k=>s[k]===0));
    }).map(y=>S.stats(p,league,y,period));
    if(!lines.length||lines.some(s=>!s))return null;
    const sum={};for(const k of ['GP',...Object.keys(names)])if(lines.every(s=>valid(s[k])))sum[k]=lines.reduce((n,s)=>n+s[k],0);
    return sum.GP>0?sum:null;
  }
  function data(league){
    const lookup=C.buildLookups(league),year=C.seasonYear(league),players=new Map(lookup.players);
    for(const p of [...(league.retirees||[]),...(league.hallOfFame||[])])if(!players.has(p.id))players.set(p.id,p);
    const snapshots=C.captureSnapshots(league).filter(s=>s.day===lookup.latestDay+1);
    return {league,lookup,year,players,snapshots};
  }
  function periodFor(game){return game.tRound>0?'playoffs':game.gameType===0?'season':null;}
  function contextFor(d,snap){
    const player=d.players.get(snap.pid),entry=d.lookup.completed.find(x=>x.game.gId===snap.gid);
    if(!player||!entry)return null;
    const period=periodFor(entry.game);if(!period)return null;
    const season=S.stats(player,d.league,d.year,period),career=history(player,d.league,period);
    if(!season||!career)return null;
    return {player,game:entry.game,period,season,career,gameStats:snap.stats};
  }
  function enrich(story,league){
    if(!story.playerId)return story;
    const d=data(league),snap=d.snapshots.find(s=>s.pid===story.playerId&&s.gid===story.gid);
    const facts=snap&&contextFor(d,snap);if(!facts)return story;
    const {player,season,career,period}=facts,stage=period==='season'?'regular season':'playoffs';
    const last=player.ln||C.surname(C.playerDisplay(player)),avg=k=>(season[k]/season.GP).toFixed(1),game=story.playerStats||facts.gameStats;
    const big=season.GP>1&&valid(game?.PTS)&&game.PTS>=1.75*season.PTS/season.GP&&game.PTS-season.PTS/season.GP>=3;
    const minutes=Number.isFinite(season.MIN)?` in ${avg('MIN')} minutes`:'';
    const line=`${last} is averaging ${avg('PTS')} points, ${avg('REB')} rebounds and ${avg('AST')} assists per game${minutes} ${period==='season'?'this season':'in the playoffs'}.`;
    // Season context belongs beside the box score, ahead of the postgame quotes.
    const he=C.pronoun(player),text=big?`That was a big night by ${C.possessive(last)} standards. ${he?`${C.capitalize(he)} came into the night`:last+' came in'} averaging ${((season.PTS-game.PTS)/(season.GP-1)).toFixed(1)} points per game ${period==='season'?'this season':'in the playoffs'}.`:line;
    const at=story.paragraphs.findIndex(p=>/^[“"]/.test(p));
    if(at>=0)story.paragraphs.splice(at,0,text);else story.paragraphs.push(text);
    story.cumulativeStats=structuredClone({season,career,period,year:d.year,leagueType:league.leagueType});
    story.statContextVersion=1;return story;
  }
  function candidates(league){
    const d=data(league),{lookup,year,players}=d,fp=C.buildFingerprint(league),day=lookup.latestDay+1,result=[];
    if(day<1)return result;
    function add(key,type,headline,paragraphs,team,player,evidence,game){
      if(!team||!paragraphs.length)return;
      const opponent=lookup.teams.get(game?.homeTeam===team.id?game.awayTeam:game?.homeTeam)||[...lookup.teams.values()].find(t=>t.id!==team.id);
      const story={id:`${fp}:${year}:season:${key}`,eventKey:key,kind:'season',fingerprint:fp,season:year,day,type,headline,paragraphs,
        importance:type==='Record watch'?75:105,templateVersion:5,editorialVersion:1,quotesEnabled:true,leagueName:league.leagueName,createdAt:new Date().toISOString(),
        relatedTeams:[{id:team.id,name:C.teamDisplay(team),logoURL:team.logoURL||null}],
        seasonSnapshot:{headers:['Category','Mark','Context'],rows:evidence.map(e=>[e.label,e.value,e.detail]),evidence:structuredClone(evidence),source:'uploaded-save'}};
      const context={winner:team,loser:opponent,home:lookup.teams.get(game?.homeTeam)||team,game:game||{homeTeam:team.id},scenePlayer:player||team.roster?.[0],potg:player,
        potgStatsTrusted:!!player,gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}};
      result.push({story,context});
    }
    // Individual milestones require a matched box score to establish when a threshold was crossed.
    for(const snap of d.snapshots){
      const f=contextFor(d,snap);if(!f)continue;
      const {player,season,career,period,game}=f,team=lookup.teams.get(player.tid),name=C.playerDisplay(player),stage=period==='season'?'regular-season':'playoff';
      if(season.GP<2)continue;
      const paragraphs=[],evidence=[];
      for(const [k,label] of Object.entries(names)){
        const value=snap.stats[k];if(!valid(value)||value===0)continue;
        for(const [scope,total,step] of [['season',season,steps[k]],['career',career,steps[k]*2]]){
          if(!step||!valid(total[k])||total[k]<value||scope==='career'&&career.GP===season.GP)continue;
          const mark=Math.floor(total[k]/step)*step;
          if(mark>=step&&total[k]-value<mark){paragraphs.push(`${paragraphs.length?C.surname(name):name} reached ${mark.toLocaleString('en-US')} ${scope==='career'?'career ':''}${stage} ${label}${paragraphs.length?'':`, adding ${value} against ${C.teamRef(lookup.teams.get(game.homeTeam===team.id?game.awayTeam:game.homeTeam)).full}`} ${paragraphs.length?'as well':`to bring the total to ${total[k].toLocaleString('en-US')}`}.`);evidence.push({label:`${scope} ${label}`,value:total[k],detail:`Milestone: ${mark}`,before:total[k]-value,mark,stats:structuredClone(total),gameId:game.gId});}
        }
        const high=player.careerStats?.[period==='season'?'seasonHighs':'playoffHighs']?.[k];
        if(career.GP>=10&&valid(high)&&high===value&&value>=notableHigh[k]){paragraphs.push(`${paragraphs.length?C.surname(name):name} set a ${stage} career high with ${value} ${label}${paragraphs.length?' along the way':''}.`);evidence.push({label:`Career game high: ${label}`,value,detail:stage,source:'careerStats',gameId:game.gId});}
        const entries=(league.records?.[period]?.[k]||[]).filter(r=>valid(r.value)&&r.gameResults?.league===league.leagueType);
        const max=entries.length?Math.max(...entries.map(r=>r.value)):null;
        const record=entries.find(r=>r.pid===player.id&&r.yr===year&&r.gameResults.gId===game.gId&&r.value===value);
        if(record&&value===max){paragraphs.push(`Those ${value} ${label} also stand atop the league's ${stage} single-game record book.`);evidence.push({label:`League game record: ${label}`,value,detail:stage,record:structuredClone(record)});}
        const teamEntries=entries.filter(r=>r.tid===team.id);
        if(record&&teamEntries.length&&value===Math.max(...teamEntries.map(r=>r.value))){paragraphs.push(`It is also the ${C.teamDisplay(team)} franchise record for ${label} in a game.`);evidence.push({label:`Team player game record: ${label}`,value,detail:C.teamDisplay(team),record:structuredClone(record)});}
      }
      if(paragraphs.length)add(`milestone-${period}-${player.id}-${game.gId}`,evidence.some(e=>e.mark)?'Milestone':'Single-game record',evidence[0].mark?`${name} reaches ${evidence[0].mark.toLocaleString('en-US')} ${evidence[0].label}`:`${name} posts ${evidence[0].label.startsWith('Career')?'a career-best':'a record-book'} ${evidence[0].value} ${evidence[0].label.split(': ').at(-1)}`,paragraphs,team,player,evidence,game);
    }
    // The record book can substantiate a single-game mark even after a box score is overwritten.
    for(const period of ['season','playoffs','finals'])for(const [k,label] of Object.entries(names)){
      const entries=(league.records?.[period]?.[k]||[]).filter(r=>valid(r.value)&&r.gameResults?.league===league.leagueType&&C.isCompleted(r.gameResults,lookup.teams,league.currentGame));
      if(!entries.length)continue;
      const max=Math.max(...entries.map(r=>r.value));
      if(max===0)continue;
      for(const record of entries.filter(r=>r.value===max&&r.yr===year)){
        const played=lookup.completed.find(x=>x.game.gId===record.gameResults.gId&&x.dayIndex===lookup.latestDay);
        const p=players.get(record.pid),team=lookup.teams.get(record.tid);
        if(!played||!p||!team||result.some(x=>x.story.seasonSnapshot.evidence.some(e=>e.record?.pid===p.id&&e.record?.gameResults?.gId===played.game.gId&&e.record?.value===record.value)))continue;
        add(`single-game-${period}-${p.id}-${k.toLowerCase()}-${played.game.gId}`,'Single-game record',`${C.playerDisplay(p)} posts a league-record ${record.value} ${label}`,
          [`${C.possessive(C.playerDisplay(p))} ${record.value} ${label} against ${C.teamRef(lookup.teams.get(played.game.homeTeam===team.id?played.game.awayTeam:played.game.homeTeam)).full} stand atop the league's ${period==='season'?'regular-season':period==='finals'?'Finals':'playoff'} single-game record book.`],team,p,
          [{label:`Single-game ${label}`,value:record.value,detail:period,record:structuredClone(record)}],played.game);
      }
    }
    // Compare current totals with prior seasons and the league's career leaderboard from player histories.
    const careerLeaders=[...players.values()].map(p=>({p,s:history(p,league)})).filter(x=>x.s);
    const prior=[];
    for(const p of players.values())for(const yr of new Set((p.stats||[]).filter(s=>s.league===league.leagueType&&s.yr<year).map(s=>s.yr))){const s=S.stats(p,league,yr);if(s)prior.push({p,s,yr});}
    for(const player of lookup.players.values()){
      const team=lookup.teams.get(player.tid),season=S.stats(player,league,year),career=history(player,league);
      if(!team||!season||season.GP<5)continue;
      for(const [k,label] of Object.entries(names)){
        if(k==='TO')continue;
        for(const [scope,total,pool] of [['season',season,prior],['career',career,careerLeaders.filter(x=>x.p.id!==player.id)]]){
          if(!valid(total?.[k])||scope==='career'&&(!career||career.GP===season.GP))continue;
          const ranked=pool.filter(x=>valid(x.s[k])).sort((a,b)=>b.s[k]-a.s[k]);if(!ranked.length||ranked[0].s[k]<=0)continue;
          const record=ranked[0],gap=record.s[k]-total[k];
          if(gap<=0){
            const snap=d.snapshots.find(s=>s.pid===player.id),f=snap&&contextFor(d,snap);
            const otherCurrent=scope==='season'?[...players.values()].filter(p=>p.id!==player.id).map(p=>S.stats(p,league,year)?.[k]).filter(valid):[];
            if(f?.period==='season'&&valid(snap.stats[k])&&snap.stats[k]>0&&(gap===0?total[k]-snap.stats[k]<record.s[k]:total[k]-snap.stats[k]<=record.s[k])&&(!otherCurrent.length||total[k]>=Math.max(...otherCurrent))){
              const name=C.playerDisplay(player),holder=C.playerDisplay(record.p);
              add(`record-${scope}-${gap===0?'tie':'break'}-${player.id}-${k.toLowerCase()}-${record.s[k]}`,'League record',`${name} ${gap===0?'ties':'passes'} ${holder} in the record book`,
                [`${name} has ${total[k]} ${scope==='season'?'regular-season':'career regular-season'} ${label}, ${gap===0?'matching':'surpassing'} ${holder}'s ${record.s[k]}. ${snap.stats[k]} against ${C.teamRef(lookup.teams.get(f.game.homeTeam===team.id?f.game.awayTeam:f.game.homeTeam)).full} put ${C.surname(name)} ${gap===0?'level':'over the top'}.`],team,player,
                [{label:`${scope} ${label}`,value:total[k],detail:`Previous mark: ${record.s[k]}`,holder:record.p.id,source:'player.stats'}],f.game);
            }
            continue;
          }
          if(gap>Math.max(1,Math.min(record.s[k]*.05,season[k]/season.GP*3)))continue;
          // A season-total watch expires when the team's regular season is over.
          if(scope==='season'&&(team.season||[]).find(s=>s.yr===year)?.seasonStats?.GP>=league.season?.totalGames)continue;
          const name=C.playerDisplay(player),holder=C.playerDisplay(record.p),title=scope==='season'?'single-season mark':'career lead';
          add(`watch-${scope}-${player.id}-${k.toLowerCase()}-${record.p.id}-${record.s[k]}`,'Record watch',`${name} closes in on ${holder}'s ${title}`,
            [`${name} is ${C.plural(gap,label.replace(/s$/,''))} shy of ${C.possessive(holder)} ${Number(record.s[k]).toLocaleString('en-US')}, the ${league.shortName||league.leagueName} ${scope==='season'?'single-season':'career'} record. ${C.surname(name)} is at ${Number(total[k]).toLocaleString('en-US')}${scope==='season'?' this season, with the chase still on':''}.`],team,player,
            [{label:`${scope} ${label}`,value:total[k],detail:`${gap} behind ${holder}`,target:record.s[k],holder:record.p.id,recordYear:record.yr??null,source:'player.stats'}]);
        }
      }
    }
    // Team scoring highs/lows need a complete regular-season schedule to date.
    for(const team of lookup.teams.values()){
      const games=lookup.completed.filter(x=>periodFor(x.game)==='season'&&[x.game.homeTeam,x.game.awayTeam].includes(team.id));
      const teamYear=(team.season||[]).find(s=>s.yr===year)?.seasonStats;
      if(!teamYear||games.length!==teamYear.GP||games.length<6)continue;
      for(const entry of games.filter(x=>x.dayIndex===lookup.latestDay)){
        const score=g=>g.homeTeam===team.id?g.homeScore:g.awayScore;
        const earlier=games.filter(x=>x.dayIndex<entry.dayIndex);if(earlier.length<5)continue;
        const value=score(entry.game),high=Math.max(...earlier.map(x=>score(x.game))),low=Math.min(...earlier.map(x=>score(x.game)));
        if(value<=high&&value>=low)continue;
        const direction=value>high?'high':'low';
        const T=C.teamRef(team),O=C.teamRef(lookup.teams.get(entry.game.homeTeam===team.id?entry.game.awayTeam:entry.game.homeTeam));
        add(`team-scoring-${direction}-${team.id}-${entry.game.gId}`,'Team record',`${T.nickname} ${C.verb(T,'hit')} season ${direction} with ${value} points`,
          [direction==='high'?`${C.capitalize(T.full)} scored ${value} points against ${O.full}, their most in a game this season. The previous high was ${high}.`:
            `${C.capitalize(T.full)} managed just ${value} points against ${O.full}, their lowest output of the season. The previous low was ${low}.`],team,null,
          [{label:`Team season scoring ${direction}`,value,detail:`Previous: ${direction==='high'?high:low}`,gameId:entry.game.gId,source:'season.schedule'}],entry.game);
      }
    }
    return result;
  }
  function eligibleGames(league){const d=data(league);return new Set(d.snapshots.filter(s=>contextFor(d,s)).map(s=>`${s.pid}:${s.gid}`));}
  return {history,enrich,candidates,eligibleGames};
});
