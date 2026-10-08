/* Milestone reporting uses saved year records, awards and brackets, not phase numbers. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
  else root.HoopWireSeason=factory(root.HoopWireCore);
})(globalThis,function(C){
  'use strict';
  const keys=['GP','GS','PTS','REB','AST','STL','BLK','FGM','FGA','TPM','TPA','FTM','FTA','TO'];
  function honorHistory(name,label,records,leagueType,year,confirmed=false){
    const years=[...new Set(records.filter(r=>r.league===leagueType).flatMap(r=>r.yearsWon||[]).filter(y=>Number.isInteger(y)&&y>0&&y<=year).concat(confirmed?[year]:[]))].sort((a,b)=>a-b);
    let streak=0;for(let y=year;years.includes(y);y--)streak++;
    return {name,label,years,count:years.length,current:years.includes(year),streak};
  }
  function ordinal(n){return ['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'][n]||`${n}${n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;}
  const article=word=>/^(?:[aeiou]|8|1[18](?!\d))/i.test(word)?'an':'a';
  function honorLine(h){
    if(!h||h.count<1)return '';
    const team=h.label==='the championship',who=team?C.teamRef({name:h.name}).full:h.name;
    if(!h.current)return `${C.capitalize(who)} had already won ${h.label} ${h.count===1?'once':h.count===2?'twice':`${h.count} times`} before this season.`;
    if(h.count<2)return '';
    const run=h.streak>1?`, ${h.streak===2?'making it back-to-back':`and the ${ordinal(h.streak)} in a row`}`:'';
    return team?`It's the ${ordinal(h.count)} championship for ${who}${run}.`:`It's the ${ordinal(h.count)} time ${who} has won ${h.label}${run}.`;
  }
  function honorLines(story){
    let h=story.seasonSnapshot?.honorHistory;
    const awardId=Number(String(story.eventKey||'').match(/^award-(\d+)-/)?.[1]),snapshot=story.seasonSnapshot;
    if(!h&&Number.isFinite(awardId)&&snapshot?.featuredPlayer&&snapshot.leagueType!=null){
      const p=snapshot.featuredPlayer;
      const name=snapshot.rows?.[0]?.[0]||'award';
      h=honorHistory(p.name,`the ${name}${/award$/i.test(name)?'':' award'}`,(p.awards||[]).filter(a=>a.id===awardId),snapshot.leagueType,story.season);
    }
    const line=honorLine(h);return line?[line]:[];
  }
  function awardKind(award){
    const n=award?.name||'';
    if(/all-star mvp/i.test(n)||award?.id===100)return 'asmvp';
    if(/all-star/i.test(n)||award?.id===101)return 'allstar';
    if(/3-point|three-point/i.test(n)||award?.id===96)return 'threes';
    if(/defens/i.test(n))return 'dpoy';if(/rookie/i.test(n))return 'roy';if(/sixth/i.test(n))return 'sixth';if(/improv/i.test(n))return 'mip';
    if(award?.id===1||/finals mvp|most outstanding/i.test(n))return 'finals';
    if(award?.id===2||/most valuable|^player of the year$/i.test(n))return 'mvp';
    if(/scor/i.test(n))return 'PTS';if(/rebound/i.test(n))return 'REB';if(/assist/i.test(n))return 'AST';if(/steal/i.test(n))return 'STL';if(/block/i.test(n))return 'BLK';
    return 'other';
  }
  function awardHeadline(kind,name,award,team,year){
    const T=team?C.teamRef(team):null,last=C.surname(name);
    return {mvp:`${name} named ${year} ${award}`,finals:`${name} named ${award}${T?` as ${T.nickname} ${C.verb(T,'win')} title`:''}`,dpoy:`${name} wins ${award}`,
      roy:`${name} runs away with ${award}`,sixth:`${last} wins ${award} off the ${T?`${T.nickname}'`.replace(/s'$/,"s'").replace(/([^s])'$/,"$1's"):''} bench`.replace(/off the  bench/,'off the bench'),mip:`${name} takes ${award} after breakout season`,
      PTS:`${name} wins scoring title`,REB:`${name} wins rebounding title`,AST:`${name} wins assists title`,STL:`${name} wins steals title`,BLK:`${name} wins blocks title`}[kind]||`${name} wins ${award}`;
  }
  const statWord={PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',BLK:'blocks'};
  function awardArticle(story){
    const snap=story.seasonSnapshot,a=snap.award,p=snap.featuredPlayer;
    // The award decides the period: Finals honors use Finals numbers.
    const s=a?.kind==='finals'?p?.finalsStats||p?.playoffStats:featuredStatsForStory(story);
    if(!a||!p)return null;
    const name=p.name,last=C.surname(name),he=a.pronoun?C.capitalize(a.pronoun):last,league=story.leagueName||'the league';
    const T=a.teamName?C.teamRef({city:a.teamCity,name:a.teamNickname||a.teamName}):null,team=T?` of ${T.full}`:'';
    const rec=a.teamRecord?`${a.teamRecord[0]}-${a.teamRecord[1]}`:'',r=k=>s?.GP>0&&Number.isFinite(s[k])?(s[k]/s.GP).toFixed(1):null;
    const out=[];
    const lede={mvp:`${name}${team} is the ${story.season} ${a.name}.`,finals:`${name}${team} was named ${a.name}${a.champion?' after leading the way to the championship':''}.`,
      roy:`${name}${team} is the ${story.season} ${a.name}.`}[a.kind]||`${name}${team} has won the ${story.season} ${a.name}${/award$|title$/i.test(a.name)?'':' award'}.`;
    out.push(lede);
    if(!s?.GP){out.push(...(snap.honorHistory?[]:[]));return out;}
    const fg=s.FGA>0?` on ${pct(s,'FGM','FGA')} shooting`:'';
    switch(a.kind){
      case 'mvp':out.push(`${last} averaged ${line(s)}${rec?` for a team that went ${rec}`:''}.`);break;
      case 'finals':out.push(s.GP===1?`In the ${story.leagueType===1||snap.leagueType===1?'title game':'Finals'}, ${last} had ${C.plural(s.PTS,'point')}, ${C.plural(s.REB,'rebound')} and ${C.plural(s.AST,'assist')}${s.FGA>0?` on ${s.FGM}-of-${s.FGA} shooting`:''}.`:
        `${last} averaged ${r('PTS')} points, ${r('REB')} rebounds and ${r('AST')} assists over ${C.plural(s.GP,'game')} in the Finals${fg}.`);break;
      case 'dpoy':out.push(`${last} averaged ${r('BLK')} blocks, ${r('STL')} steals and ${r('REB')} rebounds per game${a.allowedRank?`, anchoring a defense that ranked ${ordinal(a.allowedRank)} in points allowed`:''}.`);break;
      case 'roy':out.push(`${last} averaged ${line(s)} as a first-year player${Number.isFinite(s.GS)?`, starting ${s.GS} of ${s.GP} games`:''}.`);break;
      case 'sixth':out.push(Number.isFinite(s.GS)?`${last} came off the bench in ${s.GP-s.GS} of ${s.GP} games and still averaged ${r('PTS')} points${fg}.`:`${last} averaged ${line(s)}.`);break;
      case 'mip':out.push(a.previous?`${last} jumped from ${(a.previous.PTS/a.previous.GP).toFixed(1)} points a game last season to ${r('PTS')}, and from ${(a.previous.REB/a.previous.GP).toFixed(1)} rebounds to ${r('REB')}.`:`${last} averaged ${line(s)}.`);break;
      case 'PTS':case 'REB':case 'AST':case 'STL':case 'BLK':{
        const k=a.kind;out.push(`${last} led the league at ${r(k)} ${statWord[k]} per game over ${C.plural(s.GP,'game')}.`);
        if(k==='PTS'&&s.FGA>0)out.push(`${he} did it on ${pct(s,'FGM','FGA')} shooting from the field${s.TPA>0?` and ${pct(s,'TPM','TPA')} from 3-point range`:''}.`);
        if(k==='AST'&&Number.isFinite(s.TO))out.push(`${he} turned it over ${r('TO')} times a game.`);
        if(k==='REB'&&r('PTS'))out.push(Number(r('PTS'))>=10&&Number(r('REB'))>=10?`With ${r('PTS')} points a game as well, ${last} averaged a double-double.`:`${he} added ${r('PTS')} points a game.`);
        break;}
      default:out.push(`${last} averaged ${line(s)}.`);
    }
    if(a.alsoWon?.length)out.push(`${he} also won ${C.listJoin(a.alsoWon)} this season.`);
    return out;
  }
  function articleParagraphs(story){
    if(story.type==='Season leaders')return leadersArticle(story);
    if(story.type==='Regular-season review')return seasonReviewArticle(story);
    const award=story.seasonSnapshot?.award?awardArticle(story):null;
    // Award prose is rebuilt from its evidence; saved quotes follow it.
    const paragraphs=award?[...award,...(story.paragraphs||[]).filter(p=>/^[“"]/.test(p))]:[...(story.paragraphs||[])],missing=honorLines(story).filter(line=>!paragraphs.some(p=>p.includes(line)));
    const later=award&&story.seasonSnapshot?.featuredPlayer?.name;
    if(missing.length){const text=missing.map(l=>later?l.replace(later,C.surname(later)):l).join(' ');if(paragraphs.length)paragraphs[0]+=' '+text;else paragraphs.push(text);}
    return paragraphs;
  }
  function stats(player,league,year,period='season',teamId=null){
    const entries=(player.stats||[]).filter(s=>s.league===league.leagueType&&s.yr===year).flatMap(s=>s[period]||[]).filter(s=>teamId===null||s.tid===teamId);
    if(!entries.length||entries.some(s=>['GP','PTS','REB','AST'].some(k=>!Number.isInteger(s[k])||s[k]<0)))return null;
    const result={};for(const k of keys)if(entries.every(s=>Number.isFinite(s[k])&&s[k]>=0))result[k]=entries.reduce((n,s)=>n+s[k],0);
    // Native MIN[0] is total playing time in seconds; the other slots split positions.
    if(entries.every(s=>Array.isArray(s.MIN)&&Number.isFinite(s.MIN[0])&&s.MIN[0]>=0))result.MIN=entries.reduce((n,s)=>n+s.MIN[0]/60,0);
    return result.GP>0?result:null;
  }
  function avg(s,k){return Number.isFinite(s?.[k])&&s.GP>0?(s[k]/s.GP).toFixed(1):'—';}
  function pct(s,m,a){return Number.isFinite(s?.[m])&&s[a]>0?`${(100*s[m]/s[a]).toFixed(1)}%`:'—';}
  function line(s){return `${avg(s,'PTS')} points, ${avg(s,'REB')} rebounds and ${avg(s,'AST')} assists per game${Number.isFinite(s.MIN)?` in ${avg(s,'MIN')} minutes a night`:''}${s.FGA>0?`, shooting ${pct(s,'FGM','FGA')} from the field`:''}${s.TPA>0?` and ${pct(s,'TPM','TPA')} from three`:''}`;}
  function teamLine(name,s){return s?.GP>0&&Number.isFinite(s.PTS)&&Number.isFinite(s.OPP)?`${name} averaged ${avg(s,'PTS')} points and allowed ${avg(s,'OPP')} a night${s.FGA>0?`, shooting ${pct(s,'FGM','FGA')} from the floor`:''}${s.TPA>0?` and ${pct(s,'TPM','TPA')} from deep`:''}.`:'';}
  function playerTable(label,items){return {label,headers:['Player','GP','PPG','RPG','APG','SPG','BPG','FG%','3P%','FT%','PTS','REB','AST'],rows:items.map(({p,s})=>[C.playerDisplay(p),s.GP,...['PTS','REB','AST','STL','BLK'].map(k=>avg(s,k)),pct(s,'FGM','FGA'),pct(s,'TPM','TPA'),pct(s,'FTM','FTA'),s.PTS,s.REB,s.AST])};}
  function mvpRace(snapshot){
    const award=snapshot?.mvpAward,players=snapshot?.reviewPlayers||[],games=snapshot?.scheduledGames;
    if(!award||award.enabled===false||award.phase!==0||![0,1].includes(award.calculation)||!(games>0))return [];
    const weighted=['MIN','PM','POS','PTS','FGM','FGA','FGP','TPM','TPA','TPP','FTM','FTA','FTP','DRB','ORB','REB','AST','STL','BLK','TO','PF','DD','TD','POTG','W','L','TimeWon'].filter(k=>Number.isFinite(award[k])&&award[k]!==0);
    if(!weighted.length)return [];
    const value=(p,k)=>{
      const s=p.s;
      if(k==='TimeWon')return (p.mvpWins||[]).filter(y=>y<snapshot.year).length;
      if(['FGP','TPP','FTP'].includes(k)){const [m,a]=({FGP:['FGM','FGA'],TPP:['TPM','TPA'],FTP:['FTM','FTA']})[k];return Number.isFinite(s[m])&&Number.isFinite(s[a])?(s[a]>0?100*s[m]/s[a]:0):null;}
      if(k==='DRB')return Number.isFinite(s.REB)&&Number.isFinite(s.ORB)?s.REB-s.ORB:null;
      return Number.isFinite(s[k])?s[k]/(award.calculation===0?s.GP:1):null;
    };
    return players.filter(p=>{
      const s=p.s;if(!(s?.GP>0)||s.GP/games*100<(award.minGames||0))return false;
      const position=['pg','sg','sf','pf','c'][p.position];if(position&&award[position]===false)return false;
      if(award.yearsPro>0&&p.yearsPro!==award.yearsPro)return false;
      if((award.minStarted>0||award.maxStarted<100)&&(!Number.isFinite(s.GS)||s.GS/s.GP*100<(award.minStarted||0)||s.GS/s.GP*100>(award.maxStarted??100)))return false;
      if(award.minMinutes>0&&(!Number.isFinite(s.MIN)||!(snapshot.gameMinutes>0)||s.MIN/s.GP/snapshot.gameMinutes*100<award.minMinutes))return false;
      return weighted.every(k=>value(p,k)!==null);
    }).map(p=>({p,score:weighted.reduce((sum,k)=>sum+award[k]*value(p,k),0)})).sort((a,b)=>Number((b.p.mvpWins||[]).includes(snapshot.year))-Number((a.p.mvpWins||[]).includes(snapshot.year))||b.score-a.score||a.p.name.localeCompare(b.p.name)).slice(0,3).map(x=>x.p);
  }
  function seasonReviewLists(story){
    const teams=(story.seasonSnapshot?.teamRecords||[]).map(x=>({id:x.teamId,name:(story.relatedTeams||[]).find(t=>t.id===x.teamId)?.name,s:x.record?.seasonStats||x.record})).filter(t=>t.name&&Number.isInteger(t.s?.W)&&t.s.W>=0&&Number.isInteger(t.s?.L)&&t.s.L>=0).sort((a,b)=>b.s.W-a.s.W||a.s.L-b.s.L);
    if(!teams.length)return [];
    const players=mvpRace(story.seasonSnapshot);
    const playerLines=players.map(p=>{
      const values=['PTS','REB','AST','STL','BLK'].filter(k=>Number.isFinite(p.s[k])&&p.s[k]>=0).map(k=>`${(p.s[k]/p.s.GP).toFixed(1)} ${{PTS:'PPG',REB:'RPG',AST:'APG',STL:'SPG',BLK:'BPG'}[k]}`);
      const fg=p.shooting?.FG||pct(p.s,'FGM','FGA');if(/^\d+(?:\.\d+)?%$/.test(fg))values.push(`${fg} FG`);
      return `${p.name}: ${values.join(' · ')}`;
    });
    const playerRows=players.map(p=>{
      const fg=p.shooting?.FG||pct(p.s,'FGM','FGA');
      return [p.name,...['PTS','REB','AST','STL','BLK'].map(k=>avg(p.s,k)),/^\d+(?:\.\d+)?%$/.test(fg)?fg:'—'];
    });
    const topTeams=teams.slice(0,3);
    const teamLines=topTeams.map(t=>{
      const values=[`${t.s.W}-${t.s.L}`];
      for(const [key,label] of [['PTS','PPG'],['OPP','opp. PPG']])if(Number.isFinite(t.s[key])&&t.s[key]>=0&&t.s.GP>0)values.push(`${(t.s[key]/t.s.GP).toFixed(1)} ${label}`);
      const fg=pct(t.s,'FGM','FGA');if(/^\d+(?:\.\d+)?%$/.test(fg))values.push(`${fg} FG`);
      return `${t.name}: ${values.join(' · ')}`;
    });
    const teamRows=topTeams.map(t=>[t.name,`${t.s.W}-${t.s.L}`,avg(t.s,'PTS'),avg(t.s,'OPP'),pct(t.s,'FGM','FGA')]);
    return [
      ...(playerRows.length?[{label:'Top three players',headers:['Player','PPG','RPG','APG','SPG','BPG','FG%'],rows:playerRows,items:playerLines}]:[]),
      {label:'Top three teams',headers:['Team','Record','PPG','Opp PPG','FG%'],rows:teamRows,items:teamLines}
    ];
  }
  function repairSeasonReviews(stories,leagues=[]){
    const sources=new Map(),key=s=>`${s.fingerprint}:${s.season}`;
    const usable=s=>s?.seasonSnapshot?.mvpAward&&s.seasonSnapshot.reviewPlayers?.length&&s.seasonSnapshot.scheduledGames>0;
    for(const story of stories)if(story.type==='Regular-season review'&&usable(story))sources.set(key(story),story);
    const fresh=new Map(),updated=[];
    for(const story of stories){
      if(story.type!=='Regular-season review'||usable(story))continue;
      let source=sources.get(key(story));
      if(!source){
        const league=leagues.find(l=>C.buildFingerprint(l)===story.fingerprint&&String(C.seasonYear(l))===String(story.season));
        if(league){
          if(!fresh.has(key(story)))fresh.set(key(story),candidates(league,leagues).find(x=>x.story.eventKey==='regular-wrap')?.story);
          source=fresh.get(key(story));
        }
      }
      if(!usable(source))continue;
      const repaired=structuredClone(story),snapshot=repaired.seasonSnapshot||={};
      for(const field of ['mvpAward','reviewPlayers','scheduledGames','year','gameMinutes'])
        if(source.seasonSnapshot[field]!==undefined)snapshot[field]=structuredClone(source.seasonSnapshot[field]);
      repaired.paragraphs=seasonReviewArticle(repaired);updated.push(repaired);
    }
    return updated;
  }
  function seasonReviewArticle(story){
    const teams=(story.seasonSnapshot?.teamRecords||[]).map(x=>({name:(story.relatedTeams||[]).find(t=>t.id===x.teamId)?.name,s:x.record?.seasonStats||x.record}))
      .filter(t=>t.name&&Number.isInteger(t.s?.W)&&t.s.W>=0&&Number.isInteger(t.s?.L)&&t.s.L>=0)
      .sort((a,b)=>b.s.W-a.s.W||a.s.L-b.s.L);
    if(!teams.length)return story.paragraphs||[];
    const R=t=>C.teamRef({name:t.name}),cap=C.capitalize,year=story.season!=null?`${story.season} `:'';
    const margin=t=>t.s.GP>0&&Number.isFinite(t.s.PTS)&&t.s.PTS>=0&&Number.isFinite(t.s.OPP)&&t.s.OPP>=0?(t.s.PTS-t.s.OPP)/t.s.GP:null;
    const paragraphs=[],first=teams[0],s=first.s,winPct=s.W/Math.max(1,s.W+s.L),players=mvpRace(story.seasonSnapshot);
    const leaders=teams.filter(x=>x.s.W===s.W&&x.s.L===s.L);
    let lead;
    if(leaders.length>1)lead=`${cap(C.listJoin(leaders.map(t=>R(t).full)))} finished level at ${s.W}-${s.L}, so nobody owned the ${year}regular season outright.`;
    else{
      const next=teams[1],gap=next?C.gamesBetter([s.W,s.L],[next.s.W,next.s.L]):'';
      lead=`${cap(R(first).full)} ${winPct>=.75?'owned':winPct>=.6?'set the pace in':'finished on top of'} the ${year}regular season, posting the league's best record at ${s.W}-${s.L}${gap?`, ${gap} clear of the next-best team`:''}.`;
    }
    const m=margin(first);
    if(m!==null)lead+=` ${m>0?`${leaders.length>1?cap(R(first).nick):'They'} outscored opponents by ${m.toFixed(1)} points a night, scoring ${avg(s,'PTS')} and allowing ${avg(s,'OPP')}.`:`Oddly, ${leaders.length>1?R(first).nick:'they'} did it while being outscored by ${Math.abs(m).toFixed(1)} points a night.`}`;
    if(leaders.length===1&&winPct>=.75&&m!==null&&m>0)lead+=' That is a team that spent the season controlling games, not surviving them.';
    paragraphs.push(lead);
    const chasers=teams.slice(1,3).filter(t=>!leaders.includes(t));
    if(chasers.length){
      const gap=t=>C.gamesBetter([s.W,s.L],[t.s.W,t.s.L]);
      const same=chasers.length===2&&chasers[0].s.W===chasers[1].s.W&&chasers[0].s.L===chasers[1].s.L;
      let text=same?`${cap(R(chasers[0]).full)} and ${R(chasers[1]).nick} both finished ${chasers[0].s.W}-${chasers[0].s.L}${gap(chasers[0])?`, ${gap(chasers[0])} back`:''}.`:
        `${cap(C.listJoin(chasers.map(t=>`${R(t).full} (${t.s.W}-${t.s.L})`)))} ${chasers.length>1?'were the closest pursuers':`${C.verb(R(chasers[0]),'were')} the closest pursuer`}${chasers.length===1&&gap(chasers[0])?`, ${gap(chasers[0])} back`:''}.`;
      const rated=chasers.filter(t=>margin(t)!==null);
      if(rated.length===2){
        const [x,y]=rated,offense=Number(avg(x.s,'PTS'))>=Number(avg(y.s,'PTS'))?x:y,defense=Number(avg(x.s,'OPP'))<=Number(avg(y.s,'OPP'))?x:y;
        text+=offense!==defense?` ${cap(R(offense).nick)} had the better offense at ${avg(offense.s,'PTS')} points a night; ${R(defense).nick} were stingier, allowing ${avg(defense.s,'OPP')}.`:
          ` ${cap(R(offense).nick)} had the edge at both ends, scoring ${avg(offense.s,'PTS')} and allowing ${avg(offense.s,'OPP')}.`;
      }else if(rated.length===1){const t=rated[0],mm=margin(t);text+=` ${cap(R(t).nick)} ${mm>=0?`outscored opponents by ${mm.toFixed(1)}`:`were outscored by ${Math.abs(mm).toFixed(1)}`} points a night.`;}
      paragraphs.push(text);
    }
    const awardName=story.seasonSnapshot?.mvpAward?.name||(story.seasonSnapshot?.leagueType===1?'Player of the Year':'Most Valuable Player');
    for(const [i,p] of players.entries()){
      if(i>0)break;
      const s=p.s,last=C.surname(p.name),secondary=['AST','REB'].filter(k=>Number.isFinite(s[k])&&s[k]>0).sort((a,b)=>s[b]-s[a])[0];
      const won=(p.mvpWins||[]).includes(story.seasonSnapshot?.year);
      const statLine=`${avg(s,'PTS')} points${secondary?` and ${avg(s,secondary)} ${secondary==='AST'?'assists':'rebounds'}`:''}`;
      let text=won?`${p.name} won the ${awardName}, and the case was not complicated: ${statLine} per game.`:
        `The ${awardName} race runs through ${p.name}, who averaged ${statLine} per game and has the clearest case.`;
      if(s.FGA>0&&s.FGM>=0&&s.FGM<=s.FGA){
        const fg=s.FGM/s.FGA;
        text+=fg>=.5?` ${last} did it on ${pct(s,'FGM','FGA')} shooting, the kind of efficiency that turns good production into a real case.`:
          fg<.4?` The knock is efficiency: ${pct(s,'FGM','FGA')} from the field.`:` ${last} shot ${pct(s,'FGM','FGA')} from the field.`;
      }
      if(secondary==='AST'&&Number.isFinite(s.TO)&&s.TO>=0)
        text+=s.AST>s.TO*2?` ${last} also took care of the ball, with just ${avg(s,'TO')} turnovers a game.`:s.TO>s.AST?` The ${avg(s,'TO')} turnovers a game are the clear concern.`:'';
      const previous=p.previousStats;
      if(previous?.GP>=5&&Number.isFinite(previous.PTS)&&s.GP>=5&&Math.abs(s.PTS/s.GP-previous.PTS/previous.GP)>=2){
        const up=s.PTS/s.GP>previous.PTS/previous.GP;
        text+=` ${up?'That is up from':'That is down from'} ${avg(previous,'PTS')} points a game last year, a ${up?'clear step forward':'noticeable step back'}.`;
      }
      paragraphs.push(text);
    }
    const others=players.slice(1);
    if(others.length){
      const blurb=p=>{
        const s=p.s,secondary=['REB','AST'].filter(k=>Number.isFinite(s[k])&&s[k]>0).sort((a,b)=>s[b]-s[a])[0];
        const fg=s.FGA>0&&s.FGM>=0&&s.FGM<=s.FGA&&s.FGM/s.FGA>=.55?`, ${pct(s,'FGM','FGA')} shooting`:'';
        return `${p.name} (${avg(s,'PTS')} points${secondary?`, ${avg(s,secondary)} ${secondary==='AST'?'assists':'rebounds'}`:''}${fg})`;
      };
      paragraphs.push(`${C.listJoin(others.map(blurb))} ${others.length>1?'round out':'rounds out'} the ${awardName} conversation.`);
    }
    return paragraphs;
  }
  function playerBackground(player,league,leagues=[league]){
    const bio={};
    if(Number.isInteger(player.age)&&player.age>=15&&player.age<=80)bio.age=player.age;
    if(league.leagueType===0&&Number.isInteger(player.yrs)&&player.yrs>0)bio.yearsPro=player.yrs;
    if(league.leagueType===0){
      const id=player.history?.coll>0?player.history.coll:player.history?.collegeStats?.season?.GP>0?player.history.collegeStats.season.tid:null;
      const college=leagues.filter(l=>l.leagueType===1).flatMap(l=>l.teams||[]).find(t=>t.id===id);
      const name=college?.city?.trim()||college?.name?.trim();if(name)bio.college=name;
    }
    return bio;
  }
  function leadersArticle(story){
    const rows=(story.seasonSnapshot?.rows||[]).filter(r=>typeof r[1]==='string'&&Number.isFinite(r[2])&&r[2]>=0&&Number.isFinite(r[3])&&r[3]>0);
    const groups={};
    for(const key of ['PTS','REB','AST','STL','BLK']){
      const category=rows.filter(r=>r[0]===key);if(!category.length)continue;
      const max=Math.max(...category.map(r=>r[2]/r[3])),leaders=category.filter(r=>r[2]/r[3]===max),names=leaders.map(r=>r[1]);
      groups[key]={names,name:C.listJoin(names),last:C.surname(names[0]),rate:max.toFixed(1),tied:names.length>1};
    }
    if(!Object.keys(groups).length)return story.paragraphs||[];
    const g=groups,paragraphs=[],profiles=story.seasonSnapshot?.leaderProfiles||[];
    const history=(...categories)=>[...new Set((story.seasonSnapshot?.leaderHonors||[]).filter(h=>categories.includes(h.category)).map(honorLine).filter(Boolean))];
    const profile=name=>profiles.find(p=>p.name===name);
    const positionName=value=>{
      if(Number.isInteger(value))return ['point guard','shooting guard','small forward','power forward','center'][value]||'';
      const key=String(value||'').trim().toLowerCase().replace(/[ ._-]+/g,'');
      return ({pg:'point guard',pointguard:'point guard',sg:'shooting guard',shootingguard:'shooting guard',sf:'small forward',smallforward:'small forward',pf:'power forward',powerforward:'power forward',c:'center',center:'center'})[key]||'';
    };
    // AP style: "Derrick Fox, a 23-year-old center," or "Polan Stronk, a seventh-year pro,".
    const subject=(group,preferAge=false)=>{
      if(group.tied)return group.name;
      const person=profile(group.names[0]),bio=person?.bio;if(!bio)return group.name;
      const n=bio.yearsPro,leadWithAge=!!bio.age&&(preferAge||!(n>0));
      if(leadWithAge){
        const position=positionName(person.position);
        return position?`${group.name}, ${article(String(bio.age))} ${bio.age}-year-old ${position},`:`${group.name}, ${bio.age},`;
      }
      if(n>0){const detail=`${ordinal(n)}-year pro${bio.college?` out of ${bio.college}`:''}`;return `${group.name}, ${article(detail)} ${detail},`;}
      return bio.college?`${group.name}, a product of ${bio.college},`:group.name;
    };
    const sameLeaders=(a,b)=>a&&b&&a.names.length===b.names.length&&a.names.every(n=>b.names.includes(n));
    const double=sameLeaders(g.REB,g.BLK),season=story.season!=null?`the ${story.season}`:'this season\'s';
    if(g.PTS){
      let text=`${subject(g.PTS)} ${g.PTS.tied?'shared':'won'} ${season} scoring title at ${g.PTS.rate} points per game.`;
      const scorer=!g.PTS.tied?profile(g.PTS.names[0]):null,fg=pct(scorer?.s,'FGM','FGA');
      if(/^\d+(?:\.\d+)?%$/.test(fg)){
        const rate=scorer.s.FGM/scorer.s.FGA;
        text+=rate>=.5?` ${g.PTS.last} did it efficiently, too, on ${fg} shooting from the field. That is not volume for its own sake.`:
          rate<.4?` The volume came at a price: ${fg} shooting from the field.`:` ${g.PTS.last} shot ${fg} from the field.`;
      }
      text+=' '+history('PTS').join(' ');paragraphs.push(text.trim());
    }
    const interior=[];
    if(double){
      interior.push(`${subject(g.REB,true)} ${g.REB.tied?'shared':'swept'} the rebounding and shot-blocking titles, averaging ${g.REB.rate} rebounds and ${g.BLK.rate} blocks a night.`);
      interior.push('Owning both categories is the kind of two-way season that changes how a player is remembered.');
      const p=!g.REB.tied?profile(g.REB.names[0]):null;if(p?.s?.GP>0&&p.s.PTS/p.s.GP>=10&&Number(g.REB.rate)>=10)interior.push(`With ${(p.s.PTS/p.s.GP).toFixed(1)} points a game as well, ${g.REB.last} averaged a double-double for the season.`);
    }else{
      if(g.REB)interior.push(`${subject(g.REB,true)} ${g.REB.tied?'shared the rebounding title':'claimed the rebounding title'} at ${g.REB.rate} rebounds per game.`);
      if(g.BLK)interior.push(`${g.REB?'Inside, ':''}${subject(g.BLK)} ${g.BLK.tied?'shared the league lead in':'led the league in'} shot blocking with ${g.BLK.rate} blocks a night.`.replace(/^Inside, (.)/,(m,c)=>`Inside, ${c}`));
    }
    interior.push(...history('REB','BLK'));if(interior.length)paragraphs.push(interior.join(' '));
    const perimeter=[];
    if(g.AST){
      perimeter.push(`${subject(g.AST)} ${g.AST.tied?'shared the lead':'led the league in assists'} with ${g.AST.rate} assists per game.`);
      const passer=!g.AST.tied?profile(g.AST.names[0]):null,s=passer?.s;
      if(s?.GP>0&&Number.isFinite(s.TO)&&s.TO>=0){
        perimeter.push(s.AST>s.TO*2?`${g.AST.last} did it while committing just ${avg(s,'TO')} turnovers a game, a clean ratio for a lead playmaker.`:
          s.TO>s.AST?`The ${avg(s,'TO')} turnovers a game are the one blemish on the passing title.`:`${g.AST.last} also turned it over ${avg(s,'TO')} times a game, a manageable cost for that much playmaking.`);
      }
    }
    if(g.STL)perimeter.push(`${subject(g.STL,true)} ${g.STL.tied?'shared the steals title':'led the league in steals'} at ${g.STL.rate} steals per game.`);
    perimeter.push(...history('AST','STL'));if(perimeter.length)paragraphs.push(perimeter.join(' '));
    return paragraphs;
  }

  function factsForStory(story){
    const snapshot=story.seasonSnapshot;
    if(story.type==='Team season review'){
      const table=snapshot?.tables?.find(t=>t.label==='Regular-season player statistics');
      if(table){const headers=['Player','GP','PPG','RPG','APG','SPG','BPG'];const indexes=headers.map(h=>table.headers.indexOf(h));return {headers,rows:table.rows.slice(0,5).map(r=>indexes.map(i=>i>=0?r[i]:'—'))};}
      // Older archives may retain only the counting-stat rows.
      if(snapshot?.headers?.includes('GP')){const old=snapshot.headers,index=old.indexOf('GP'),categories=['PTS','REB','AST','STL','BLK'].filter(k=>old.includes(k));return {headers:['Player','GP',...categories.map(k=>({PTS:'PPG',REB:'RPG',AST:'APG',STL:'SPG',BLK:'BPG'})[k])],rows:(snapshot.rows||[]).slice(0,5).map(r=>[r[0],r[index],...categories.map(k=>r[index]>0&&typeof r[old.indexOf(k)]==='number'?(r[old.indexOf(k)]/r[index]).toFixed(1):'—')])};}
    }
    if(story.type==='Season leaders')return {headers:['Category','Player','Per game'],rows:(snapshot?.rows||[]).slice(0,5).map(r=>[({PTS:'Points',REB:'Rebounds',AST:'Assists',STL:'Steals',BLK:'Blocks'})[r[0]]||r[0],r[1],r[3]>0?(r[2]/r[3]).toFixed(1):'—'])};
    if(story.eventKey?.startsWith('award-')&&snapshot?.featuredPlayer){
      const person=snapshot.featuredPlayer;
      const postseason=story.statsPeriod==='finals'||story.statsPeriod==='playoffs'||snapshot.tables?.some(t=>t.label==='Playoff player statistics');
      const stats=featuredStatsForStory(story);
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
      champion:["This group earned a championship. I couldn't be prouder of what these guys accomplished.","Winning a title takes everybody. This team gave us everything we asked for, and then some."],
      runnerup:["Getting this close and falling short hurts. We wanted to finish the job, and we didn't.","I'm proud of the run we made. But losing on the last stage is a bitter way to end it."],
      eliminated:["Getting knocked out is disappointing. We expected this run to go further.","There's good work to recognize from this season. This just isn't the ending we wanted, and it's disappointing."],
      missed:["Our standard has to be higher. Too many nights we made the game harder on ourselves, and that's on all of us.","The record says we didn't do enough. We need a clearer identity and more consistency from day one."],
      injury:["It's disappointing to lose him. We want him healthy first, and the rest of the group has to step up.","You hate to see a player go down. We'll support him and give him the time he needs."],
      dominant:[`This group earned every one of those ${wins} wins. I'm proud of what we built together.`,`That's an outstanding regular season. Our players deserve a lot of credit for ${wins} wins.`,'We had a tremendous season. I\'m proud of this team and the way we earned it.'],
      winning:["This was a successful season, and our players deserve the credit. I'm proud of this group.","We earned those wins together. There's a lot to be proud of here."],
      balanced:["We had some good stretches. Consistency is where we have to take the next step.","We showed what we can do. Now we need to bring that level more often."],
      losing:["We didn't win enough games. We have to be more consistent at both ends of the floor.","There are things we can build on, but the results have to get better."],
      struggling:["The results weren't good enough, and I take responsibility for that. We have to get better.","It was a tough season. We owe it to this group to turn the work into wins."]};
    const playerQuotes={
      champion:["We're champions, man. Everybody in that locker room had a part in this.","We'll remember this one forever. Winning a championship with this group means everything."],
      runnerup:["Coming this close and losing hurts. We wanted that championship.","We gave ourselves a chance to win it all. Falling short is hard to take right now."],
      eliminated:["Getting knocked out hurts. We wanted to keep playing.","This is a disappointing way for our run to end. We wanted more."],
      missed:["Watching the playoffs from home is going to stay with me. I'm going to use that all summer and come back sharper.","I keep thinking about the games we let get away. I have to come back better and make sure next season feels different."],
      injury:["It's frustrating to be sidelined. I want to be out there with my teammates.","This is disappointing. My focus now is getting healthy and getting back on the floor."],
      dominant:[`Winning ${wins} games is something we're proud of. We earned that together.`,"We had a great season. I'm proud of this group and what we accomplished."],
      winning:["We put together a good year. I want us to keep building on it.","There's a lot to be proud of. We earned those wins as a group."],
      balanced:["We had good nights and tough nights. We have to find more consistency.","We know we can play better. The next step is doing it more often."],
      losing:["We wanted more wins than this. We have to turn those lessons into better basketball.","The record isn't where we wanted it. We have to keep working and get better."],
      struggling:["It was a tough year. None of us are satisfied with that record.","We have to be honest about how this season went and come back better."]};
    const lines=[];
    if(coach)lines.push(C.quoteParagraph(C.choose(id,coachQuotes[tone],'season-coach'),`head coach ${C.playerDisplay(coach)}`));
    if(player)lines.push(C.quoteParagraph(C.choose(id,playerQuotes[tone],'season-player'),C.playerDisplay(player)));
    return lines;
  }
  function awardQuoteLines(id,player,coach,kind){
    if(!player)return [];
    const name=C.playerDisplay(player),lines=[];
    const last=player.fn||C.surname(name);
    const kindQuotes={
      mvp:[`${last} carried us all year. Nobody deserves this award more.`,`When the game got tight, everybody knew where the ball was going. ${last} earned this honor.`],
      finals:[`${last} was the best player on the floor in the biggest games of the year. That's what this award is.`],
      roy:[`You don't see rookies handle the pressure like ${last} did. This award is just the start.`],
      sixth:[`${last} could start for a lot of teams. This award is recognition for taking a role and owning it.`],
      mip:[`${last} came back a different player. That doesn't happen by accident. This honor is a summer of work.`],
      dpoy:[`${last} sets the tone for our defense every night. It's great to see that recognized.`]
    }[kind];
    const coachQuotes=kindQuotes||[
      `Nobody worked harder than ${last} this year. This award is well deserved.`,
      `What ${last} brought every single day changed our team. This honor reflects all that work.`,
      `${last} kept raising the bar. It's great to see that recognized with this award.`
    ];
    const playerQuotes=({
      mvp:["This one is for my teammates. I just tried to be the best version of myself every night.","I don't take it lightly. There are a lot of great players in this league, and to be called the best of them means everything."],
      finals:["I didn't care who got the MVP. We're champions. That's all that matters.","Honestly, I'd give this trophy to any of my teammates. We did this together."],
      dpoy:["Defense is pride. I take it personally when somebody scores on me.","People notice the buckets. It means a lot that somebody noticed the other end."],
      roy:["Coming in, I just wanted to earn my minutes. To win this as a rookie, I'm grateful.","The vets on this team made it easy for me. I learned something every day."],
      sixth:["Whatever this team needs, I'm going to do it. Coming off the bench never bothered me.","Starting doesn't matter to me. Finishing does."],
      mip:["I put a lot of work in last summer. It's nice to see it pay off.","Nobody outside this building expected this. I did."],
      PTS:["It's a nice honor, but I'd trade it for more wins.","I'm just taking the shots that come to me. My teammates found me all year."],
      REB:["Rebounding is about wanting it. I wanted every one of them.","Every board is an extra possession. That's how I see it."],
      AST:["I love making my teammates better. The assists mean they're making shots.","The best feeling in basketball is the pass that leads to a bucket."],
      STL:["I study tendencies. When you know where the ball's going, you get there first.","Defense wins. Steals are just the fun part."],
      BLK:["Protecting the rim is my job. I take it seriously.","Every block is a message. Don't come in here."]
    })[kind]||[
      "It means a lot to be recognized. A lot of people helped me get here, and I'm grateful for every one of them.",
      "I'm proud of the work that went into this. The award means a lot, but I'm not done.",
      "You never do this alone. I appreciate everybody who pushed me and trusted me all season."
    ];
    if(coach)lines.push(C.quoteParagraph(C.choose(id,coachQuotes,'award-coach'),`head coach ${C.playerDisplay(coach)}`));
    lines.push(C.quoteParagraph(C.choose(id,playerQuotes,'award-player'),C.surname(name)));
    return lines;
  }
  // Series scores come from the playoff games in the schedule; a finished
  // series falls back to the bracket's game count.
  function seriesScore(series,roundIndex,lookup){
    const games=lookup.completed.filter(x=>x.game.tRound===roundIndex+1&&[x.game.homeTeam,x.game.awayTeam].every(t=>[series.topSeed,series.lowerSeed].includes(t)));
    let top=games.filter(x=>x.game.winner===series.topSeed).length,lower=games.length-top;
    if(series.winner&&Math.max(top,lower)!==series.firstTo&&series.currentGame>=series.firstTo){
      const other=series.currentGame-series.firstTo;[top,lower]=series.winner===series.topSeed?[series.firstTo,other]:[other,series.firstTo];
    }
    return {top,lower,games:top+lower};
  }
  function roundLabel(bracket,index,college){
    const teams=(bracket?.rounds?.[index]?.series||[]).length*2;
    if(teams===2)return college?'title game':'Finals';
    if(index===0)return 'first round';
    if(college)return ({4:'Final Four',8:'Elite Eight',16:'Sweet 16'})[teams]||`round ${index+1}`;
    return teams===4?'semifinals':index===1?'second round':'quarterfinals';
  }
  function playoffRun(teamId,bracket,lookup,college){
    return (bracket?.rounds||[]).flatMap((round,index)=>(round.series||[]).filter(x=>[x.topSeed,x.lowerSeed].includes(teamId)&&lookup.teams.has(x.topSeed)&&lookup.teams.has(x.lowerSeed)).map(x=>{
      const score=seriesScore(x,index,lookup),mine=x.topSeed===teamId?score.top:score.lower,theirs=score.games-mine;
      return {index,label:roundLabel(bracket,index,college),opponent:lookup.teams.get(x.topSeed===teamId?x.lowerSeed:x.topSeed),firstTo:x.firstTo,wins:mine,losses:theirs,games:score.games,
        done:!!x.winner,won:x.winner===teamId};
    }));
  }
  function runClause(r){
    const opp=C.teamRef(r.opponent).nick,where=r.label==='Finals'?'in the Finals':r.label==='title game'?'in the title game':`in the ${r.label}`;
    if(r.firstTo===1)return `beat ${opp} ${where}`;
    if(r.losses===0)return `swept ${opp} ${where}`;
    if(r.games===r.firstTo*2-1)return `outlasted ${opp} in ${C.num(r.games)} games ${where}`;
    return `beat ${opp} in ${C.num(r.games)} games ${where}`;
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
    const round=index+1,league_=league.shortName||league.leagueName,R=name=>C.teamRef({name});
    const formats=[...new Set(series.map(s=>s.format))];
    const formatWords=f=>f==='single-elimination'?'single-elimination games':`${f.replace(/\d+/,n=>C.num(Number(n)))} series`;
    const opener=round===1?`The ${league_} playoffs open with ${C.plural(series.length,'matchup')}`:`Round ${round} of the ${league_} playoffs is set: ${C.plural(series.length,'matchup')}`;
    const formatText=formats.length===1?`, all ${formatWords(formats[0])}`:'';
    const participants=new Map();
    for(const s of series)for(const [team,record,name] of [[s.a,s.ar,s.aName],[s.b,s.br,s.bName]])participants.set(team.team.id,{name,record});
    const strongest=[...participants.values()].sort((x,y)=>(y.record.W??-1)-(x.record.W??-1)||(x.record.L??Infinity)-(y.record.L??Infinity));
    const top=strongest[0],rest=strongest.slice(1,3);
    let lead=`${opener}${formatText}.`;
    if(top)lead+=` ${C.capitalize(R(top.name).full)} (${top.record.W}-${top.record.L}) ${C.verb(R(top.name),round===1?'enter':'remain')} as the team to beat${rest.length?`, with ${C.listJoin(rest.map(x=>`${R(x.name).nick} (${x.record.W}-${x.record.L})`))} next in line`:''}. From here, records only buy you seeding.`;
    const paragraphs=[lead];
    const closest=[...series].sort((x,y)=>x.gap-y.gap||((y.ar.W??0)+(y.br.W??0))-((x.ar.W??0)+(x.br.W??0)))[0];
    if(Number.isFinite(closest?.gap)){
      let detail=`The tightest pairing on paper is ${R(closest.aName).full} (${closest.ar.W}-${closest.ar.L}) against ${R(closest.bName).full} (${closest.br.W}-${closest.br.L}), ${closest.gap===0?'with identical win totals':`separated by ${C.plural(closest.gap,'win')}`} in the regular season.`;
      if(Number.isFinite(closest.ar.PTS)&&Number.isFinite(closest.br.OPP))detail+=` ${C.capitalize(R(closest.aName).nick)} averaged ${avg(closest.ar,'PTS')} points a night; ${R(closest.bName).nick} allowed ${avg(closest.br,'OPP')}.`;
      paragraphs.push(detail);
    }
    const scoring=[];
    for(const s of series){
      if(Number.isFinite(s.ar.PTS)&&s.ar.GP>0&&Number.isFinite(s.br.OPP))scoring.push({off:s.aName,def:s.bName,ppg:Number(avg(s.ar,'PTS')),opp:Number(avg(s.br,'OPP'))});
      if(Number.isFinite(s.br.PTS)&&s.br.GP>0&&Number.isFinite(s.ar.OPP))scoring.push({off:s.bName,def:s.aName,ppg:Number(avg(s.br,'PTS')),opp:Number(avg(s.ar,'OPP'))});
    }
    scoring.sort((a,b)=>b.ppg-a.ppg);
    const spotlight=scoring[0];
    if(spotlight)paragraphs.push(`The round's highest-scoring offense belongs to ${R(spotlight.off).nick}, at ${spotlight.ppg.toFixed(1)} points per game. ${C.capitalize(R(spotlight.def).nick)}, who allowed ${spotlight.opp.toFixed(1)} a night, ${C.verb(R(spotlight.def),'get')} the first crack at slowing it down.`);
    return paragraphs.slice(0,3);
  }
  function candidates(league,leagues=[league]){
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
    function add(eventKey,type,headline,paragraphs,related,headers,rows,featured=null,importance=110,extra=null){
      const team=related[0]||teams[0],opponent=related[1]||teams.find(t=>t.id!==team.id);
      const s={id:`${fp}:${year}:season:${eventKey}`,eventKey,kind:'season',fingerprint:fp,season:year,day,
        type,headline,paragraphs:paragraphs.filter(Boolean),importance,leagueName:league.leagueName,quotesEnabled:true,templateVersion:7,editorialVersion:eventKey==='regular-wrap'?11:eventKey==='leaders'?11:eventKey.startsWith('award-')||eventKey==='championship'?5:/^team-.*-regular$/.test(eventKey)?6:4,
        relatedTeams:related.map(teamData),seasonSnapshot:{headers,rows,leagueType:league.leagueType,year,
          teamRecords:related.map(t=>({teamId:t.id,record:structuredClone(records.find(r=>r.team.id===t.id)?.year||null),...(eventKey==='regular-wrap'?{previousStats:structuredClone(t.season?.find(r=>r.yr===year-1)?.seasonStats||null)}:{})})),
          featuredPlayer:featured?{id:featured.id,name:C.playerDisplay(featured),regularStats:stats(featured,league,year),playoffStats:stats(featured,league,year,'playoffs'),finalsStats:stats(featured,league,year,'finals'),awards:structuredClone(featured.awards||[])}:null,
          bracket:structuredClone(bracket||null)},createdAt:new Date().toISOString()};
      const teamScope=eventKey.startsWith('team-')||eventKey==='championship';
      const awardStory=eventKey.startsWith('award-');
      if(awardStory&&featured){
        const awardId=Number(eventKey.split('-')[1]),award=league.awards.find(a=>a.id===awardId);
        s.seasonSnapshot.honorHistory=honorHistory(C.playerDisplay(featured),`the ${award.name}${/award$/i.test(award.name)?'':' award'}`,(featured.awards||[]).filter(a=>a.id===awardId),league.leagueType,year);
      }else if(eventKey==='championship')s.seasonSnapshot.honorHistory=honorHistory(C.teamDisplay(team),'the championship',team.championships?[team.championships]:[],league.leagueType,year,true);
      const seasonPlayers=[...players.values()].map(p=>({p,s:stats(p,league,year,'season',teamScope?team.id:null)})).filter(x=>x.s&&(!featured||(awardStory?x.p.id===featured.id:related.length!==1||x.p.id===featured.id||eventKey.startsWith('team-')))).sort((a,b)=>b.s.PTS/b.s.GP-a.s.PTS/a.s.GP);
      const individualTable=related.length===1||eventKey==='championship'||awardStory;
      s.seasonSnapshot.tables=[{label:'Regular-season team statistics',headers:['Team','W','L','PPG','Opp PPG','RPG','APG','FG%','3P%','FT%'],rows:related.map(t=>{const r=records.find(x=>x.team.id===t.id)?.year?.seasonStats;return r?.GP>0?[C.teamDisplay(t),r.W,r.L,...['PTS','OPP','REB','AST'].map(k=>avg(r,k)),pct(r,'FGM','FGA'),pct(r,'TPM','TPA'),pct(r,'FTM','FTA')]:null;}).filter(Boolean)},playerTable(individualTable?'Regular-season player statistics':'Regular-season scoring leaders',individualTable?seasonPlayers:seasonPlayers.slice(0,15))];
      if(eventKey==='regular-wrap'){s.seasonSnapshot.mvpAward=structuredClone((league.awards||[]).find(a=>a.id===2&&a.phase===0)||null);s.seasonSnapshot.scheduledGames=expected;s.seasonSnapshot.reviewPlayers=seasonPlayers.map(({p,s})=>({id:p.id,name:C.playerDisplay(p),position:p.pos,yearsPro:p.yrs,mvpWins:[...new Set((p.awards||[]).filter(a=>a.id===2&&a.league===league.leagueType).flatMap(a=>a.yearsWon||[]))],s:{...s,...Object.fromEntries(['GS','PM','POS','ORB','PF','DD','TD','POTG','W','L'].flatMap(k=>{const entries=(p.stats||[]).filter(x=>x.league===league.leagueType&&x.yr===year).flatMap(x=>x.season||[]);return entries.length&&entries.every(x=>Number.isFinite(x[k]))?[[k,entries.reduce((sum,x)=>sum+x[k],0)]]:[];}))},previousStats:stats(p,league,year-1),teamStats:Object.fromEntries(related.map(t=>[t.id,stats(p,league,year,'season',t.id)]).filter(([,s])=>s)),honors:(league.awards||[]).filter(a=>a.enabled&&a.phase===0&&(p.awards||[]).some(h=>h.id===a.id&&h.league===league.leagueType&&h.yearsWon?.includes(year))).map(a=>honorHistory(C.playerDisplay(p),`the ${a.name}${/award$|title$/i.test(a.name)?'':' award'}`,(p.awards||[]).filter(h=>h.id===a.id),league.leagueType,year))}));}
      if(extra)Object.assign(s.seasonSnapshot,structuredClone(extra));
      s.paragraphs=articleParagraphs(s);
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
      if(eventKey.startsWith('award-')&&featured)s.paragraphs.push(...awardQuoteLines(s.id,featured,coach,s.seasonSnapshot.award?.kind));
      else if(related.length===1||eventKey==='championship')s.paragraphs.push(...quoteLines(s.id,record,winner?.id===team.id,coach,featured&&featured.tid===team.id&&stats(featured,league,year)?.GP>0?featured:null,postseason));
      const ctx={winner:team,loser:opponent,home:team,game:{homeTeam:team.id},scenePlayer:featured||team.roster?.[0],potg:featured,
        potgStatsTrusted:!!featured,gameBall:league.gameballs?.[Number(league.settings?.gameBall)||0]||{pri:'E37033',sec:'E37033',ter:'E37033',outline:'44220F'}};
      results.push({story:s,context:ctx});
    }
    if(complete){
      const sorted=[...records].sort((a,b)=>b.year.seasonStats.W-a.year.seasonStats.W||a.team.id-b.team.id);
      add('regular-wrap','Regular-season review',`${league.shortName||league.leagueName}: ${year} regular season in review`,
        [`${C.capitalize(C.listJoin(sorted.filter(r=>r.year.seasonStats.W===sorted[0].year.seasonStats.W).map(r=>C.teamRef(r.team).full)))} set the pace in ${year}, closing the regular season with ${sorted[0].year.seasonStats.W} wins.`,
          ...sorted.slice(0,3).map(r=>`${C.teamDisplay(r.team)} went ${r.year.seasonStats.W}-${r.year.seasonStats.L}. ${teamLine(C.teamDisplay(r.team),r.year.seasonStats)}`)],teams,
        ['Team','W','L','Seed'],sorted.map(r=>[C.teamDisplay(r.team),r.year.seasonStats.W,r.year.seasonStats.L,r.year.seed||'—']));
      const totals=[...players.values()].map(p=>({p,s:stats(p,league,year)})).filter(x=>x.s);
      const leaderRows=[];
      for(const k of ['PTS','REB','AST','STL','BLK']){
        const eligible=totals.filter(x=>Number.isFinite(x.s[k]));if(!eligible.length)continue;
        const max=Math.max(...eligible.map(x=>x.s[k]/x.s.GP));for(const x of eligible.filter(x=>x.s[k]/x.s.GP===max))leaderRows.push([k,C.playerDisplay(x.p),x.s[k],x.s.GP]);
      }
      if(leaderRows.length)add('leaders','Season leaders',`${year} ${league.shortName||'league'} statistical leaders`,
        leadersArticle({season:year,leagueName:league.shortName||league.leagueName,seasonSnapshot:{rows:leaderRows}}),teams,['Category','Player','Total','GP'],leaderRows);
      for(const r of records){
        const leaders=[...players.values()].map(p=>({p,s:stats(p,league,year,'season',r.team.id)})).filter(x=>x.s).sort((a,b)=>b.s.PTS/b.s.GP-a.s.PTS/a.s.GP);
        const p=leaders[0],record=r.year.seasonStats;
        const scoringRank=1+records.filter(x=>x.year.seasonStats.PTS/x.year.seasonStats.GP>record.PTS/record.GP).length;
        const defendingRank=1+records.filter(x=>x.year.seasonStats.OPP/x.year.seasonStats.GP<record.OPP/record.GP).length;
        const margin=Number.isFinite(record.PTS)&&Number.isFinite(record.OPP)?(record.PTS-record.OPP)/record.GP:null;
        const T=C.teamRef(r.team),cap=C.capitalize,teamCount=records.length,winPct=record.W/Math.max(1,record.W+record.L);
        const rankText=(n,what)=>n===1?`the league's ${what==='scoring'?'top offense':'stingiest defense'}`:`${ordinal(n)} in ${what==='scoring'?'scoring':'points allowed'}`;
        const identity=margin===null?null:defendingRank<=3&&scoringRank<=3?'both':defendingRank<=3&&defendingRank<scoringRank?'defense':scoringRank<=3&&scoringRank<defendingRank?'offense':null;
        const playoff=entrants.has(r.team.id);
        const mark=`${record.W}-${record.L}`,a=article(mark);
        const run=playoffRun(r.team.id,bracket,lookup,league.leagueType===1),exit=run.find(x=>x.done&&!x.won),title=winner?.id===r.team.id,alive=run.length&&!exit&&!title;
        const prior=(r.team.season||[]).find(x=>x.yr===year-1)?.seasonStats,change=prior&&Number.isInteger(prior.W)&&prior.W+prior.L>0?record.W-prior.W:null;
        // The record is in every headline, so the rest of it has to say what
        // the record can't: how it ended, how it moved, or where it ranked.
        // College leagues keep a real poll in the save (1 is the top team).
        // Pro leagues don't keep a final one, so HoopWire ranks them the way
        // power rankings do: point differential first, then winning percentage.
        const netOf=x=>{const t=x.year.seasonStats;return t.GP>0&&Number.isFinite(t.PTS)&&Number.isFinite(t.OPP)?(t.PTS-t.OPP)/t.GP:-Infinity;},pctOf=x=>{const t=x.year.seasonStats;return t.W/Math.max(1,t.W+t.L);};
        const powerRank=1+records.filter(x=>netOf(x)>netOf(r)||(netOf(x)===netOf(r)&&pctOf(x)>winPct)).length;
        const poll=league.leagueType===1&&Number.isInteger(r.year.poll)&&r.year.poll>0?r.year.poll:null;
        const ranking=league.leagueType===1?(poll&&poll<=25?`No. ${poll} in the poll`:poll?'unranked':null):`No. ${powerRank} in the power rankings`;
        const swing=change!==null&&Math.abs(change)>=8?`${[8,11,18].includes(Math.abs(change))||String(Math.abs(change)).startsWith('8')?'an':'a'} ${C.num(Math.abs(change))}-win ${change>0?'jump':'drop'} from last season`:null;
        const review=text=>`${T.nickname} review: ${text}`,finalRound=exit&&['Finals','title game'].includes(exit.label);
        const field=league.leagueType===1?'tournament':'playoffs',deep=exit&&(finalRound||exit.index>0),bracketSet=entrants.size>0;
        const headline=title?review(record.W>record.L?`${mark} and a championship`:`${mark}, then a championship`):
          winPct>=.7?review(exit?`${a} ${mark} season that ended in the ${exit.label}`:`${a} ${mark} season that set the standard`):
          record.W>record.L?review(finalRound?`${mark} and a run to the ${exit.label}`:exit?`${mark}, then out in the ${exit.label}`:alive?`${mark} and still playing`:
            bracketSet&&!playoff?`${mark} and left out of the ${field}`:swing?`${mark}, ${swing}`:playoff?`${mark} and a ticket to the ${league.leagueType===1?'tournament':'postseason'}`:
            identity==='defense'?`${mark}, built on defense`:identity==='offense'?`${mark}, powered by the offense`:
            winPct>=.6||!ranking?`${a} ${mark} season worth building on`:ranking==='unranked'?`${mark} and unranked`:`${mark}, ${ranking}`):
          deep?review(`${mark}, then a run to the ${exit.label}`):
          record.W===record.L?review(playoff?`a .500 season and a ${league.leagueType===1?'tournament bid':'playoff spot'}`:'a .500 season, and the questions that come with it'):
          playoff?review(`${mark}, and in the ${field} anyway`):
          swing?review(change>0?`${mark}, but ${swing}`:`${mark}, ${swing}`):
          winPct<=.3?review(`${a} ${mark} season to forget`):review(`${mark} and searching for answers`);
        const post=title?', then won the championship':exit?`, then saw the season end in the ${exit.label} against ${C.teamRef(exit.opponent).full}${exit.firstTo>1?`, ${exit.losses}-${exit.wins}`:''}`:alive?`, and ${T.city||!T.plural?'is':'are'} still alive in the ${run.at(-1).label}`:playoff?', good for a place in the playoff field':'';
        const opener=`${cap(T.full)} ${winPct>=.7?'dominated the regular season, finishing':record.W>record.L?'closed the regular season at':record.W===record.L?'split the regular season at':'ended a difficult regular season at'} ${record.W}-${record.L}${post}.${change!==null&&Math.abs(change)>=5?` That is ${C.plural(Math.abs(change),'win')} ${change>0?'better':'worse'} than last season's ${prior.W}-${prior.L}.`:''}`;
        const profile=margin===null?'':`${identity==='defense'?`Defense was the calling card. ${cap(T.short)} ${defendingRank===1?`had the league's stingiest defense`:`ranked ${ordinal(defendingRank)} in points allowed`} at ${avg(record,'OPP')} points allowed a night`:
          identity==='offense'?`The offense carried them. ${cap(T.short)} ${scoringRank===1?`had the league's top offense`:`ranked ${ordinal(scoringRank)} in scoring`} at ${avg(record,'PTS')} points a night`:
          identity==='both'?`${cap(T.short)} ${T.city||!T.plural?'was':'were'} good at both ends, ranking ${rankText(scoringRank,'scoring')} and ${rankText(defendingRank,'defense')}`:
          `${cap(T.short)} ranked ${ordinal(scoringRank)} of ${teamCount} in scoring (${avg(record,'PTS')} a night) and ${ordinal(defendingRank)} in points allowed (${avg(record,'OPP')})`}, and ${margin>=0?'outscored opponents by':`${T.city||!T.plural?'was':'were'} outscored by`} ${Math.abs(margin).toFixed(1)} points per game.`;
        const shooting=record.FGA>0?`They shot ${pct(record,'FGM','FGA')} from the floor${record.TPA>0?` and ${pct(record,'TPM','TPA')} from 3-point range`:''}.`:'';
        const second=leaders[1]&&leaders[1].s.GP>0?` ${C.playerDisplay(leaders[1].p)} was next at ${avg(leaders[1].s,'PTS')} points a game.`:'';
        const star=p?`${C.playerDisplay(p.p)} led the team in scoring, averaging ${line(p.s)}.${second}`:'';
        add(`team-${r.team.id}-regular`,'Team season review',headline,
          [opener,[profile,shooting].filter(Boolean).join(' '),star],[r.team],
          ['Player','GP','PTS','REB','AST','STL','BLK'],leaders.slice(0,5).map(x=>[C.playerDisplay(x.p),...['GP','PTS','REB','AST','STL','BLK'].map(k=>x.s[k]??'—')]),leaders.find(x=>x.p.tid===r.team.id)?.p,90);
      }
    }
    const allowedRank=t=>{const r=records.find(x=>x.team.id===t?.id)?.year?.seasonStats;return r?.GP>0?1+records.filter(x=>x.year?.seasonStats?.GP>0&&x.year.seasonStats.OPP/x.year.seasonStats.GP<r.OPP/r.GP).length:null;};
    for(const award of league.awards||[]){
      if(!award.enabled||award.id===0||![0,3].includes(award.phase)||!(award.phase===0?complete:!!winner))continue;
      const kind=awardKind(award);
      // All-Star selections come in dozens; they don't each deserve a story.
      if(kind==='allstar')continue;
      for(const p of players.values()){
        if(!(p.awards||[]).some(a=>a.id===award.id&&a.league===league.leagueType&&a.yearsWon?.includes(year)))continue;
        const s=stats(p,league,year,award.phase===3?'finals':'season')||stats(p,league,year,award.phase===3?'playoffs':'season');
        const team=lookup.teams.get(p.tid),rec=records.find(x=>x.team.id===team?.id)?.year?.seasonStats;
        const alsoWon=(league.awards||[]).filter(a=>a.enabled&&a.id!==award.id&&a.id!==0&&!['allstar','asmvp','threes'].includes(awardKind(a))&&(p.awards||[]).some(h=>h.id===a.id&&h.league===league.leagueType&&h.yearsWon?.includes(year))).map(a=>a.name);
        const prev=stats(p,league,year-1);
        const extra={award:{kind,id:award.id,name:award.name,alsoWon,teamRecord:rec?.GP>0?[rec.W,rec.L]:null,allowedRank:allowedRank(team),champion:winner?.id===team?.id,
          previous:prev?.GP>=5?{GP:prev.GP,PTS:prev.PTS,REB:prev.REB,AST:prev.AST}:null,rookie:p.yrs===0||p.yrs===1&&!prev,pronoun:C.pronoun(p),teamName:team?C.teamDisplay(team):null,teamCity:team?.city||null,teamNickname:team?.name||null}};
        add(`award-${award.id}-${p.id}`,'Award announcement',awardHeadline(kind,C.playerDisplay(p),award.name,team,year),
          [`${C.playerDisplay(p)} has won the ${year} ${award.name}${/award$/i.test(award.name)?'':' award'}.`],team?[team]:[],
          ['Award','Winner','Year'],[[award.name,C.playerDisplay(p),year]],p,kind==='mvp'||kind==='finals'?130:kind==='other'||kind==='asmvp'||kind==='threes'?90:115,extra);
      }
    }
    if(complete&&!winner){
      rounds.forEach((round,index)=>{
        const real=(round.series||[]).filter(s=>lookup.teams.has(s.topSeed)&&lookup.teams.has(s.lowerSeed)&&s.topSeed!==s.lowerSeed);
        const active=real.filter(s=>!s.winner);
        if(!active.length)return;
        const scores=real.map(s=>({s,score:seriesScore(s,index,lookup)})),played=scores.some(x=>x.score.games>0);
        if(played){
          // Mid-round, the useful story is where every series stands.
          const R=id=>C.teamRef(lookup.teams.get(id)),label=roundLabel(bracket,index,league.leagueType===1),cap=C.capitalize;
          const done=scores.filter(x=>x.s.winner),live=scores.filter(x=>!x.s.winner);
          const status=x=>{const a=x.score.top,b=x.score.lower,lead=a>=b?x.s.topSeed:x.s.lowerSeed,trail=lead===x.s.topSeed?x.s.lowerSeed:x.s.topSeed,hi=Math.max(a,b),lo=Math.min(a,b);
            return a===b?`${R(x.s.topSeed).nick} and ${R(x.s.lowerSeed).nick} are tied ${a}-${b}`:`${R(lead).nick} ${C.verb(R(lead),'lead')} ${R(trail).nick} ${hi}-${lo}${hi===x.s.firstTo-1?`, one win from advancing`:''}`;};
          const paragraphs=[];
          if(done.length){
            const sweeps=done.filter(x=>Math.min(x.score.top,x.score.lower)===0&&x.s.firstTo>1);
            paragraphs.push(`${C.capitalize(C.plural(done.length,'team'))} ${done.length===1?'has':'have'} already advanced from the ${label}: ${C.listJoin(done.map(x=>`${R(x.s.winner).nick}${x.s.firstTo>1?` in ${C.num(x.score.games)}`:''}`))}.${sweeps.length>=2?sweeps.length===done.length?` All ${C.num(sweeps.length)} were sweeps.`:` ${C.capitalize(C.num(sweeps.length))} of those series were sweeps.`:''}`);
          }
          paragraphs.push(`Still being decided: ${live.map(status).join('; ')}.`);
          const tied=live.filter(x=>x.score.top===x.score.lower&&x.score.games>0);
          if(tied.length)paragraphs.push(`${tied.length===1?'The series to watch is':'The series to watch are'} ${C.listJoin(tied.map(x=>`${R(x.s.topSeed).nickname}-${R(x.s.lowerSeed).nickname}`))}, where nobody has separated.`);
          const rows=scores.map(x=>[C.teamDisplay(lookup.teams.get(x.s.topSeed)),C.teamDisplay(lookup.teams.get(x.s.lowerSeed)),x.s.firstTo===1?'Single elimination':`Best of ${x.s.firstTo*2-1}`,`${x.score.top}-${x.score.lower}`]);
          add(`playoff-round-${index+1}-day-${day}`,'Playoff preview',`${league.shortName||'League'} ${label}: where every series stands`,paragraphs,
            [...new Set(real.flatMap(s=>[s.topSeed,s.lowerSeed]))].map(id=>lookup.teams.get(id)),['Team','Opponent','Format','Series'],rows,null,112);
          return;
        }
        const rows=active.map(s=>[C.teamDisplay(lookup.teams.get(s.topSeed)),C.teamDisplay(lookup.teams.get(s.lowerSeed)),s.firstTo===1?'Single elimination':s.firstTo>1?`Best of ${s.firstTo*2-1}`:'—']);
        add(`playoff-round-${index+1}`,'Playoff preview',`${league.shortName||'League'} playoff round ${index+1}: the matchups`,
          playoffPreviewParagraphs(active,records,lookup,league,index),
          [...new Set(active.flatMap(s=>[s.topSeed,s.lowerSeed]))].map(id=>lookup.teams.get(id)),['Team','Opponent','Format'],rows,null,115);
      });
    }
    if(winner){
      const opponent=confirmedFinal?lookup.teams.get(final[0].topSeed===winner.id?final[0].lowerSeed:final[0].topSeed):null;
      const row=records.find(r=>r.team.id===winner.id)?.year;
      const college=league.leagueType===1,W=C.teamRef(winner),run=playoffRun(winner.id,bracket,lookup,college),last=run.at(-1);
      const finalGame=lookup.completed.filter(x=>x.game.tRound===rounds.length&&x.game.winner===winner.id).at(-1)?.game;
      const finalScore=finalGame?`${Math.max(finalGame.homeScore,finalGame.awayScore)}-${Math.min(finalGame.homeScore,finalGame.awayScore)}`:'';
      const lede=`${C.capitalize(W.full)} are the ${year} ${league.shortName||league.leagueName} champions${opponent?last&&last.firstTo>1?`, finishing off ${C.teamRef(opponent).full} ${last.wins}-${last.losses} in the Finals`:`, beating ${C.teamRef(opponent).full}${finalScore?` ${finalScore}`:''} in the title game`:''}.`;
      const earlier=run.slice(0,-1).filter(r=>r.done&&r.won),sevens=run.filter(r=>r.firstTo>1&&r.games===r.firstTo*2-1).length;
      const road=earlier.length?`The road there: they ${C.listJoin(earlier.map(runClause))}${last?`, then ${runClause(last).replace(/ in the (?:Finals|title game)$/,'')} for the title`:''}.${sevens>=2?` That's ${C.num(sevens)} series that went the distance.`:''}`:'';
      const mvp=[...players.values()].find(p=>(league.awards||[]).some(a=>a.enabled&&a.phase===3&&(p.awards||[]).some(h=>h.id===a.id&&h.league===league.leagueType&&h.yearsWon?.includes(year))));
      const mvpAward=mvp&&(league.awards||[]).find(a=>a.phase===3&&a.enabled);
      const fs=mvp?stats(mvp,league,year,'finals')||stats(mvp,league,year,'playoffs'):null;
      const mvpLine=mvp&&fs?`${C.playerDisplay(mvp)} was named ${mvpAward.name}${fs.GP===1?` after ${C.plural(fs.PTS,'point')}, ${C.plural(fs.REB,'rebound')} and ${C.plural(fs.AST,'assist')} in the title game`:`, averaging ${avg(fs,'PTS')} points, ${avg(fs,'REB')} rebounds and ${avg(fs,'AST')} assists in the Finals`}.`:'';
      add('championship','Championship review',`${W.nickname} ${C.verb(W,'are')} ${year} ${league.shortName||'league'} champions`.replace(` ${C.verb(W,'are')} `,` ${C.verb(W,'win')} the `).replace(/ champions$/,' title'),
        [lede,road,
          ...(row?[`It caps a ${row.seasonStats.W}-${row.seasonStats.L} regular season. ${teamLine(C.capitalize(W.short),row.seasonStats)}`.trim(),...(row.playoffStats?.GP&&teamLine('they',row.playoffStats)?[`In the playoffs, ${teamLine('they',row.playoffStats)}`]:[])]:[]),mvpLine],opponent?[winner,opponent]:[winner],
        ['Champion','Runner-up','Year'],[[C.teamDisplay(winner),opponent?C.teamDisplay(opponent):'Not available',year]],null,140,
        {run:run.map(r=>({label:r.label,opponent:C.teamDisplay(r.opponent),wins:r.wins,losses:r.losses,firstTo:r.firstTo,games:r.games})),
          finalsMvp:mvp&&fs?{name:C.playerDisplay(mvp),award:mvpAward.name,GP:fs.GP,PTS:fs.PTS,REB:fs.REB,AST:fs.AST}:null,finalScore:finalScore||null});
    }
    const titleCategories={PTS:[7,'the scoring title'],REB:[8,'the rebounding title'],AST:[9,'the assist title'],STL:[10,'the steals title'],BLK:[11,'the blocks title']};
    for(const {story} of results)if(story.eventKey==='leaders'){
      story.seasonSnapshot.leaderProfiles=[...players.values()].map(p=>({name:C.playerDisplay(p),position:p.position,bio:playerBackground(p,league,leagues),s:stats(p,league,year)})).filter(p=>p.s);
      story.seasonSnapshot.leaderHonors=[];
      for(const [category,[awardId,label]] of Object.entries(titleCategories)){
        const leaders=story.seasonSnapshot.rows.filter(r=>r[0]===category);
        for(const p of players.values()){
          const s=stats(p,league,year);
          if(!s||!Number.isFinite(s[category])||!leaders.some(r=>r[1]===C.playerDisplay(p)&&r[2]/r[3]===s[category]/s.GP))continue;
          const h=honorHistory(C.playerDisplay(p),label,(p.awards||[]).filter(a=>a.id===awardId),league.leagueType,year);
          if(h.count)story.seasonSnapshot.leaderHonors.push({...h,playerId:p.id,category});
        }
      }
      story.paragraphs=leadersArticle(story);
    }
    return results;
  }
  function featuredStatsForStory(story){
    const snapshot=story.seasonSnapshot,p=snapshot?.featuredPlayer;
    if(story.statsPeriod==='finals')return p?.finalsStats||p?.playoffStats;
    if(story.statsPeriod==='playoffs'||snapshot?.tables?.some(t=>t.label==='Playoff player statistics'))return p?.playoffStats;
    return p?.regularStats;
  }
  function refreshTVStory(story,league,leagues=[league]){
    const live=structuredClone(story);
    if(!league||C.buildFingerprint(league)!==story.fingerprint||String(C.seasonYear(league))!==String(story.season))return live;
    // Refresh the presentation copy only. Articles and archive evidence retain
    // their original values; the loaded save is authoritative for live TV.
    if(story.kind==='season'&&story.eventKey){
      const fresh=candidates(league,leagues).find(c=>c.story.eventKey===story.eventKey)?.story;
      if(fresh){live.seasonSnapshot=structuredClone(fresh.seasonSnapshot);live.statsPeriod=fresh.statsPeriod;}
    }
    const featured=live.seasonSnapshot?.featuredPlayer,lookup=C.buildLookups(league);
    if(featured?.id!=null){
      const player=lookup.players.get(featured.id)||[...(league.retirees||[]),...(league.hallOfFame||[])].find(p=>p.id===featured.id);
      featured.regularStats=player?stats(player,league,story.season,'season'):null;
      featured.playoffStats=player?stats(player,league,story.season,'playoffs'):null;
      featured.finalsStats=player?stats(player,league,story.season,'finals'):null;
    }
    if(live.gameSummary&&live.playerId!=null){
      const player=lookup.players.get(live.playerId),game=lookup.completed.find(g=>g.game.gId===live.gid)?.game;
      const period=game?.tRound>0?'playoffs':game?.gameType===0?'season':null;
      const average=player&&period?stats(player,league,story.season,period):null;
      delete live.broadcastSnapshot;
      if(average)live.broadcastSnapshot={fingerprint:story.fingerprint,season:story.season,day:story.day,
        playerId:live.playerId,period,average,source:'loaded-save',asOfDay:lookup.latestDay+1};
    }
    delete live.broadcastAsOfDay;
    return live;
  }
  return {candidates,stats,outcome,quoteLines,awardQuoteLines,playoffPreviewParagraphs,postseasonOutcome,factsForStory,leadersArticle,seasonReviewArticle,seasonReviewLists,repairSeasonReviews,mvpRace,playerBackground,honorHistory,honorLines,articleParagraphs,featuredStatsForStory,refreshTVStory};
});
