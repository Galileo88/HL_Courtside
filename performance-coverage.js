/* Latest verified box scores compared with the season before that game. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./season-coverage'));
  else root.HoopWirePerformance=factory(root.HoopWireCore,root.HoopWireSeason);
})(globalThis,function(C,S){
  'use strict';
  const categories={PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',TO:'turnovers'};
  const threshold=.5;
  const valid=n=>Number.isInteger(n)&&n>=0;
  const average=n=>n>0&&n<.1?String(Number(n.toPrecision(2))):n.toFixed(1);
  function compare(box,baseline){
    if(!valid(baseline?.GP)||baseline.GP===0)return [];
    return Object.entries(categories).flatMap(([key,label])=>{
      if(!valid(box?.[key])||!valid(baseline[key])||baseline[key]===0)return [];
      const difference=box[key]*baseline.GP-baseline[key];
      // Compare unrounded totals, including exactly 50% in either direction.
      const qualifies=Math.abs(difference)>=baseline[key]*threshold;
      const direction=difference>=0?'above':'below';
      return [{key,label,actual:box[key],expected:baseline[key]/baseline.GP,
        change:difference/baseline[key],direction,qualifies,
        favorable:key==='TO'?difference<0:difference>0}];
    });
  }
  function comparisonLine(c){
    return `${c.actual} ${c.label}, compared with a season average of ${average(c.expected)}`;
  }
  function candidates(league){
    const fingerprint=C.buildFingerprint(league),year=C.seasonYear(league),lookup=C.buildLookups(league);
    const snapshots=C.captureSnapshots(league,fingerprint),map=new Map(snapshots.map(s=>[s.id,s])),result=[];
    for(const snap of snapshots){
      if(snap.day!==lookup.latestDay+1)continue;
      const player=lookup.players.get(snap.pid),entry=lookup.completed.find(x=>x.game.gId===snap.gid&&x.dayIndex+1===snap.day);
      if(!player||!entry||snap.stats.DNP>0||Array.isArray(snap.stats.MIN)&&snap.stats.MIN[0]===0)continue;
      const game=entry.game,playoffs=game.tRound>0;
      if(!playoffs&&game.gameType!==0)continue;
      const totals=S.stats(player,league,year,'season');
      if(!totals)continue;
      const baseline={GP:totals.GP-(playoffs?0:1)};
      if(baseline.GP<1)continue;
      for(const key of Object.keys(categories)){
        if(valid(totals[key])&&valid(snap.stats[key])&&(playoffs||totals[key]>=snap.stats[key]))
          baseline[key]=totals[key]-(playoffs?0:snap.stats[key]);
      }
      const comparisons=compare(snap.stats,baseline),changes=comparisons.filter(c=>c.qualifies);
      if(!changes.length)continue;
      // Scoring leads; the other categories follow in the requested order.
      const focus=changes[0],name=C.playerDisplay(player),id=`${fingerprint}:${year}:performance:${snap.gid}:${snap.pid}`;
      const ctx=C.gameContext(game,entry.dayIndex,league,lookup,map,fingerprint);
      const story=C.generateArticle(ctx,fingerprint,false);
      const good=changes.some(c=>c.favorable),poor=changes.some(c=>!c.favorable);
      const descriptions={PTS:['has a big scoring night','has a quiet scoring night'],
        REB:['steps up on the boards','finishes short of the usual rebounding numbers'],
        AST:['adds more assists than usual','has a quiet night for assists'],
        STL:['comes up with more steals than usual','finishes below the usual steals average'],
        TO:['takes better care of the ball','has a rough night with turnovers']};
      Object.assign(story,{id,kind:'performance',type:good&&poor?'Mixed performance':good?'Above expectations':'Below expectations',
        headline:`${name} ${descriptions[focus.key][focus.favorable?0:1]}`,
        playerId:snap.pid,playerName:name,playerStats:structuredClone(snap.stats),coach:null,
        importance:focus.key==='PTS'?90:75,templateVersion:1,quotesEnabled:false,
        performanceSnapshot:{baseline:structuredClone(baseline),comparisons,threshold,source:'season-before-game',
          fingerprint,season:year,gid:snap.gid,day:snap.day,playerId:snap.pid},
        paragraphs:[`${name} ${descriptions[focus.key][focus.favorable?0:1]}, finishing with ${comparisonLine(focus)}.`,
          ...changes.slice(1).map(c=>`${name} also recorded ${comparisonLine(c)}.`),
          `${ctx.winnerName} beat ${ctx.loserName}, ${ctx.winnerScore}-${ctx.loserScore}.`,
          `The comparison uses ${baseline.GP} regular-season ${baseline.GP===1?'appearance':'appearances'} ${playoffs?'before the playoffs':'before this game'}.${baseline.GP<5?' It is still early, so that average can change quickly.':''}`]});
      result.push({story,context:{...ctx,potg:snap.player,potgStats:snap.stats,potgStatsTrusted:true,potgSnapshot:snap,scenePlayer:snap.player}});
    }
    return result.sort((a,b)=>b.story.importance-a.story.importance||a.story.id.localeCompare(b.story.id));
  }
  function script(story){
    const snapshot=story.performanceSnapshot,changes=(snapshot?.comparisons||[]).filter(c=>c.qualifies);
    if(!changes.length)return [];
    const focus=changes[0],name=story.playerName,turns=[],say=(speaker,text)=>turns.push({speaker,text});
    say(0,`Let's talk about ${name}. ${name} finished with ${focus.actual} ${focus.label}; the season average coming in was ${average(focus.expected)}.`);
    say(1,focus.key==='TO'?(focus.favorable?"That's fewer possessions given away. I'll take that kind of improvement.":"That's more possessions given away than usual. You want to bring that back down."):
      focus.favorable?`That's a big step up in ${focus.label}. More than you'd usually get from ${name}.`:
        `That's a quiet night in ${focus.label} by ${name}'s standards. We're used to seeing more.`);
    say(3,snapshot.baseline.GP<5?`That average is from just ${snapshot.baseline.GP} ${snapshot.baseline.GP===1?'game':'games'}. We're still getting a feel for what to expect.`:
      focus.favorable?"It's a good night in that part of the game. Now you'd like to see it happen again.":"One game doesn't make a slump. But it's below what we're used to getting in that part of the game.");
    const secondary=changes.find(c=>c.favorable!==focus.favorable)||changes[1];
    if(secondary){
      say(2,`${secondary.favorable===focus.favorable?'And':'But'} look at the ${secondary.label}, too. ${secondary.actual}, against an average of ${average(secondary.expected)}.`);
      say(1,secondary.favorable===focus.favorable?(secondary.favorable?"Another good part of the night, then.":"So there's more than one thing to improve on next time."):
        secondary.favorable?"That's worth giving credit for, even with the other struggles.":"Fair point. A good night in one area doesn't make those problems disappear.");
    }
    const g=story.gameSummary,w=g.home.score>g.away.score?g.home:g.away,l=w===g.home?g.away:g.home;
    say(0,`${w.name} get the win, ${w.score} to ${l.score}. We'll see how ${name} follows this up.`);
    return turns;
  }
  return {categories,threshold,average,compare,comparisonLine,candidates,script};
});
