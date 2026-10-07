/* Milestone reporting uses saved year records, awards and brackets, not phase numbers. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core.js'));
  else root.HoopWireSeason=factory(root.HoopWireCore);
})(globalThis,function(C){
  'use strict';
  const keys=['GP','PTS','REB','AST','STL','BLK','FGM','FGA','TPM','TPA','FTM','FTA','TO'];
  function honorHistory(name,label,records,leagueType,year,confirmed=false){
    const years=[...new Set(records.filter(r=>r.league===leagueType).flatMap(r=>r.yearsWon||[]).filter(y=>Number.isInteger(y)&&y>0&&y<=year).concat(confirmed?[year]:[]))].sort((a,b)=>a-b);
    let streak=0;for(let y=year;years.includes(y);y--)streak++;
    return {name,label,years,count:years.length,current:years.includes(year),streak};
  }
  function honorLine(h){
    if(!h||h.count<1)return '';
    if(!h.current)return `${h.name} had already won ${h.label} ${h.count===1?'once':h.count===2?'twice':`${h.count} times`} before this season.`;
    if(h.count<2)return '';
    const ordinal=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'][h.count]||`${h.count}${h.count%100>=11&&h.count%100<=13?'th':h.count%10===1?'st':h.count%10===2?'nd':h.count%10===3?'rd':'th'}`;
    return `${h.name} wins ${h.label} for the ${ordinal} time${h.streak>1?`, ${h.streak===2?'making it back-to-back wins':`making it ${h.streak} straight wins`}`:''}.`;
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
  function articleParagraphs(story){
    if(story.type==='Season leaders')return leadersArticle(story);
    if(story.type==='Regular-season review')return seasonReviewArticle(story);
    const paragraphs=[...(story.paragraphs||[])],missing=honorLines(story).filter(line=>!paragraphs.some(p=>p.includes(line)));
    if(missing.length){if(paragraphs.length)paragraphs[0]+=' '+missing.join(' ');else paragraphs.push(missing.join(' '));}
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
    const paragraphs=[],first=teams[0],players=mvpRace(story.seasonSnapshot);
    for(const [i,t] of teams.slice(0,3).entries()){
      const s=t.s,games=s.W+s.L,winning=games?s.W/games:0;
      let text;
      if(!i){
        const tied=teams.filter(x=>x.s.W===s.W&&x.s.L===s.L);
        text=tied.length>1?`${tied.map(x=>x.name).join(' and ')} finished level at ${s.W}-${s.L}, leaving the regular-season race without a clear winner.`:
          `${t.name} finished with the league's best record at ${s.W}-${s.L}. ${winning>=.75?'That is the kind of regular season that changes the expectations around a team.':winning>.5?'The record gives them a solid foundation for the postseason.':'The record puts them first, but it does not leave much room for complacency.'}`;
      }else{
        const gap=first.s.W-s.W;
          text=`${t.name} finished ${s.W}-${s.L}. ${gap===0?'They matched the league leader and belong in the same conversation.':gap<=3?`Only ${gap} ${gap===1?'win separates':'wins separate'} them from ${first.name}, so the gap is small enough to matter without settling the argument.`:`They finished ${gap} wins behind ${first.name}. ${winning>.5?'That is a good season, though another team set the higher standard.':'The record shows how much ground they still have to make up.'}`}`;
      }
      if(s.GP>0&&Number.isFinite(s.PTS)&&s.PTS>=0&&Number.isFinite(s.OPP)&&s.OPP>=0){
        const margin=(s.PTS-s.OPP)/s.GP;
        text+=` They averaged ${avg(s,'PTS')} points and allowed ${avg(s,'OPP')}. ${margin>0?`On average, they beat teams by ${margin.toFixed(1)} points a game.`:margin<0?`On average, they lost by ${Math.abs(margin).toFixed(1)} points a game.`:'Their scoring margin was even.'}`;
      }
      paragraphs.push(text);
    }
    for(const [i,p] of players.entries()){
      const s=p.s,secondary=['AST','REB'].filter(k=>Number.isFinite(s[k])&&s[k]>0).sort((a,b)=>s[b]-s[a])[0];
      const awardName=story.seasonSnapshot?.mvpAward?.name|| (story.seasonSnapshot?.leagueType===1?'Player of the Year':'Most Valuable Player');
      const won=(p.mvpWins||[]).includes(story.seasonSnapshot?.year);
      const statLine=`${avg(s,'PTS')} points${secondary?` and ${avg(s,secondary)} ${secondary==='AST'?'assists':'rebounds'}`:''}`;
      const standing=won?`${p.name} won the ${awardName}`:i===0?`With ${statLine}, ${p.name} has the clearest case for ${awardName}`:`With ${statLine}, ${p.name} stays in the ${awardName} mix`;
      let text=won?`${standing}, finishing with ${statLine}.`:standing+'.';
      if(s.FGA>0&&s.FGM>=0&&s.FGM<=s.FGA){
        text+=` The ${pct(s,'FGM','FGA')} shooting tells the rest of the story: ${s.FGM/s.FGA>=.5?'the scoring came with strong efficiency.':s.FGM/s.FGA<.4?'the production came with too many misses.':'there is still room to get more from the same opportunities.'}`;
      }
      if(secondary==='AST'&&Number.isFinite(s.TO)&&s.TO>=0){
        text+=` He did it with ${avg(s,'TO')} turnovers a game.${s.AST>s.TO*2?' That is a clean balance for a high-volume passer.':s.TO>s.AST?' The turnovers are the clear concern in an otherwise productive season.':''}`;
      }
      const previous=p.previousStats;
      if(previous?.GP>=5&&Number.isFinite(previous.PTS)&&s.GP>=5&&Math.abs(s.PTS/s.GP-previous.PTS/previous.GP)>=2){
        const up=s.PTS/s.GP>previous.PTS/previous.GP;
        text+=` ${up?'That is up from':'That is down from'} ${avg(previous,'PTS')} points a game last year, a ${up?'clear step forward':'noticeable step back'} for ${p.name}.`;
      }
      paragraphs.push(text);
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
      groups[key]={names,name:names.length>1?names.slice(0,-1).join(', ')+' and '+names.at(-1):names[0],rate:max.toFixed(1),tied:names.length>1};
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
    const subject=(group,preferAge=false)=>{
      if(group.tied)return group.name;
      const person=profile(group.names[0]),bio=person?.bio;if(!bio)return group.name;
      const words=['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth'];
      const n=bio.yearsPro,ordinal=words[n]||`${n}${n%100>=11&&n%100<=13?'th':n%10===1?'st':n%10===2?'nd':n%10===3?'rd':'th'}`;
      const leadWithAge=!!bio.age&&(preferAge||!(n>0));
      let detail=leadWithAge?`${bio.age}-year-old`:n>0?`${ordinal}-year pro`:'';
      if(bio.college&&!leadWithAge)detail+=`${detail?' out of':'a product of'} ${bio.college}`;
      if(leadWithAge){
        const position=positionName(person.position);
        return `the ${detail}${position?` ${position}`:''}, ${group.name},`;
      }
      return detail?`${group.name}, ${detail.startsWith('a product')?detail:'the '+detail},`:group.name;
    };
    const sameLeaders=(a,b)=>a&&b&&a.names.length===b.names.length&&a.names.every(n=>b.names.includes(n));
    const double=sameLeaders(g.REB,g.BLK),season=story.season!=null?`in ${story.season}`:'this season';
    if(g.PTS){
      let text=`${subject(g.PTS)} ${g.PTS.tied?'shared the scoring title':'won the scoring title'} ${season} with ${g.PTS.rate} points per game.`;
      const scorer=!g.PTS.tied?profile(g.PTS.names[0]):null,fg=pct(scorer?.s,'FGM','FGA');
      if(/^\d+(?:\.\d+)?%$/.test(fg))text+=` ${fg} shooting from the field put a little shape around the scoring title.`;
      if(scorer?.s?.FGA>0&&Number.isFinite(scorer.s.FGM))text+=scorer.s.FGM/scorer.s.FGA>=.5?
        ' That is a scoring title backed by efficient shooting.':scorer.s.FGM/scorer.s.FGA<.4?
        ' The scoring title is impressive, but the missed shots are the obvious room for improvement.':
        '';

      text+=' '+history('PTS').join(' ');paragraphs.push(text.trim());
    }
    const interior=[];
    if(double){
      interior.push(`${subject(g.REB,true)} ${g.REB.tied?'shared both':'won both'} the rebounding and shot-blocking titles, averaging ${g.REB.rate} rebounds and ${g.BLK.rate} blocks a night.`);
      interior.push('Leading both categories is the kind of two-way season that changes how the player is remembered.');
      const p=!g.REB.tied?profile(g.REB.names[0]):null;if(p?.s?.GP>0&&p.s.PTS/p.s.GP>=10&&Number(g.REB.rate)>=10)interior.push(`With ${(p.s.PTS/p.s.GP).toFixed(1)} points a game as well, ${g.REB.name} averaged a double-double for the season.`);
    }else{
      if(g.REB)interior.push(`${subject(g.REB,true)} ${g.REB.tied?'shared the rebounding title':'claimed the rebounding title'} at ${g.REB.rate} rebounds per game.`);

      if(g.BLK)interior.push(`${subject(g.BLK)} ${g.BLK.tied?'shared the league lead in':'led the league in'} shot blocking with ${g.BLK.rate} blocks a night.`);

    }
    interior.push(...history('REB','BLK'));if(interior.length)paragraphs.push(interior.join(' '));
    const perimeter=[];
    if(g.AST){
      perimeter.push(`${subject(g.AST)} ${g.AST.tied?'shared the lead':'finished as the leading playmaker'} with ${g.AST.rate} assists per game.`);
      const passer=!g.AST.tied?profile(g.AST.names[0]):null,s=passer?.s;
      if(s?.GP>0&&Number.isFinite(s.TO)&&s.TO>=0){
        perimeter.push(`${avg(s,'TO')} turnovers a game came with that passing. ${s.AST>s.TO*2?'The assists comfortably outnumber the mistakes.':s.TO>s.AST?'The turnover total is the concern beside the passing title.':'The passing was productive, though the mistakes kept it from being spotless.'}`);
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
    function add(eventKey,type,headline,paragraphs,related,headers,rows,featured=null,importance=110){
      const team=related[0]||teams[0],opponent=related[1]||teams.find(t=>t.id!==team.id);
      const s={id:`${fp}:${year}:season:${eventKey}`,eventKey,kind:'season',fingerprint:fp,season:year,day,
        type,headline,paragraphs:paragraphs.filter(Boolean),importance,leagueName:league.leagueName,quotesEnabled:true,templateVersion:7,editorialVersion:eventKey==='regular-wrap'?10:eventKey==='leaders'?10:eventKey.startsWith('award-')||eventKey==='championship'?4:3,
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
        const analysis=margin===null?'':`${C.teamDisplay(r.team)} ${margin>=0?'outscored opponents by':'were outscored by'} ${Math.abs(margin).toFixed(1)} points a night, ranking No. ${scoringRank} in scoring and No. ${defendingRank} in fewest points allowed.`;
        add(`team-${r.team.id}-regular`,'Team season review',`${C.teamDisplay(r.team)}: ${record.W>record.L?'a winning season in review':record.W===record.L?'a .500 season in review':'a difficult season in review'}`,
          [`${C.teamDisplay(r.team)} ${record.W>record.L?'closed the regular season at':record.W===record.L?'split the regular season at':'end a difficult regular season at'} ${record.W}-${record.L}${entrants.has(r.team.id)?', with a place in the playoff field':''}.`,teamLine(C.teamDisplay(r.team),record),analysis,
            ...(p?[`${C.playerDisplay(p.p)} led the team in scoring, averaging ${line(p.s)}.`]:[])],[r.team],
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
          ['Award','Winner','Year'],[[award.name,C.playerDisplay(p),year]],p,120);
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
