/* Milestone reporting uses saved year records, awards and brackets, not phase numbers. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
  else root.HoopWireSeason=factory(root.HoopWireCore);
})(globalThis,function(C){
  'use strict';
  const keys=['GP','PTS','REB','AST','STL','BLK','FGM','FGA','TPM','TPA','FTM','FTA','TO'];
  function stats(player,league,year,period='season',teamId=null){
    const entries=(player.stats||[]).filter(s=>s.league===league.leagueType&&s.yr===year).flatMap(s=>s[period]||[]).filter(s=>teamId===null||s.tid===teamId);
    if(!entries.length||entries.some(s=>['GP','PTS','REB','AST'].some(k=>!Number.isInteger(s[k])||s[k]<0)))return null;
    const result={};for(const k of keys)if(entries.every(s=>Number.isFinite(s[k])&&s[k]>=0))result[k]=entries.reduce((n,s)=>n+s[k],0);
    return result.GP>0?result:null;
  }
  function avg(s,k){return Number.isFinite(s?.[k])&&s.GP>0?(s[k]/s.GP).toFixed(1):'—';}
  function pct(s,m,a){return Number.isFinite(s?.[m])&&s[a]>0?`${(100*s[m]/s[a]).toFixed(1)}%`:'—';}
  function line(s){return `${avg(s,'PTS')} points, ${avg(s,'REB')} rebounds and ${avg(s,'AST')} assists per game${s.FGA>0?`, shooting ${pct(s,'FGM','FGA')} from the field`:''}${s.TPA>0?` and ${pct(s,'TPM','TPA')} from three`:''}`;}
  function teamLine(name,s){return s?.GP>0&&Number.isFinite(s.PTS)&&Number.isFinite(s.OPP)?`${name} averaged ${avg(s,'PTS')} points and allowed ${avg(s,'OPP')} a night${s.FGA>0?`, shooting ${pct(s,'FGM','FGA')} from the floor`:''}${s.TPA>0?` and ${pct(s,'TPM','TPA')} from deep`:''}.`:'';}
  function playerTable(label,items){return {label,headers:['Player','GP','PPG','RPG','APG','SPG','BPG','FG%','3P%','FT%','PTS','REB','AST'],rows:items.map(({p,s})=>[C.playerDisplay(p),s.GP,...['PTS','REB','AST','STL','BLK'].map(k=>avg(s,k)),pct(s,'FGM','FGA'),pct(s,'TPM','TPA'),pct(s,'FTM','FTA'),s.PTS,s.REB,s.AST])};}
  function factsForStory(story){
    const snapshot=story.seasonSnapshot;
    if(story.eventKey?.startsWith('award-')&&snapshot?.featuredPlayer){
      const person=snapshot.featuredPlayer;
      const postseason=story.statsPeriod==='finals'||snapshot.tables?.some(t=>t.label==='Playoff player statistics');
      const stats=postseason?(person.finalsStats||person.playoffStats):person.regularStats;
      if(stats){const table=playerTable(postseason?'Postseason player statistics':'Player season statistics',[{p:{fn:person.name},s:stats}]);return table;}
    }
    return {headers:snapshot?.headers||[],rows:(snapshot?.rows||[]).slice(0,5)};
  }
  function outcome(record,champion=false,postseason=null){
    if(postseason==='injury')return 'injury';
    if(champion)return 'champion';
    if(['missed','eliminated','runnerup'].includes(postseason))return postseason;
    const s=record?.seasonStats||record,total=(s?.W||0)+(s?.L||0);
    if(!total)return null;
    const rate=s.W/total;
    return rate>=.7?'dominant':rate>=.55?'winning':rate>=.45?'balanced':rate>=.3?'losing':'struggling';
  }
  function postseasonOutcome(teamId,bracket,championId,teams){
    if(championId===teamId)return 'champion';
    const rounds=bracket?.rounds||[],final=rounds.at(-1)?.series;
    if(championId&&final?.length===1&&[final[0].topSeed,final[0].lowerSeed].includes(teamId))return 'runnerup';
    if(rounds.some(r=>(r.series||[]).some(s=>[s.topSeed,s.lowerSeed].includes(teamId)&&s.winner&&s.winner!==teamId)))return 'eliminated';
    const entrants=(rounds[0]?.series||[]).flatMap(s=>[s.topSeed,s.lowerSeed]).filter(id=>teams?teams.has(id):id>0);
    if(entrants.length&&!entrants.includes(teamId))return 'missed';
    return null;
  }
  function quoteLines(id,record,champion,coach,player,postseason=null){
    const tone=outcome(record,champion,postseason);if(!tone)return [];
    const wins=(record?.seasonStats||record)?.W;
    const coachQuotes={
      champion:['This group earned a championship. I could not be prouder of what these players accomplished.','Winning a title takes everybody. This team gave us everything we asked for.'],
      runnerup:['Getting this close and falling short hurts. We wanted to finish the job.','I am proud of the run we made, but losing the championship is a bitter ending.'],
      eliminated:['Getting knocked out is disappointing. We wanted this run to go further.','There is good work to recognize from this season, but this is not the ending we wanted.'],
      missed:['Our standard has to be higher. Too many nights we made the game harder on ourselves, and that is on all of us.','The record says we did not do enough. We need a clearer identity and more consistency from the start of the season to the finish.'],
      injury:['It is disappointing to lose him to injury. We want him healthy, and the rest of the group has to step up.','You hate to see a player go down. We will support him and give him the time he needs.'],
      dominant:[`This group earned every one of those ${wins} wins. I am proud of what we accomplished together.`,`That is an outstanding regular season. Our players deserve a lot of credit for putting together ${wins} wins.`,'We had a tremendous season. I am proud of this team and the success we earned together.'],
      winning:['This was a successful season, and our players deserve credit for it. I am proud of this group.','We earned those wins together. There is a lot to be proud of in the season we put together.'],
      balanced:['We had some good stretches, but consistency is where we have to take the next step.','We showed what we can do. Now we need to bring that level more often.'],
      losing:['We did not win enough games. We have to be more consistent at both ends of the floor.','There were things we could build on, but the results have to get better.'],
      struggling:['The results were not good enough. We have to take responsibility and get better.','It was a tough season. We owe it to this group to turn that work into more wins.']};
    const playerQuotes={
      champion:['We are champions. Everybody in that locker room had a part in this.','We will remember this one. Winning a championship with this group means everything.'],
      runnerup:['Coming this close and losing hurts. We wanted that championship.','We gave ourselves a chance to win it all. Falling short is hard to take.'],
      eliminated:['Getting knocked out hurts. We wanted to keep playing.','This is a disappointing way for our run to end. We wanted more.'],
      missed:['Watching the playoffs from home is going to stay with me. I want to use that all summer and come back sharper.','I keep thinking about the games we let get away. I have to come back better and help make sure next season feels different.'],
      injury:['It is frustrating to be sidelined. I want to be out there helping my teammates.','This is disappointing. My focus now is getting healthy and getting back on the floor.'],
      dominant:[`Winning ${wins} games is something we are proud of. We earned that together.`,'We had a great season. I am proud of this group and what we accomplished.'],
      winning:['We put together a good year. I want us to keep building on it.','There is a lot to be proud of. We earned those wins as a group.'],
      balanced:['We had good nights and tough nights. We have to find more consistency.','We know we can play better. The next step is doing it more often.'],
      losing:['We wanted more wins than this. We have to turn those lessons into better basketball.','The record is not where we wanted it. We have to keep working and get better.'],
      struggling:['It was a tough year. None of us are satisfied with that record.','We have to be honest about how this season went and come back better.']};
    const lines=[];
    if(coach)lines.push(`“${C.choose(id,coachQuotes[tone],'season-coach')}” head coach ${C.playerDisplay(coach)} said.`);
    if(player)lines.push(`“${C.choose(id,playerQuotes[tone],'season-player')}” ${C.playerDisplay(player)} said.`);
    return lines;
  }
  function awardQuoteLines(id,player,coach){
    if(!player)return [];
    const name=C.playerDisplay(player),lines=[];
    const coachQuotes=[
      `${name} earned this recognition with the work and consistency shown all season. The award is well deserved.`,
      `What ${name} brought every day mattered to this team. This honor reflects the level of work behind the performance.`,
      `${name} kept raising the standard. It is good to see that work recognized with this award.`
    ];
    const playerQuotes=[
      'It means a lot to be recognized. A lot of people helped me get here, and I am grateful for that.',
      'I am proud of the work that went into this. The award means a lot, and I want to keep building from it.',
      'You never do this alone. I appreciate everyone who pushed me and trusted me throughout the season.'
    ];
    if(coach)lines.push(`“${C.choose(id,coachQuotes,'award-coach')}” head coach ${C.playerDisplay(coach)} said.`);
    lines.push(`“${C.choose(id,playerQuotes,'award-player')}” ${name} said.`);
    return lines;
  }
  function playoffPreviewParagraphs(active,records,lookup,league,index){
    const series=active.map(s=>{
      const a=records.find(r=>r.team.id===s.topSeed),b=records.find(r=>r.team.id===s.lowerSeed);
      const ar=a?.year?.seasonStats,br=b?.year?.seasonStats;
      if(!a||!b||!ar||!br)return null;
      return {series:s,a,b,ar,br,aName:C.teamDisplay(a.team),bName:C.teamDisplay(b.team),
        gap:Number.isFinite(ar.W)&&Number.isFinite(br.W)?Math.abs(ar.W-br.W):Infinity,
        format:s.firstTo===1?'single-elimination':s.firstTo>1?`best-of-${s.firstTo*2-1}`:'playoff'};
    }).filter(Boolean);
    if(!series.length)return [];
    const round=index+1,roundLabel=round===1?'postseason opener':`playoff round ${round}`;
    const formats=[...new Set(series.map(s=>s.format))];
    const formatText=formats.length===1?`, all ${formats[0]==='single-elimination'?'win-or-go-home':`in ${formats[0]} series`}`:'';
    const participants=new Map();
    for(const s of series)for(const side of [['a',s.a,s.ar,s.aName],['b',s.b,s.br,s.bName]]){
      const [,team,record,name]=side;
      participants.set(team.team.id,{name,record});
    }
    const strongest=[...participants.values()].sort((x,y)=>(y.record.W??-1)-(x.record.W??-1)||(x.record.L??Infinity)-(y.record.L??Infinity));
    const lead=strongest.slice(0,Math.min(3,strongest.length)).map(x=>`${x.name} (${x.record.W}-${x.record.L})`).join(', ');
    const paragraphs=[`The ${league.shortName||league.leagueName} ${roundLabel} is set with ${series.length} matchup${series.length===1?'':'s'}${formatText}. ${lead} bring the strongest regular-season records into this round, but from here every result changes the bracket.`];

    const closest=[...series].sort((x,y)=>x.gap-y.gap||((y.ar.W??0)+(y.br.W??0))-((x.ar.W??0)+(x.br.W??0)))[0];
    if(Number.isFinite(closest?.gap)){
      let detail=`${closest.aName} (${closest.ar.W}-${closest.ar.L}) against ${closest.bName} (${closest.br.W}-${closest.br.L}) is the tightest pairing by regular-season record, separated by ${closest.gap} win${closest.gap===1?'':'s'}.`;
      if(Number.isFinite(closest.ar.PTS)&&Number.isFinite(closest.br.OPP))detail+=` ${closest.aName} averaged ${avg(closest.ar,'PTS')} points a night; ${closest.bName} allowed ${avg(closest.br,'OPP')}.`;
      paragraphs.push(detail);
    }

    const scoring=[];
    for(const s of series){
      if(Number.isFinite(s.ar.PTS)&&s.ar.GP>0&&Number.isFinite(s.br.OPP))scoring.push({off:s.aName,def:s.bName,ppg:Number(avg(s.ar,'PTS')),opp:Number(avg(s.br,'OPP'))});
      if(Number.isFinite(s.br.PTS)&&s.br.GP>0&&Number.isFinite(s.ar.OPP))scoring.push({off:s.bName,def:s.aName,ppg:Number(avg(s.br,'PTS')),opp:Number(avg(s.ar,'OPP'))});
    }
    scoring.sort((a,b)=>b.ppg-a.ppg);
    const spotlight=scoring[0];
    if(spotlight)paragraphs.push(`${spotlight.off} bring the round's highest-scoring offense at ${spotlight.ppg.toFixed(1)} points per game into a matchup with ${spotlight.def}, who allowed ${spotlight.opp.toFixed(1)} a night. That is the opening statistical pressure point to watch as the bracket gets underway.`);
    return paragraphs.slice(0,3);
  }
  function candidates(league){
    const year=C.seasonYear(league),fp=C.buildFingerprint(league),lookup=C.buildLookups(league);
    const day=Math.max(1,lookup.latestDay+1),teams=[...lookup.teams.values()];
    const records=teams.map(t=>({team:t,year:(t.season||[]).find(s=>s.yr===year)}));
    const expected=league.season?.totalGames;
    const complete=Number.isInteger(expected)&&expected>0&&records.length>1&&records.every(r=>r.year?.seasonStats?.GP===expected&&['W','L'].every(k=>Number.isInteger(r.year.seasonStats[k])&&r.year.seasonStats[k]>=0)&&r.year.seasonStats.W+r.year.seasonStats.L===expected);
    const bracket=(league.season?.playoffs||[]).find(p=>p.yr===year);
    const rounds=bracket?.rounds||[];
    const final=rounds.at(-1)?.series;
    const champion=teams.find(t=>t.championships?.yearsWon?.includes(year)&&t.championships.league===league.leagueType);
    const entrants=new Set((rounds[0]?.series||[]).flatMap(s=>[s.topSeed,s.lowerSeed]).filter(id=>lookup.teams.has(id)));
    const confirmedFinal=rounds.length>=Math.ceil(Math.log2(Math.max(2,entrants.size)))&&final?.length===1&&final[0].winner&&lookup.teams.has(final[0].topSeed)&&lookup.teams.has(final[0].lowerSeed)&&[final[0].topSeed,final[0].lowerSeed].includes(final[0].winner);
    const winner=champion||(confirmedFinal?lookup.teams.get(final[0].winner):null);
    const players=new Map(lookup.players);
    for(const p of [...(league.retirees||[]),...(league.hallOfFame||[])])if(!players.has(p.id))players.set(p.id,p);
    const results=[];
    const teamData=t=>({id:t.id,name:C.teamDisplay(t),logoURL:t.logoURL||null});
    function add(eventKey,type,headline,paragraphs,related,headers,rows,featured=null,importance=110){
      const team=related[0]||teams[0],opponent=related[1]||teams.find(t=>t.id!==team.id);
      const s={id:`${fp}:${year}:season:${eventKey}`,eventKey,kind:'season',fingerprint:fp,season:year,day,
        type,headline,paragraphs:paragraphs.filter(Boolean),importance,leagueName:league.leagueName,quotesEnabled:true,templateVersion:7,editorialVersion:3,
        relatedTeams:related.map(teamData),seasonSnapshot:{headers,rows,leagueType:league.leagueType,year,
          teamRecords:related.map(t=>({teamId:t.id,record:structuredClone(records.find(r=>r.team.id===t.id)?.year||null)})),
          featuredPlayer:featured?{id:featured.id,name:C.playerDisplay(featured),regularStats:stats(featured,league,year),playoffStats:stats(featured,league,year,'playoffs'),finalsStats:stats(featured,league,year,'finals'),awards:structuredClone(featured.awards||[])}:null,
          bracket:structuredClone(bracket||null)},createdAt:new Date().toISOString()};
      const teamScope=eventKey.startsWith('team-')||eventKey==='championship';
      const awardStory=eventKey.startsWith('award-');
      const seasonPlayers=[...players.values()].map(p=>({p,s:stats(p,league,year,'season',teamScope?team.id:null)})).filter(x=>x.s&&(!featured||(awardStory?x.p.id===featured.id:related.length!==1||x.p.id===featured.id||eventKey.startsWith('team-')))).sort((a,b)=>b.s.PTS-a.s.PTS);
      const individualTable=related.length===1||eventKey==='championship'||awardStory;
      s.seasonSnapshot.tables=[{label:'Regular-season team statistics',headers:['Team','W','L','PPG','Opp PPG','RPG','APG','FG%','3P%','FT%'],rows:related.map(t=>{const r=records.find(x=>x.team.id===t.id)?.year?.seasonStats;return r?.GP>0?[C.teamDisplay(t),r.W,r.L,...['PTS','OPP','REB','AST'].map(k=>avg(r,k)),pct(r,'FGM','FGA'),pct(r,'TPM','TPA'),pct(r,'FTM','FTA')]:null;}).filter(Boolean)},playerTable(individualTable?'Regular-season player statistics':'Regular-season scoring leaders',individualTable?seasonPlayers:seasonPlayers.slice(0,15))];
      if(eventKey==='championship'||(featured&&(league.awards||[]).some(a=>eventKey.startsWith(`award-${a.id}-`)&&a.phase===3))){
        const postseason=[...players.values()].map(p=>({p,s:stats(p,league,year,'playoffs',eventKey==='championship'?team.id:null)})).filter(x=>x.s&&(eventKey==='championship'||x.p.id===featured?.id));
        if(postseason.length)s.seasonSnapshot.tables.push(playerTable('Playoff player statistics',postseason));
      }
      if(eventKey.startsWith('award-')){
        s.statsPeriod=(league.awards||[]).find(a=>eventKey.startsWith(`award-${a.id}-`))?.phase===3?'finals':'season';
        s.seasonSnapshot.tables=s.seasonSnapshot.tables.filter(t=>!t.label.includes('team statistics'));
      }
      const coach=eventKey.startsWith('award-')&&!related.length?null:C.coachForTeam(team);
      const record=records.find(r=>r.team.id===team.id)?.year;
      const postseason=postseasonOutcome(team.id,bracket,winner?.id,lookup.teams);
      s.coach=coach;s.seasonOutcome=outcome(record,winner?.id===team.id,postseason);
      if(eventKey.startsWith('award-')&&featured)s.paragraphs.push(...awardQuoteLines(s.id,featured,coach));
      else if(related.length===1||eventKey==='championship')s.paragraphs.push(...quoteLines(s.id,record,winner?.id===team.id,coach,featured&&featured.tid===team.id&&stats(featured,league,year)?.GP>0?featured:null,postseason));
      const ctx={winner:team,loser:opponent,home:team,game:{homeTeam:team.id},scenePlayer:featured||team.roster?.[0],potg:featured,
        potgStatsTrusted:!!featured,gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}};
      results.push({story:s,context:ctx});
    }
    if(complete){
      const sorted=[...records].sort((a,b)=>b.year.seasonStats.W-a.year.seasonStats.W||a.team.id-b.team.id);
      add('regular-wrap','Regular-season review',`${league.shortName||league.leagueName}: ${year} regular season in review`,
        [`${sorted.filter(r=>r.year.seasonStats.W===sorted[0].year.seasonStats.W).map(r=>C.teamDisplay(r.team)).join(' and ')} set the pace in ${year}, closing the regular season with ${sorted[0].year.seasonStats.W} wins.`,
          ...sorted.slice(0,3).map(r=>`${C.teamDisplay(r.team)} went ${r.year.seasonStats.W}-${r.year.seasonStats.L}. ${teamLine(C.teamDisplay(r.team),r.year.seasonStats)}`)],teams,
        ['Team','W','L','Seed'],sorted.map(r=>[C.teamDisplay(r.team),r.year.seasonStats.W,r.year.seasonStats.L,r.year.seed||'—']));
      const totals=[...players.values()].map(p=>({p,s:stats(p,league,year)})).filter(x=>x.s);
      const leaderRows=[];
      for(const k of ['PTS','REB','AST','STL','BLK']){
        const eligible=totals.filter(x=>Number.isFinite(x.s[k]));if(!eligible.length)continue;
        const max=Math.max(...eligible.map(x=>x.s[k]));for(const x of eligible.filter(x=>x.s[k]===max))leaderRows.push([k,C.playerDisplay(x.p),max,x.s.GP]);
      }
      if(leaderRows.length)add('leaders','Season leaders',`${year} ${league.shortName||'league'} statistical leaders`,
        leaderRows.map(r=>`${r[1]} ${leaderRows.filter(x=>x[0]===r[0]).length>1?'shared the league lead':'led the league'} in total ${{PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',BLK:'blocks'}[r[0]]} with ${r[2]}, averaging ${(r[2]/r[3]).toFixed(1)} over ${r[3]} appearances.`),teams,['Category','Player','Total','GP'],leaderRows);
      for(const r of records){
        const leaders=[...players.values()].map(p=>({p,s:stats(p,league,year,'season',r.team.id)})).filter(x=>x.s).sort((a,b)=>b.s.PTS-a.s.PTS);
        const p=leaders[0],record=r.year.seasonStats;
        const scoringRank=1+records.filter(x=>x.year.seasonStats.PTS/x.year.seasonStats.GP>record.PTS/record.GP).length;
        const defendingRank=1+records.filter(x=>x.year.seasonStats.OPP/x.year.seasonStats.GP<record.OPP/record.GP).length;
        const margin=Number.isFinite(record.PTS)&&Number.isFinite(record.OPP)?(record.PTS-record.OPP)/record.GP:null;
        const analysis=margin===null?'':`${C.teamDisplay(r.team)} ${margin>=0?'outscored opponents by':'were outscored by'} ${Math.abs(margin).toFixed(1)} points a night, ranking No. ${scoringRank} in scoring and No. ${defendingRank} in fewest points allowed.`;
        add(`team-${r.team.id}-regular`,'Team season review',`${C.teamDisplay(r.team)}: ${record.W>record.L?'a winning season in review':record.W===record.L?'a .500 season in review':'a difficult season in review'}`,
          [`${C.teamDisplay(r.team)} ${record.W>record.L?'closed the regular season at':record.W===record.L?'split the regular season at':'end a difficult regular season at'} ${record.W}-${record.L}${entrants.has(r.team.id)?', with a place in the playoff field':''}.`,teamLine(C.teamDisplay(r.team),record),analysis,
            ...(p?[`${C.playerDisplay(p.p)} led the team in total scoring with ${p.s.PTS} points, averaging ${line(p.s)} in ${p.s.GP} appearances.`]:[])],[r.team],
          ['Player','GP','PTS','REB','AST','STL','BLK'],leaders.slice(0,5).map(x=>[C.playerDisplay(x.p),...['GP','PTS','REB','AST','STL','BLK'].map(k=>x.s[k]??'—')]),leaders.find(x=>x.p.tid===r.team.id)?.p,90);
      }
    }
    for(const award of league.awards||[]){
      if(!award.enabled||award.id===0||![0,3].includes(award.phase)||!(award.phase===0?complete:!!winner))continue;
      for(const p of players.values()){
        if(!(p.awards||[]).some(a=>a.id===award.id&&a.league===league.leagueType&&a.yearsWon?.includes(year)))continue;
        const s=stats(p,league,year,award.phase===3?'finals':'season')||stats(p,league,year,award.phase===3?'playoffs':'season');
        const team=lookup.teams.get(p.tid);
        add(`award-${award.id}-${p.id}`,'Award announcement',`${C.playerDisplay(p)} wins ${award.name}`,
          [`${C.playerDisplay(p)} takes home ${league.leagueName}’s ${year} ${award.name} award.`,...(s?[`${C.playerDisplay(p)} averaged ${line(s)} over ${s.GP} ${award.phase===3?'postseason':'regular-season'} ${s.GP===1?'appearance':'appearances'}.`]:[])],team?[team]:[],
          ['Award','Winner','Year'],[[award.name,C.playerDisplay(p),year]],team?p:null,120);
      }
    }
    if(complete&&!winner){
      rounds.forEach((round,index)=>{
        const active=(round.series||[]).filter(s=>!s.winner&&lookup.teams.has(s.topSeed)&&lookup.teams.has(s.lowerSeed)&&s.topSeed!==s.lowerSeed);
        if(!active.length)return;
        const rows=active.map(s=>[C.teamDisplay(lookup.teams.get(s.topSeed)),C.teamDisplay(lookup.teams.get(s.lowerSeed)),s.firstTo===1?'Single elimination':s.firstTo>1?`Best of ${s.firstTo*2-1}`:'—']);
        add(`playoff-round-${index+1}`,'Playoff preview',`${league.shortName||'League'} playoff round ${index+1}: the matchups`,
          playoffPreviewParagraphs(active,records,lookup,league,index),
          [...new Set(active.flatMap(s=>[s.topSeed,s.lowerSeed]))].map(id=>lookup.teams.get(id)),['Team','Opponent','Format'],rows,null,115);
      });
    }
    if(winner){
      const opponent=confirmedFinal?lookup.teams.get(final[0].topSeed===winner.id?final[0].lowerSeed:final[0].topSeed):null;
      const row=records.find(r=>r.team.id===winner.id)?.year;
      add('championship','Championship review',`${C.teamDisplay(winner)} crowned ${year} ${league.shortName||'league'} champions`,
        [`${C.teamDisplay(winner)} are ${year} champions${opponent?`, defeating ${C.teamDisplay(opponent)} in the championship round`:''}.`,
          ...(row?[`A ${row.seasonStats.W}-${row.seasonStats.L} regular season ends with a championship for ${C.teamDisplay(winner)}.`,teamLine(C.teamDisplay(winner),row.seasonStats),...(row.playoffStats?.GP?[`In the playoffs, ${teamLine(C.teamDisplay(winner),row.playoffStats)}`]:[])]:[])],opponent?[winner,opponent]:[winner],
        ['Champion','Runner-up','Year'],[[C.teamDisplay(winner),opponent?C.teamDisplay(opponent):'Not available',year]],null,140);
    }
    return results;
  }
  return {candidates,stats,outcome,quoteLines,awardQuoteLines,playoffPreviewParagraphs,postseasonOutcome,factsForStory};
});
