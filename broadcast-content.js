/* Original studio dialogue: lead with the story, use familiar basketball language,
   and let the other hosts respond to a specific fact. Box scores do not prove plays. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HoopWireBroadcastContent=factory();
})(globalThis,function(){
  'use strict';
  const labels={PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',BLK:'blocks'};
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const turn=(speaker,text)=>({speaker,text});
  // Maya steers the desk; Jordan makes the forceful case; Andre values boards
  // and production; Nina explains shooting and playmaking. Reactions connect.
  function pick(story,options,salt=0){const seed=[...String(story.id||story.headline||'')].reduce((n,c)=>n+c.charCodeAt(0),salt);return options[seed%options.length];}
  function join(parts){return parts.length<2?parts.join(''):parts.slice(0,-1).join(', ')+' and '+parts.at(-1);}
  function sentence(text){return /[.!?]$/.test(text)?text:text+'.';}
  function rate(s,k){return valid(s?.[k])&&s.GP>0?(s[k]/s.GP).toFixed(1):null;}
  function count(n,label){return `${n} ${n===1?label.replace(/s$/,''):label}`;}
  function numbers(s,average=false){return join(['PTS','REB','AST'].filter(k=>valid(s?.[k])).map(k=>average?`${rate(s,k)} ${labels[k]}`:count(s[k],labels[k])));}
  function shooting(s){
    const parts=[];
    for(const [made,attempts,label] of [['FGM','FGA','from the field'],['TPM','TPA','from three'],['FTM','FTA','at the line']]){
      if(valid(s?.[made])&&valid(s?.[attempts])&&s[attempts]>0&&s[made]<=s[attempts])parts.push(`${s[made]} for ${s[attempts]} ${label}`);
    }
    return join(parts);
  }
  function featuredStats(story){
    const p=story?.seasonSnapshot?.featuredPlayer;
    if(!p)return null;
    if(story.statsPeriod==='finals')return p.finalsStats||p.playoffStats;
    return p.regularStats;
  }
  function teamRecords(story){return (story.seasonSnapshot?.teamRecords||[]).map(x=>({
    name:(story.relatedTeams||[]).find(t=>t.id===x.teamId)?.name,
    r:x.record?.seasonStats||x.record
  })).filter(x=>x.name&&valid(x.r?.W)&&valid(x.r?.L));}
  function playoffScript(story){
    const rows=story.seasonSnapshot?.rows||[],teams=teamRecords(story),turns=[];
    if(!rows.length)return genericScript(story);
    const round=Number(String(story.eventKey||'').split('-').at(-1));
    turns.push(turn(0,`${round>1?`Round ${round} is next`:'The playoffs are here'}. We've got ${rows.length} ${rows.length===1?'matchup':'matchups'}.`));
    const sorted=[...teams].sort((a,b)=>b.r.W-a.r.W||a.r.L-b.r.L),best=sorted[0];
    const leaders=sorted.filter(x=>x.r.W===best?.r.W&&x.r.L===best?.r.L);
    if(best)turns.push(turn(1,`${join(leaders.map(x=>x.name))} come in at ${best.r.W} wins and ${best.r.L} losses. ${leaders.length===1?"Best record in this round. Make somebody knock them off before you dismiss them.":"They share the best record in this round. Neither one gets a free pass."}`));
    const pairs=rows.map(row=>({row,a:teams.find(x=>x.name===row[0]),b:teams.find(x=>x.name===row[1])})).filter(x=>x.a&&x.b);
    pairs.sort((a,b)=>Math.abs(a.a.r.W-a.b.r.W)-Math.abs(b.a.r.W-b.b.r.W));
    const closest=pairs[0];
    if(closest){
      const gap=Math.abs(closest.a.r.W-closest.b.r.W);
      turns.push(turn(2,`Hold on. Give me ${closest.row[0]} against ${closest.row[1]}. ${gap===0?'They finished with the same number of wins.':`Only ${gap} win${gap===1?'':'s'} between them.`} I wouldn't pick that one on record alone.`));
      turns.push(turn(3,closest.row[2]==='Single elimination'?"And it's win or go home. There's no Game 2 to fix anything.":/^Best of \d+$/.test(closest.row[2])?`${closest.row[2]}. I'll be watching what each coach changes after Game 1.`:"Let's see who takes Game 1 before we call the series."));
    }else turns.push(turn(2,`${rows[0][0]} face ${rows[0][1]}. ${rows[0][2]==='Single elimination'?"It's win or go home.":sentence(rows[0][2]||'The next round is up next')}`));
    return turns;
  }
  function awardScript(story){
    const row=story.seasonSnapshot?.rows?.[0],p=story.seasonSnapshot?.featuredPlayer;
    const name=p?.name||row?.[1]||String(story.headline).split(' wins ')[0];
    const award=row?.[0]||String(story.headline).split(' wins ').slice(1).join(' wins ')||'the award';
    const s=featuredStats(story),turns=[turn(0,`${name} takes home ${award}.`)];
    if(s?.GP>0&&numbers(s)){
      turns.push(turn(1,`Look at the season ${name} put together: ${numbers(s,true)} a game${story.statsPeriod==='finals'?' in the postseason':''}.`));
      if(rate(s,'MIN'))turns.push(turn(2,`${rate(s,'MIN')} minutes a game, too.`));
      const category=/defens/i.test(award)?['BLK','STL'].find(k=>s[k]>0):/rookie|valuable|mvp/i.test(award)?'PTS':null;
      if(category&&rate(s,category))turns.push(turn(2,category==='PTS'&&s.AST>0?`And ${rate(s,'AST')} assists a night. Give the passing some credit, too.`:`I'm looking at the ${labels[category]}: ${rate(s,category)} a night over ${s.GP} game${s.GP===1?'':'s'}.`));
    }
    turns.push(turn(3,`Congratulations to ${name}. That's an award to be proud of.`));
    return turns;
  }
  function championshipScript(story){
    const row=story.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.relatedTeams?.[0]?.name||story.headline;
    const turns=[turn(0,`${champ} have won the championship!`)];
    if(row[1]&&row[1]!=='Not available')turns.push(turn(1,`They beat ${row[1]} for the title. Give them their credit. Nobody can argue with a championship.`));
    const record=teamRecords(story).find(x=>x.name===champ);
    if(record)turns.push(turn(2,`${record.r.W} wins in the regular season, and now a championship. That's the finish they wanted.`));
    turns.push(turn(3,`Enjoy it, ${champ} fans. You're bringing home a banner.`));
    return turns;
  }
  function gameScript(story){
    const g=story.gameSummary;
    if(!g?.home||!g?.away||!valid(g.home.score)||!valid(g.away.score)||g.home.score===g.away.score)return genericScript(story);
    const winner=g.home.score>g.away.score?g.home:g.away,loser=winner===g.home?g.away:g.home,margin=winner.score-loser.score;
    const verbs=margin<=3?['edge','squeak past']:margin>=20?['roll past','beat']:['beat','get past'];
    const seed=[...String(story.id||story.headline||'')].reduce((n,c)=>n+c.charCodeAt(0),0);
    const turns=[turn(0,`${winner.name} ${verbs[seed%verbs.length]} ${loser.name}, ${winner.score} to ${loser.score}.`)];
    turns.push(turn(1,margin<=3?pick(story,[`${margin===1?'One point':`${margin} points`}. ${winner.name} will take it. A win counts the same whether it's by one or twenty.`,`Only ${margin} point${margin===1?'':'s'} in it. Give ${winner.name} the win, but I'm not calling that domination.`]):margin>=20?pick(story,[`They lost by ${margin}. ${loser.name} can't dress that up. That's a beating.`,`A ${margin}-point win. Give ${winner.name} their credit. ${loser.name} need a much better answer next time.`]):`${winner.name} win by ${margin}. All right, who gets your game ball?`));
    const archivedName=(story.paragraphs||[]).map(p=>typeof p==='string'?p.match(/^(.+?) was named player of the game/):null).find(Boolean)?.[1];
    const s=story.playerStats,name=story.playerName||archivedName||'The player of the game';
    if(s&&numbers(s)){
      turns.push(turn(2,`${name} finished with ${numbers(s)}. ${pick(story,["That's my starting point.",'Give that player some credit.'],1)}`));
      const doubles=Object.keys(labels).filter(k=>valid(s[k])&&s[k]>=10).length,line=shooting(s);
      if(doubles>=2)turns.push(turn(3,`${doubles>=5?'A quintuple-double':doubles===4?'A quadruple-double':doubles===3?'A triple-double':'A double-double'}. ${line?`${name} went ${line}.`:'There is more to that night than the scoring.'}`));
      else if(line)turns.push(turn(3,`Look at the shooting, too. ${name} went ${line}.`));
      if(valid(s.FGM)&&valid(s.FGA)&&s.FGA>=4&&s.FGM<=s.FGA){
        const percentage=100*s.FGM/s.FGA;
        if(percentage>=60)turns.push(turn(1,`That's ${percentage.toFixed(1)} percent from the floor. ${pick(story,["Now that's getting something out of your shots.","I'm with you. That's an efficient night."],2)}`));
        else if(percentage<=33.4)turns.push(turn(1,`But that's ${percentage.toFixed(1)} percent from the floor. I want to see better shooting than that.`));
      }
      if(s.AST>=5)turns.push(turn(2,`${line?"You're looking at the shooting. ":''}I'm looking at those ${s.AST} assists. That's helping teammates eat, too.`));
      else if(s.REB>=5)turns.push(turn(2,`And ${s.REB} boards. Don't just read the points and move on.`));
      const defense=join(['STL','BLK'].filter(k=>valid(s[k])&&s[k]>0).map(k=>count(s[k],labels[k])));
      if(defense)turns.push(turn(1,`Don't skip the defensive numbers: ${defense}.`));
      const ppg=rate(story.cumulativeStats?.season,'PTS');
      if(ppg)turns.push(turn(0,`${name} is averaging ${ppg} points a game ${story.cumulativeStats.period==='playoffs'?'in the playoffs':'this season'}.`));
    }else turns.push(turn(3,`The win goes to ${winner.name}. Let's get to the next story.`));
    return turns;
  }
  function seasonScript(story){
    const teams=teamRecords(story).sort((a,b)=>b.r.W-a.r.W||a.r.L-b.r.L),turns=[];
    if(!teams.length)return genericScript(story);
    const team=teams[0];
    turns.push(turn(0,`${team.name} finish the regular season with ${team.r.W} wins and ${team.r.L} losses.`));
    const ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP');
    if(ppg&&opp){
      turns.push(turn(1,`They scored ${ppg} points a game and gave up ${opp}.`));
      const gap=(team.r.PTS-team.r.OPP)/team.r.GP;
      turns.push(turn(2,`That's ${Math.abs(gap).toFixed(1)} points a night ${gap>=0?'in their favor':'against them'}. ${gap>0?'That backs up the wins.':gap<0?"You can't keep giving up more than you score.":'They played opponents even on points.'}`));
    }
    // The player table respects team stints; a career or league line may not.
    const table=story.seasonSnapshot?.tables?.find(t=>t.label==='Regular-season player statistics');
    const row=table?.rows?.filter(r=>r[2]!==null&&r[2]!==''&&r[2]!=='—'&&Number.isFinite(Number(r[2]))).sort((a,b)=>Number(b[2])-Number(a[2]))[0];
    if(row&&Number.isFinite(Number(row[2])))turns.push(turn(3,`${row[0]} led their scoring with ${Number(row[2]).toFixed(1)} points a game. That's where I'd start scouting their offense.`));
    if(story.type==='Regular-season review'&&teams[1])turns.push(turn(3,`${teams[1].name} finished at ${teams[1].r.W} wins and ${teams[1].r.L} losses. ${team.r.W===teams[1].r.W&&team.r.L===teams[1].r.L?'They share the best record.':`${team.name} finished ahead of them.`}`));
    return turns;
  }
  function genericScript(story){
    // Short factual news beats are better than four hosts filling time. Reuse only
    // selected reporting, never fictional quotes or technical evidence tables.
    const turns=[turn(0,sentence(String(story.headline||'More news from around the league')))];
    const paragraphs=(story.paragraphs||[]).filter(p=>typeof p==='string'&&!/[“”]/.test(p)&&p!==story.headline);
    const details=paragraphs.filter(p=>!p.startsWith(String(story.headline))&&p.length<=240).slice(0,2);
    for(const [i,text] of details.entries())turns.push(turn(i+1,text));
    return turns;
  }
  function script(story){
    if(!story)return [];
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return awardScript(story);
    if(story.type==='Playoff preview'||story.eventKey?.startsWith('playoff-round-'))return playoffScript(story);
    if(story.type==='Championship review'||story.eventKey==='championship')return championshipScript(story);
    if(story.gameSummary)return gameScript(story);
    if(['Team season review','Regular-season review'].includes(story.type))return seasonScript(story);
    return genericScript(story);
  }
  return {script,awardScript,playoffScript,championshipScript,gameScript,genericScript,seasonScript};
});
