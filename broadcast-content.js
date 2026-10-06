/* Pure editorial scripting for HoopWire TV. Written stories supply facts, not a transcript. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory();
  else root.HoopWireBroadcastContent=factory();
})(globalThis,function(){
  'use strict';
  function fmt(n){return Number.isFinite(Number(n))?Number(n).toFixed(1):null;}
  function featuredStats(story){
    const p=story?.seasonSnapshot?.featuredPlayer;if(!p)return null;
    if(story.statsPeriod==='finals')return p.finalsStats||p.playoffStats||p.regularStats;
    return p.regularStats||p.playoffStats||p.finalsStats;
  }
  function rate(s,k){return s&&s.GP>0&&Number.isFinite(s[k])?fmt(s[k]/s.GP):null;}
  function seasonTable(story,label){return (story?.seasonSnapshot?.tables||[]).find(t=>t.label===label);}
  function recordMap(story){
    return new Map((story?.seasonSnapshot?.teamRecords||[]).map(x=>[x.teamId,x.record?.seasonStats||x.record]).filter(([,r])=>r));
  }
  function playoffScript(story){
    const rows=story?.seasonSnapshot?.rows||[],records=recordMap(story),turns=[];
    turns.push({speaker:0,text:`The bracket is set: ${rows.length} series are on the board, and now the regular season gives way to matchup basketball.`});
    const teams=[...records.entries()].map(([id,r])=>({id,r})).filter(x=>Number.isFinite(x.r?.W)).sort((a,b)=>b.r.W-a.r.W||a.r.L-b.r.L);
    if(teams.length){
      const names=new Map();
      for(const row of rows){names.set(row[0],row[0]);names.set(row[1],row[1]);}
      const byName=(story.seasonSnapshot.teamRecords||[]).map(x=>({id:x.teamId,name:(story.relatedTeams||[]).find(t=>t.id===x.teamId)?.name,record:x.record?.seasonStats||x.record})).filter(x=>x.name&&x.record);
      byName.sort((a,b)=>b.record.W-a.record.W||a.record.L-b.record.L);
      if(byName.length)turns.push({speaker:1,text:`${byName[0].name} enter with the strongest record at ${byName[0].record.W}-${byName[0].record.L}. That makes them a measuring stick, but it also means every opponent gets their best shot.`});
    }
    let closest=null;
    for(const row of rows){
      const a=(story.relatedTeams||[]).find(t=>t.name===row[0]),b=(story.relatedTeams||[]).find(t=>t.name===row[1]);
      const ar=a&&records.get(a.id),br=b&&records.get(b.id);
      if(ar&&br&&Number.isFinite(ar.W)&&Number.isFinite(br.W)){
        const gap=Math.abs(ar.W-br.W);
        if(!closest||gap<closest.gap)closest={a:row[0],b:row[1],ar,br,gap};
      }
    }
    if(closest)turns.push({speaker:2,text:`The series I keep circling is ${closest.a} against ${closest.b}. They were separated by only ${closest.gap} win${closest.gap===1?'':'s'}, so that one could turn on a single adjustment or one bad quarter.`});
    const teamStats=seasonTable(story,'Regular-season team statistics');
    if(teamStats?.rows?.length){
      const hottest=[...teamStats.rows].filter(r=>Number.isFinite(Number(r[3]))).sort((a,b)=>Number(b[3])-Number(a[3]))[0];
      if(hottest)turns.push({speaker:3,text:`${hottest[0]} bring the biggest scoring number into the round at ${Number(hottest[3]).toFixed(1)} points per game. In a long series, the question is whether an opponent can take away their first option and force a different answer.`});
      else turns.push({speaker:3,text:'This is where scouting, depth and late-game execution start to matter more than the seed line. The first game should tell us which matchups are real pressure points.'});
    }else turns.push({speaker:3,text:'This is where scouting, depth and late-game execution start to matter more than the seed line. The first game should tell us which matchups are real pressure points.'});
    return turns;
  }
  function awardScript(story){
    const p=story?.seasonSnapshot?.featuredPlayer,name=p?.name||story.headline.split(' wins ')[0],award=story.headline.includes(' wins ')?story.headline.split(' wins ').slice(1).join(' wins '):'the award',s=featuredStats(story);
    const turns=[{speaker:0,text:`Individual honors are in, and ${name} has won ${award}.`}];
    const ppg=rate(s,'PTS'),rpg=rate(s,'REB'),apg=rate(s,'AST');
    if(ppg||rpg||apg){
      const parts=[];if(ppg)parts.push(`${ppg} points`);if(rpg)parts.push(`${rpg} rebounds`);if(apg)parts.push(`${apg} assists`);
      turns.push({speaker:1,text:`The season-long production is the starting point: ${parts.join(', ')} per game over ${s.GP} appearance${s.GP===1?'':'s'}.`});
    }else turns.push({speaker:1,text:`This is a recognition story first. The league chose ${name}, and the focus belongs on the body of work that produced the award.`});
    turns.push({speaker:2,text:`What separates an award season is consistency. It is not one big night; it is showing the same level often enough that the whole league notices.`});
    turns.push({speaker:3,text:`So the headline today is ${name}. The standings can wait — this is about the player and the season that earned the recognition.`});
    return turns;
  }
  function championshipScript(story){
    const row=story?.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.headline,runner=row[1];
    const turns=[{speaker:0,text:`${champ} are champions. That is the only headline that matters at the end of the bracket.`}];
    if(runner&&runner!=='Not available')turns.push({speaker:1,text:`They finished the job against ${runner}, and now the regular-season record becomes background to the title itself.`});
    turns.push({speaker:2,text:'Championship runs usually come down to surviving different kinds of games — fast ones, ugly ones, close ones — without losing your identity.'});
    turns.push({speaker:3,text:`For ${champ}, every adjustment and every possession led here. The season ends with a banner.`});
    return turns;
  }
  function gameScript(story){
    const g=story?.gameSummary,turns=[{speaker:0,text:`Let's get into the game: ${story.headline}.`}];
    if(g?.away&&g?.home)turns.push({speaker:1,text:`The scoreboard says ${g.away.name} ${g.away.score}, ${g.home.name} ${g.home.score}. That gives us the result; the interesting part is how the winner created separation.`});
    if(story.playerStats){
      const p=story.playerStats,parts=[];
      if(Number.isFinite(p.PTS))parts.push(`${p.PTS} points`);
      if(Number.isFinite(p.REB))parts.push(`${p.REB} rebounds`);
      if(Number.isFinite(p.AST))parts.push(`${p.AST} assists`);
      if(parts.length)turns.push({speaker:2,text:`The individual line that jumps off the page is ${parts.join(', ')}. That kind of production changes what the defense can afford to give up.`});
    }
    turns.push({speaker:3,text:'Now the question is what carries over. One result can expose a matchup, but the next opponent gets a chance to answer it.'});
    return turns;
  }
  function genericScript(story){
    const type=String(story?.type||'story').toLowerCase();
    const turns=[{speaker:0,text:`Here's the latest from around the league: ${story.headline}.`}];
    if(type.includes('injury'))turns.push({speaker:1,text:'The first concern is availability, but the basketball question comes right behind it: who absorbs the missing minutes and responsibility?'});
    else if(type.includes('trade')||type.includes('signing')||type.includes('roster'))turns.push({speaker:1,text:'The move is official. What matters next is fit — role, rotation and how quickly everyone adjusts to a different lineup.'});
    else if(type.includes('season review'))turns.push({speaker:1,text:'A season review is less about one result than the pattern behind all of them: what held up, what slipped, and what has to change next.'});
    else turns.push({speaker:1,text:'The headline gives us the event. The next layer is what it changes for the people involved and what to watch from here.'});
    turns.push({speaker:2,text:'That is where context matters. Numbers and outcomes tell part of the story, but roles and expectations determine what comes next.'});
    turns.push({speaker:3,text:'We will keep an eye on the next game and the next decision, because that is usually where the impact becomes clear.'});
    return turns;
  }
  function script(story){
    if(!story)return [];
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return awardScript(story);
    if(story.type==='Playoff preview'||story.eventKey?.startsWith('playoff-round-'))return playoffScript(story);
    if(story.type==='Championship review'||story.eventKey==='championship')return championshipScript(story);
    if(story.gameSummary)return gameScript(story);
    return genericScript(story);
  }
  return {script,awardScript,playoffScript,championshipScript,gameScript,genericScript};
});
