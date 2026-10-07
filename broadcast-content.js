/* Original studio dialogue: lead with the story, use familiar basketball language,
   and let the other hosts respond to a specific fact. Box scores do not prove plays. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./season-coverage'),require('./broadcast-context'),require('./performance-coverage'));
  else root.HoopWireBroadcastContent=factory(root.HoopWireSeason,root.HoopWireBroadcastContext,root.HoopWirePerformance);
})(globalThis,function(Season,Context,Performance){
  'use strict';
  const labels={PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',BLK:'blocks'};
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const turn=(speaker,text)=>({speaker,text});
  function chunkDialogue(text){
    const words=String(text).trim().split(/\s+/).filter(Boolean),chunks=[];
    let part=[];
    for(const word of words){
      if(part.length&&[...part,word].join(' ').length>160){chunks.push(part);part=[];}
      part.push(word);
    }
    if(part.length)chunks.push(part);
    const tail=chunks.at(-1);
    if(chunks.length>1&&(tail.length<5||tail.join(' ').length<40)){
      const pair=chunks.slice(-2).flat();let best=null;
      for(let i=1;i<pair.length;i++){
        const left=pair.slice(0,i),right=pair.slice(i),a=left.join(' ').length,b=right.join(' ').length;
        if(a>160||b>160)continue;
        const shortPenalty=(left.length<5||a<40?1000:0)+(right.length<5||b<40?1000:0);
        const score=shortPenalty+Math.abs(a-b)-(/[.!?][”"']?$/.test(left.at(-1))?24:0);
        if(!best||score<best.score)best={left,right,score};
      }
      if(best)chunks.splice(-2,2,best.left,best.right);
    }
    return chunks.map(words=>words.join(' '));
  }
  const policy=Object.freeze({close:3,blowout:12,upsetGames:5,upsetGap:.15,streak:3,exceptionalPoints:40,averageGames:5,aboveAverage:10});
  const validCount=n=>Number.isInteger(n)&&n>=0;
  function pick(story,options,role=''){
    let hash=2166136261;
    for(const c of `${story.id||story.headline||''}|${role}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
    return options[(hash>>>0)%options.length];
  }
  function join(parts){return parts.length<2?parts.join(''):parts.slice(0,-1).join(', ')+' and '+parts.at(-1);}
  function sentence(text){const s=text.charAt(0).toUpperCase()+text.slice(1);return /[.!?]$/.test(s)?s:s+'.';}
  function rate(s,k){return valid(s?.[k])&&s.GP>0?(s[k]/s.GP).toFixed(1):null;}
  function count(n,label){return `${n} ${n===1?label.replace(/s$/,''):label}`;}
  function shotPair(s,m,a){return validCount(s?.[m])&&validCount(s?.[a])&&s[a]>0&&s[m]<=s[a];}
  function record(r){return Array.isArray(r)&&r.length===2&&r.every(validCount);}
  function preRecord(g,side,won){const r=g?.[side+'Record'];if(!record(r)||r[won?0:1]<1)return null;const pre=[...r];pre[won?0:1]--;return pre;}
  function selectEvidence(story,context={}){
    const g=story.gameSummary;
    if(!g?.home||!g?.away||![g.home.score,g.away.score].every(valid)||g.home.score===g.away.score)return null;
    const homeWon=g.home.score>g.away.score,winner=homeWon?g.home:g.away,loser=homeWon?g.away:g.home;
    const s=story.playerStats||{},archived=(story.paragraphs||[]).map(p=>typeof p==='string'?p.match(/^(.+?) was named player of the game/):null).find(Boolean)?.[1];
    const name=story.playerName||archived;
    const average=context.average?.day===story.day&&context.average?.playerId===story.playerId?context.average:null;
    const doubles=Object.keys(labels).filter(k=>validCount(s[k])&&s[k]>=10);
    const winnerPre=preRecord(context.game,homeWon?'home':'away',true),loserPre=preRecord(context.game,homeWon?'away':'home',false);
    const percentage=r=>r[0]/(r[0]+r[1]);
    const upset=winnerPre&&loserPre&&winnerPre.reduce((a,b)=>a+b)>=policy.upsetGames&&loserPre.reduce((a,b)=>a+b)>=policy.upsetGames&&percentage(loserPre)-percentage(winnerPre)>policy.upsetGap;
    const histories=[winner,loser].map(team=>({team,history:context.teams?.[team.id]}));
    const streak=histories.find(x=>x.history?.streak?.ended?.length>=policy.streak)||histories
      .filter(x=>x.history?.streak?.length>=policy.streak)
      .sort((a,b)=>b.history.streak.length-a.history.streak.length||Number(a.history.streak.won)-Number(b.history.streak.won))[0];
    const ppg=average?.average?.GP>=policy.averageGames?rate(average.average,'PTS'):null;
    const exceptional=name&&(doubles.length>=3||s.PTS>=policy.exceptionalPoints||(ppg!==null&&s.PTS-Number(ppg)>=policy.aboveAverage));
    // Consequences need explicit evidence, never a score or phase number.
    const consequence=context.consequence?.verified===true&&['championship','elimination'].includes(context.consequence.kind)?context.consequence:null;
    return {winner,loser,margin:winner.score-loser.score,name,s,average,ppg,doubles,upset,winnerPre,loserPre,streak,exceptional,consequence};
  }
  function selectAngle(e){
    if(!e)return 'brief';
    if(e.consequence)return e.consequence.kind;
    if(e.upset)return 'upset';
    if(e.streak)return 'streak';
    if(e.exceptional)return 'performance';
    if(e.margin>=policy.blowout)return 'blowout';
    if(e.margin<=policy.close)return 'close';
    return 'routine';
  }
  function gameOpening(story,e,angle){
    const {winner:w,loser:l,name,streak}=e;
    const achievement=e.doubles.length>=3?'a '+(['','','','triple-double','quadruple-double','quintuple-double'][e.doubles.length]):`${e.s.PTS} points`;
    const st=streak?.history.streak;
    const streakLead=st?.ended?`${streak.team.name}'s ${st.ended.length}-game ${st.ended.won?'winning':'losing'} streak is over`:`That's ${st?.length} straight ${st?.won?'wins':'losses'} for ${streak?.team.name}`;
    const leads={
      routine:[`${w.name} pick up another win`,`${w.name} get past ${l.name}`,`This one goes to ${w.name}`,`${w.name} take this one`],
      close:[`Very little between ${w.name} and ${l.name}`,`Only ${e.margin} point${e.margin===1?'':'s'} separated these two`,`A close one goes to ${w.name}`,`${w.name} win, with almost nothing in it`],
      blowout:[`${w.name} leave ${l.name} with plenty to answer for`,`A decisive result for ${w.name}`,`${l.name} finish a long way off the pace`,`${w.name} win convincingly against ${l.name}`],
      upset:[`${w.name} turn the records on their head`,`The surprise here is ${w.name}`,`${l.name} had the stronger record; ${w.name} have the win`,`${w.name} beat a team with a better record`],
      streak:[streakLead,`${streakLead}. That's the story tonight`,`${streakLead}. Let's talk about that`,`${streakLead}. That's where we start`],
      performance:[`${name} finishes with ${achievement}`,`${achievement} for ${name}. Quite a night`,`${name}'s night stands out: ${achievement}`,`Let's start with ${name}: ${achievement}`],
      championship:[`${w.name} have won the championship`,`${w.name} finish the job with a title`,`The championship belongs to ${w.name}`,`${w.name} are champions`],
      elimination:[`${l.name}'s run is over`,`${w.name} end ${l.name}'s run`,`${l.name} have reached the end of the road`,`${w.name} advance; ${l.name} are out`]
    };
    return `${sentence(pick(story,leads[angle],angle+':opening'))} ${w.name} beat ${l.name}, ${w.score} to ${l.score}.`;
  }
  function angleResponse(story,e,angle){
    const {winner:w,loser:l,margin,streak,name}=e,st=streak?.history.streak;
    const options={
      routine:[`They'll take that. Beat ${l.name} by ${margin}, put another win on the board.`,`${w.name} did what they needed to do. Not every win has to be spectacular.`],
      close:[`That's tight. ${l.name} were right there on the scoreboard. I'd take the win, but these teams weren't far apart tonight.`,`A ${margin}-point win? You take it. I don't think ${l.name} come away feeling like they're miles behind, though.`],
      blowout:[`${margin} points. That's a rough night for ${l.name}, however you look at it.`,`I want to start with ${w.name}. We can talk about what went wrong for ${l.name}, but winning by ${margin} deserves some credit first.`],
      upset:[`${w.name} came in ${e.winnerPre?.[0]}-${e.winnerPre?.[1]}. ${l.name} were ${e.loserPre?.[0]}-${e.loserPre?.[1]}. I wouldn't have picked this one on those records.`,`That's a good win. ${l.name} had the better record coming in, and ${w.name} beat them anyway.`],
      streak:st?.ended?[`For ${streak?.team.name}, that ends ${st?.ended.length} straight ${st?.ended.won?'wins':'losses'}. ${st?.ended.won?"They had a good run. They couldn't add to it tonight.":"Finally, a win. They needed that."}`,st?.ended.won?"I'm not throwing out all those wins over one loss. But you want to get back to winning before this turns into a different kind of streak.":"Finally. Enjoy this one, then try to get another. They needed something to build on."]:[`${streak?.team.name} keep adding to it. ${st?.won?"Win again, and people start paying attention.":"They need a win. Hard to look much further than that right now."}`,st?.won?"At some point you've got to give them credit. It's hard enough to win once, and they keep doing it.":"Another loss. That's getting tough to talk around. You just want to see them get one."],
      performance:[`${name} earned that attention. ${e.doubles.length>=3?"And it wasn't just the points. Look at the rest of that line.":"That's a lot of points. Let's look at how the rest of the night went."}`,`I want to talk about ${name}, too. ${e.doubles.length>=3?"There's a little of everything in that performance.":"You don't see that kind of scoring every night."}`],
      championship:[`${w.name} are going home with the trophy. That's what all of this was for.`,`There it is. ${w.name} are champions. You spend the whole season trying to get to this point.`],
      elimination:[`That's the hard part for ${l.name}. There's no next game to put this behind them.`,`${w.name} get to keep going. For ${l.name}, that's it. A tough way to finish.`]
    };
    return pick(story,options[angle],angle+':judgment');
  }
  function gameClosing(story,e,angle){
    const w=e.winner.name,l=e.loser.name;
    const options={
      routine:[`${w} take this one.`,`Another win for ${w}.`,`${w} get the win tonight.`,`${l} will want a better result next time.`],
      close:[`Not much between them tonight.`,`Close, but it goes to ${w}.`,`A close one. ${w} take it.`,`${w} get the win. ${l} weren't far off.`],
      blowout:[`${l} need a better performance to put this one behind them.`,`${w} have set a standard they'll want to meet again.`,`A tough night for ${l}.`,`A big win for ${w}.`],
      upset:[`Maybe we need to give ${w} a little more attention.`,`${w} gave us a surprise tonight.`,`Good win for ${w}. We'll keep an eye on them.`,`Now let's see if ${w} can get another.`],
      streak:[`We'll see where they go from here.`,`That gives us something to watch next time out.`,`We'll keep following that run.`,`That's where things stand tonight.`],
      performance:[`Quite a night for ${e.name}.`,`${e.name} gets the headline. ${w} get the win.`,`Plenty to like from ${e.name} tonight.`,`A night worth remembering for ${e.name}.`],
      championship:[`For now, this moment belongs to the champions.`,`The offseason questions can wait. This is a title worth celebrating.`,`They've earned the celebration before the next challenge begins.`,`A championship is the ending every team wanted. This one belongs to ${w}.`],
      elimination:[`${l} are out. That's a tough finish.`,`${w} move on. ${l} are done.`,`No more games for ${l} in this run.`,`That's where it ends for ${l}.`]
    };
    return pick(story,options[angle],angle+':closing');
  }
  function supportingThreads(e,angle){
    const s=e.s,n=e.name,threads=[];
    if(e.streak&&angle!=='streak'){
      const st=e.streak.history.streak,team=e.streak.team.name;
      threads.push({key:'continuity',priority:95,speaker:3,
        question:`And what does that do to the streak?`,
        detail:st.ended?`${team}'s ${st.ended.length}-game ${st.ended.won?'winning':'losing'} streak ends here. ${st.ended.won?"They were on a good run. One loss doesn't undo that.":"They finally get one. It's been a while."}`:
          `It's ${st.length} straight ${st.won?'wins':'losses'} for ${team}. ${st.won?"They keep getting the win. I like that.":"That's a difficult stretch. They need a win."}`,
        response:st.ended?"Now I'm interested in the next game. Do they go back to what we were seeing, or is this the start of something different?":st.won?"And they deserve credit for that. It gets harder to call it one good night when they keep winning.":"You just want that next win. Hard to talk about much else until they get it."});
    }
    if(!e.name)return threads;
    if(shotPair(s,'FGM','FGA')&&s.FGA>=4){
      const pct=s.FGM/s.FGA,poor=pct<=.334,strong=pct>=.6;
      threads.push({key:'shooting',priority:poor?100:strong?85:50,speaker:3,
        question:validCount(s.PTS)?`${s.PTS} points for ${n}. How was the shooting?`:`How was ${n} shooting it?`,
        detail:`${n} went ${s.FGM} for ${s.FGA} from the field. ${poor?"That's a rough shooting night. You miss that many, the points only tell part of it.":strong?"That's efficient scoring. Not many wasted shots there.":"Not a huge shooting night, but not one I'd single out as a problem either."}`,
        response:poor?"That's what gives me pause. I can't just look at the points and call it a great night with that many misses.":strong?"That's what I like. You don't need to keep piling up shots to put points on the board.":"Right. I'd look at what else came with it before getting too high or too low on the night."});
    }
    if(validCount(s.TO)&&(s.TO>=4||(s.TO===0&&s.PTS>=20)||(s.AST>=5&&s.AST>s.TO))){
      threads.push({key:'security',priority:s.TO>=4?95:65,speaker:2,
        question:`Did ${n} take care of the ball?`,
        detail:s.TO===0?`${n} had no turnovers. I like that alongside the points. No possessions given away.`:`${n} had ${s.TO} turnovers${validCount(s.AST)?` against ${s.AST} assists`:''}. ${s.TO>=4?"That's more mistakes than you'd want.":"I'll take that balance."}`,
        response:s.TO>=4?(s.AST>s.TO?`The ${s.AST} assists help balance it out, but I'd still want fewer turnovers.`:"Too many possessions given away. You can like the good parts and still want those mistakes cleaned up."):"Right. The points get noticed first, but taking care of the ball helps everybody."});
    }
    if(e.ppg!==null){
      const delta=s.PTS-Number(e.ppg);
      if(validCount(s.PTS))threads.push({key:'average',priority:Math.abs(delta)>=10?90:55,speaker:3,
        question:`Where's ${n}'s scoring average right now?`,
        detail:`${n} is averaging ${e.ppg} points a game ${e.average.period==='playoffs'?'in the playoffs':'in the regular season'}. ${Math.abs(delta)<3?"So tonight's pretty close to the usual scoring.":delta>0?"Tonight was above that.":"Tonight was below that."}`,
        response:Math.abs(delta)<3?"That's why this doesn't surprise me much. We're used to getting that kind of scoring now.":delta>0?"I'll enjoy this one. I'm not asking for it every night, but you'll take it when it comes.":"A quieter night, then. I'd still expect more based on what's been happening this season."});
    }
    const contribution=['AST','REB','BLK','STL'].filter(k=>validCount(s[k])&&s[k]>=({AST:3,REB:5,BLK:2,STL:2}[k])).sort((a,b)=>s[b]-s[a])[0];
    // A scoring-only follow-up repeats the shooting discussion. Keep it when
    // it's the main story, or when we have another contribution to discuss.
    if(contribution||(validCount(s.PTS)&&(angle==='performance'||!threads.some(t=>t.key==='shooting')))){
      const stats=e.doubles.length>=3?e.doubles.map(k=>count(s[k],labels[k])):
        [validCount(s.PTS)?count(s.PTS,'points'):null,contribution?count(s[contribution],labels[contribution]):null].filter(Boolean);
      threads.push({key:'contribution',priority:angle==='performance'?110:75,speaker:2,
        question:`What stood out to you about ${n}?`,
        detail:`${n} finished with ${join(stats)}. ${contribution==='AST'?"I like the passing in there, too.":contribution==='REB'?"Don't skip over those rebounds.":contribution?"That's something at the defensive end, too.":s.PTS===0?"Couldn't add anything in the scoring column.":"That's where I'd start with the individual numbers."}`,
        response:e.doubles.length>=2?`That's a ${['','','double-double','triple-double','quadruple-double','quintuple-double'][e.doubles.length]}. ${e.doubles.includes('AST')?"And those assists mean somebody else is getting baskets, too.":"That's doing more than putting up points."}`:contribution==='AST'?"Right. Those assists mean somebody else is getting a basket out of that passing.":contribution==='REB'?`Yes, ${s.REB} rebounds deserve a mention. You want that work alongside the scoring.`:contribution?`The ${count(s[contribution],labels[contribution])} stand out to me, too.`:s.PTS===0?"Right. You'd have to find the contribution somewhere else tonight.":shotPair(s,'FGM','FGA')?"How many shots did it take to get there? That's the other part I want to look at.":"That's the scoring total. Without the shooting numbers, it's hard to say much more about how the night went."});
    }
    return threads.sort((a,b)=>b.priority-a.priority).slice(0,2);
  }
  function gameScript(story,context={}){
    const e=selectEvidence(story,context);if(!e)return genericScript(story);
    const angle=selectAngle(e),turns=[turn(0,gameOpening(story,e,angle)),turn(1,angleResponse(story,e,angle))];
    for(const [index,thread] of supportingThreads(e,angle).entries()){
      // Pick up the performance opening directly instead of asking the same
      // question again. Maya returns when the subject changes.
      const question=index&&thread.key==='shooting'?`And how was the shooting?`:
        index&&thread.key==='contribution'?`What else did ${e.name} give them?`:thread.question;
      if(index||angle!=='performance')turns.push(turn(0,question));
      turns.push(turn(thread.speaker,thread.detail),turn(thread.speaker===2?1:2,thread.response));
      // Develop the same shooting thread with new evidence when a major story
      // warrants a second pass. This is not a third statistical checklist.
      if(['championship','elimination','upset','streak','performance'].includes(angle)&&thread.key==='shooting'&&
        shotPair(e.s,'TPM','TPA')&&e.s.TPA>=4&&e.s.TPA<=e.s.FGA&&e.s.TPM<=e.s.FGM){
        turns.push(turn(0,`How much of that was from three?`),
          turn(3,`${e.name} went ${e.s.TPM} for ${e.s.TPA} from three. ${e.s.TPM===0?"None of the makes came from outside.":e.s.TPM/e.s.TPA>=.4?"Good night from out there.":"The threes weren't falling as often as you'd want."}`));
      }
    }
    turns.push(turn(0,gameClosing(story,e,angle)));return turns;
  }
  function featuredStats(story){return Season.featuredStatsForStory(story);}
  function teamRecords(story){return (story.seasonSnapshot?.teamRecords||[]).map(x=>({
    name:(story.relatedTeams||[]).find(t=>t.id===x.teamId)?.name,r:x.record?.seasonStats||x.record
  })).filter(x=>x.name&&validCount(x.r?.W)&&validCount(x.r?.L));}
  function frame(story,kind,openings,closings,body){
    return [turn(0,pick(story,openings,kind+':opening')),...body,turn(0,pick(story,closings,kind+':closing'))];
  }
  function awardScript(story){
    const row=story.seasonSnapshot?.rows?.[0],p=story.seasonSnapshot?.featuredPlayer;
    const name=p?.name||row?.[1]||String(story.headline).split(' wins ')[0],award=row?.[0]||String(story.headline).split(' wins ').slice(1).join(' wins ')||'the award';
    const s=featuredStats(story),body=Season.honorLines(story).slice(0,2).map(text=>turn(1,text));
    const categories=/defens/i.test(award)?['BLK','STL']:['PTS','AST'];
    const values=categories.filter(k=>rate(s,k)!==null);
    if(s?.GP>0&&values.length){
      const postseason=story.statsPeriod==='finals'||story.statsPeriod==='playoffs'||story.seasonSnapshot?.tables?.some(t=>t.label==='Playoff player statistics');
      body.push(turn(2,`${name} averaged ${join(values.map(k=>`${rate(s,k)} ${labels[k]}`))} a game${postseason?' in the postseason':''}. ${/defens/i.test(award)?"Those steals and blocks give you an idea of why the award went this way.":"You can see why that got noticed."}`));
      body.push(turn(0,`And how many games are we talking about?`));
      body.push(turn(3,`It's over ${s.GP} game${s.GP===1?'':'s'}. ${s.GP===1?"Just the one game in those numbers.":"That's the average across all of them."}`));
      if(rate(s,'MIN')!==null)body.push(turn(2,`${rate(s,'MIN')} minutes a game, too. That's how much time it took to put up those numbers.`));
      body.push(turn(1,"That's a lot to like. Let the player enjoy the award; we can talk about next season when it gets here."));
    }
    return frame(story,'award',[`${name} wins ${award}. The recognition is official.`,`${award} belongs to ${name}.`,`The award goes to ${name}: ${award}.`,`A moment of recognition for ${name}, the ${award} winner.`],
      [`Enjoy it, ${name}. An award to be proud of.`,`An award worth celebrating before attention turns to what's next.`,`That's recognition for the work already done.`,`Congratulations to ${name}. Now there's another achievement on the record.`],body);
  }
  function playoffScript(story){
    const rows=story.seasonSnapshot?.rows||[];if(!rows.length)return genericScript(story);
    const teams=teamRecords(story),round=Number(String(story.eventKey||'').split('-').at(-1));
    const paired=rows.map(row=>({row,a:teams.find(t=>t.name===row[0]),b:teams.find(t=>t.name===row[1])}));
    const pair=paired.filter(x=>x.a&&x.b).sort((a,b)=>Math.abs(a.a.r.W-a.b.r.W)-Math.abs(b.a.r.W-b.b.r.W))[0]||paired[0];
    const {row,a,b}=pair,body=[turn(1,`${row[0]} against ${row[1]}. ${row[2]==='Single elimination'?"It's win or go home. There's no Game 2 to answer a loss.":/^Best of \d+$/.test(row[2])?`${row[2]}. You have time to recover from a bad game. That changes things.`:"I'm interested to see how those two match up."}`)];
    if(a&&b){
      const gap=Math.abs(a.r.W-b.r.W);
      body.push(turn(2,`${a.name} finished ${a.r.W}-${a.r.L}; ${b.name}, ${b.r.W}-${b.r.L}. ${gap===0?"They have the same number of wins. Hard to pick a favorite from that.":`There's a ${gap}-win difference. Not enough on its own to make me call the series.`}`));
      const offense=rate(a.r,'PTS'),allowed=rate(b.r,'OPP');
      if(offense!==null&&allowed!==null){
        body.push(turn(0,`What about the scoring?`));
        body.push(turn(3,`${a.name} score ${offense} points a game; ${b.name} allow ${allowed}. That's the scoring matchup I'm interested in.`));
        body.push(turn(1,"Can they score at their usual rate against this defense? That's what I want to see."));
      }
      body.push(turn(2,row[2]==='Single elimination'?"And they get one chance at it. Have a bad night and you're going home.":"I'd like to see the first game before picking a side. We'll have a lot more to talk about then."));
    }
    return frame(story,'playoff',[`${round>1?`Round ${round}`:'The playoffs'} bring ${rows.length} ${rows.length===1?'matchup':'matchups'} to the desk.`,`The stakes change with ${round>1?`Round ${round}`:'the playoffs'}. Let's look at the matchups.`,`${round>1?`Round ${round}`:'The playoff field'} gives us ${rows.length} ${rows.length===1?'matchup':'matchups'} to consider.`,`Time to look ahead to ${round>1?`Round ${round}`:'the playoffs'}.`],
      ["The matchups are set. Let's see how they go.","We'll be watching when they get started.","I'm looking forward to this round.","We'll come back to this after they play."],body);
  }
  function championshipScript(story){
    const row=story.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.relatedTeams?.[0]?.name;
    if(!champ)return genericScript(story);
    const body=Season.honorLines(story).slice(0,2).map(text=>turn(1,text)),team=teamRecords(story).find(t=>t.name===champ);
    if(row[1]&&row[1]!=='Not available')body.push(turn(1,`${champ} beat ${row[1]} for the title. That's the one they'll remember.`));
    if(team){
      body.push(turn(0,`What kind of regular season did ${champ} have?`));
      body.push(turn(2,`They went ${team.r.W}-${team.r.L} in the regular season. And now they've got a championship to go with it.`));
      const ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP');
      if(ppg!==null&&opp!==null)body.push(turn(3,`${ppg} points scored and ${opp} allowed a game in the regular season. Those were their averages coming into the playoffs.`));
      body.push(turn(1,"And they finished with the trophy. Every other team would love to trade places with them right now."));
    }
    return frame(story,'championship',[`${champ} are champions. That's the headline tonight.`,`${champ} finish the season with a championship.`,`The title belongs to ${champ}.`,`A championship for ${champ}. Time to give them their moment.`],
      [`Enjoy this one, ${champ} fans. The next challenge can wait.`,"There will be offseason questions. Tonight belongs to the champions.","They've earned the celebration before anyone asks them to do it again.","A title gives this season its ending. What follows is another story."],body);
  }
  function seasonScript(story){
    const teams=teamRecords(story).sort((a,b)=>b.r.W-a.r.W||a.r.L-b.r.L);if(!teams.length)return genericScript(story);
    const team=teams[0],ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP'),gap=ppg!==null&&opp!==null?(team.r.PTS-team.r.OPP)/team.r.GP:null;
    const body=[turn(1,`${team.name} finish ${team.r.W}-${team.r.L}. ${team.r.W>team.r.L?"More wins than losses. That's something to build on.":team.r.W<team.r.L?"Too many losses. They'll want better than that.":"Right in the middle. Some good nights, some bad ones."}`)];
    if(gap!==null){
      body.push(turn(0,`Were ${team.name} outscoring teams over the season?`));
      body.push(turn(3,`${ppg} points a game, against ${opp} allowed. That's a ${Math.abs(gap).toFixed(1)}-point scoring margin ${gap>=0?'in their favor':'against them'}. ${gap>0?"They were scoring more than they gave up.":gap<0?"They were giving up more than they scored.":"Almost nothing between what they scored and what they allowed."}`));
      body.push(turn(2,gap>0?"That's a good place to start. You want to be on that side of the scoring gap.":"That's where I'd start, too. Can you find a few more points, or give up a few less?"));
    }
    const table=story.seasonSnapshot?.tables?.find(t=>t.label==='Regular-season player statistics');
    const scorer=[...(table?.rows||[])].filter(r=>r[2]!==null&&r[2]!==''&&r[2]!=='—'&&Number.isFinite(Number(r[2]))).sort((a,b)=>Number(b[2])-Number(a[2]))[0];
    if(scorer){
      body.push(turn(0,`Who led the scoring?`));
      body.push(turn(2,`${scorer[0]} led their scoring at ${Number(scorer[2]).toFixed(1)} points a game. That's who they got the most scoring from.`));
      body.push(turn(1,"And you need help around your leading scorer. One player can't do all the scoring."));
    }else if(story.type==='Regular-season review'&&teams[1]){
      const other=teams[1];body.push(turn(1,`${other.name} finish ${other.r.W}-${other.r.L}. ${team.r.W===other.r.W&&team.r.L===other.r.L?"Same record. Not much to separate them there.":"Another team to keep in mind when we look back at this season."}`));
    }
    const verdict=team.r.W>team.r.L?'a winning season':team.r.W<team.r.L?'a losing season':'an even record';
    return frame(story,'season',[`${team.name} finish with ${verdict}. Let's look at the numbers.`,`${verdict.charAt(0).toUpperCase()+verdict.slice(1)} for ${team.name}. Now let's look at what sits behind it.`,`${team.name}'s regular season ends with ${verdict}.`,`${team.name} have ${verdict} to look back on. What should they take from it?`],
      ["They'll want more wins next season.","That's how their season finished.","We'll see what they do with that next season.","Now it's about finding a way to win more games."],body);
  }
  function leadersScript(story){
    const rows=(story.seasonSnapshot?.rows||[]).filter(r=>labels[r[0]]&&valid(r[2])&&r[3]>0);
    if(!rows.length)return genericScript(story);
    const categories=[...new Set(rows.map(r=>r[0]))].slice(0,2),body=[];
    for(const [i,k] of categories.entries()){
      const tied=rows.filter(r=>r[0]===k),names=join(tied.map(r=>r[1])),value=(tied[0][2]/tied[0][3]).toFixed(1);
      if(i)body.push(turn(0,`And who stands out when we look beyond ${labels[categories[0]]}?`));
      body.push(turn(i?2:1,`${names} ${tied.length===1?'leads':'share the lead'} in ${labels[k]} at ${value} a game. ${k==='PTS'?"That's the average, not just one big game.":"There's more to a good season than scoring."}`));
      const honor=(story.seasonSnapshot.leaderHonors||[]).find(h=>h.category===k&&tied.some(r=>h.name===r[1]));
      if(honor)for(const line of Season.honorLines({...story,seasonSnapshot:{...story.seasonSnapshot,honorHistory:honor}}).slice(0,1))body.push(turn(2,line));
      body.push(turn(3,i?`${tied.length>1?"They share that one.":"Good season in that category, too."} ${k==='REB'?"You need somebody to get those rebounds, too.":"Different players bring different things. You need that."}`:
        `${tied.length>1?"Can't leave either name out. They share the lead.":`That average comes over ${tied[0][3]} games.`} That's worth a mention.`));
    }
    const first=rows.filter(r=>r[0]===categories[0]),lead=join(first.map(r=>r[1])),category=labels[categories[0]];
    return frame(story,'leaders',[`${lead} ${first.length>1?'share the lead':'is the leader'} in ${category}. That's where we start.`,`${category.charAt(0).toUpperCase()+category.slice(1)} honors ${first.length>1?'are shared by':'go to'} ${lead}.`,`Give ${lead} the spotlight ${first.length>1?'as joint leaders':'as the leader'} in ${category}.`,`${lead} ${first.length>1?'finish together at':'finishes at'} the top in ${category}.`],
      ["Those are the names at the top.","There's more than one way to leave a mark on a season.","Those performances deserve attention beyond a single game.","Good seasons from the leaders."],body);
  }
  function genericScript(story){
    const headline=sentence(String(story.headline||'More news from around the league'));
    const paragraphs=(story.paragraphs||[]).filter(p=>typeof p==='string'&&!/[“”"]/.test(p)&&p!==story.headline&&p.length<=240);
    const detail=paragraphs.find(p=>!p.startsWith(String(story.headline)));
    const openings=[headline,`Around the league: ${headline}`,`A development to follow. ${headline}`,`Here's the latest. ${headline}`];
    const type=story.type||'';
    const closings=/trade request/i.test(type)?["Asking for a trade is one thing. Now they have to find a deal.","Now the question is how the team responds to the request.","No deal yet. We'll see how the team handles the request.","Now we wait to see whether a trade happens."]:
      /draft declaration/i.test(type)?["Now we wait to see which team makes the pick.","The declaration is official. The selection comes later.","Now the attention turns to where that next opportunity will be.","We'll be watching on draft day."]:
      /injury return/i.test(type)?["Good to have another player available.","Now let's see how the return goes.","Now the attention turns from recovery to playing again.","That gives the team another option."]:
      /injury/i.test(type)?["That's an absence the team will have to account for.","The next update on availability is the one to follow.","For now, the team has an absence to manage.","We'll watch for an update on the return."]:
      /trade|sign|draft|commit|option|extend/i.test(type)?["We'll see how that works out for the team.","Something to watch when they get on the floor.","Now we'll see what that decision means for the team.","We'll see how it goes."]:
      /retir|hall|jersey/i.test(type)?["That deserves a moment before we move on.","That achievement deserves its place in the league's history.","A good time to look back at that career.","There's a career story here that deserves its own moment."]:
      ["We'll keep an eye on that.","We'll come back to it when there's more to report.","We'll see what happens next.","Something to keep an eye on around the league."];
    return frame(story,'brief',openings,closings,detail?[turn(2,detail)]:[]);
  }
  function reportedReaction(story){
    if(!story.quotesEnabled||!story.templateVersion)return [];
    const quotes=(story.paragraphs||[]).flatMap(p=>typeof p==='string'?[...p.matchAll(/[“"]([^”"]+)[”"]\s+([^.!?]+?) said\./g)]:[]).filter(q=>q[1].length<=240);
    const q=quotes.find(q=>q[2].startsWith('head coach '))||quotes[0];if(!q)return [];
    const attribution=q[2].replace(/^head coach /,'');
    const response=/consisten/i.test(q[1])?"Consistency. That's the challenge: doing it again next game, and the game after that.":/champion|title|finish the job/i.test(q[1])?"That's a championship reaction I can understand. Let them enjoy it.":/responsib|not good enough|higher|better/i.test(q[1])?"That's fair. Now you want to see it in the next game. Saying it is the easy part.":null;
    return response?[turn(0,`${q[2].startsWith('head coach ')?'Coach ':''}${attribution} put it this way: “${q[1]}”`),turn(2,response)]:[];
  }
  function baseScript(story,context){
    if(story.performanceSnapshot)return Performance.script(story);
    if(story.type==='Season leaders')return leadersScript(story);
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return awardScript(story);
    if(story.type==='Playoff preview'||story.eventKey?.startsWith('playoff-round-'))return playoffScript(story);
    if(story.type==='Championship review'||story.eventKey==='championship')return championshipScript(story);
    if(story.gameSummary)return gameScript(story,context);
    if(['Team season review','Regular-season review'].includes(story.type))return seasonScript(story);
    return genericScript(story);
  }
  function script(story,context){
    if(!story)return [];
    context||=Context.buildContext(story);
    const turns=baseScript(story,context),reaction=reportedReaction(story),budget=turns.length<=4?4:14;
    if(reaction.length&&turns.length+reaction.length<=budget)turns.splice(turns.length-1,0,...reaction);
    return turns;
  }
  function episode(story,names=['Maya Brooks','Jordan Price','Andre Cole','Nina Reyes'],context){
    if(!story)return [];
    return [
      turn(0,`Welcome to HoopWire TV! I'm ${names[0]}, and this is The Daily Desk.`),
      turn(1,`I'm ${names[1]}. Glad you're with us.`),turn(2,`And I'm ${names[2]}.`),turn(3,`I'm ${names[3]}. Let's get to the news.`),
      ...script(story,context),
      turn(0,"That wraps up today's show. Thanks for joining us at The Daily Desk."),
      turn(3,"Thanks for spending some time with us."),
      turn(0,`For ${names[1]}, ${names[2]} and ${names[3]}, I'm ${names[0]}. Thanks for watching HoopWire TV. We'll see you next time!`)
    ];
  }
  return {script,episode,chunkDialogue,selectEvidence,selectAngle,supportingThreads,policy,awardScript,playoffScript,championshipScript,gameScript,genericScript,seasonScript,leadersScript};
});
