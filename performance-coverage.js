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
  const unit={PTS:['point','points'],REB:['rebound','rebounds'],AST:['assist','assists'],STL:['steal','steals'],TO:['turnover','turnovers']};
  // A swing worth a sentence; tiny averages can trigger the threshold without one.
  const swing={PTS:3,REB:2,AST:2,STL:1.5,TO:2};
  function material(c){return Math.abs(c.actual-c.expected)>=swing[c.key];}
  function size(c){
    if(c.actual===0)return 'none';
    const ratio=c.actual/c.expected;
    return ratio>=2.5?'way':ratio>=1.9?'double':ratio>=1.5?'well':ratio<=.4?'fraction':'half';
  }
  function versus(c,he){
    const avg=average(c.expected),label=c.label,word={way:'far beyond',double:'nearly double',well:'well above',fraction:'a fraction of',half:'about half'}[size(c)];
    const owner=he?`${he==='she'?'her':'his'} usual`:'the usual';
    if(c.actual===0)return `when ${he||'the player'} had been averaging ${avg}`;
    return `${word} ${owner} ${avg}`;
  }
  function count(n,key){return C.plural(n,unit[key][0],unit[key][1]);}
  function headline(name,c,opp,seed,bench=false){
    const o=opp.nickname,n=c.actual,up=c.favorable;
    const options={
      PTS:up?(bench?[`${name} scores ${n} off the bench against ${o}`,`${name} sparks bench with ${n} against ${o}`]:[`${name} pours in ${n} against ${o}`,`${name} erupts for ${n} points`,`${name} goes for ${n} against ${o}`]):
        n===0?[`${name} held scoreless against ${o}`,`${name} goes scoreless against ${o}`]:[`Quiet night for ${name}: ${n} points against ${o}`,`${name} limited to ${n} points against ${o}`],
      REB:up?[`${name} owns the glass with ${n} rebounds`,`${name} pulls down ${n} boards against ${o}`]:[`${name} quiet on the boards against ${o}`,`Few rebounds for ${name} against ${o}`],
      AST:up?[`${name} dishes out ${n} assists against ${o}`,`${name} turns playmaker with ${n} assists`]:[`${name} finds few assists against ${o}`,`Passing dries up for ${name} against ${o}`],
      STL:up?[`${name} swipes ${n} steals against ${o}`,`${name} jumps passing lanes for ${n} steals`.replace('jumps passing lanes for','racks up')]:[`${name} comes up short of usual steals against ${o}`],
      TO:up?[`${name} takes care of the ball against ${o}`,`Clean night for ${name} against ${o}`]:[`${name} coughs it up ${n} times against ${o}`,`Turnovers trip up ${name} against ${o}`]
    };
    return C.choose(seed,options[c.key],'performance-headline');
  }
  function article({name,last,he,focus,changes,baseline,playoffs,mine,opp,result,stats,id}){
    const c=focus,in_=`in ${C.possessive(mine.nick)} ${result.score} ${result.won?'win over':'loss to'} ${opp.full}`;
    const what={PTS:c.actual===0?`went scoreless ${in_}`:`scored ${count(c.actual,'PTS')} ${in_}`,
      REB:`grabbed ${count(c.actual,'REB')} ${in_}`,AST:`had ${count(c.actual,'AST')} ${in_}`,
      STL:`had ${count(c.actual,'STL')} ${in_}`,TO:c.actual===0?`didn't commit a turnover ${in_}`:`committed ${count(c.actual,'TO')} ${in_}`}[c.key];
    const lede=`${name} ${what}, ${versus(c,he)} ${c.label} per game.`.replace(`, when ${he||'the player'} had been averaging ${average(c.expected)} ${c.label} per game.`,`, a quiet night for a player who came in averaging ${average(c.expected)} ${c.label}.`).replace(`didn't commit a turnover ${in_}, a quiet night`,`didn't commit a turnover ${in_}, a clean night`);
    const paragraphs=[C.capitalize(lede)];
    const more=changes.slice(1).filter(material);
    if(more.length){
      const mixed=more.filter(x=>x.favorable!==c.favorable),same=more.filter(x=>x.favorable===c.favorable);
      const phrase=x=>`${x.key==='TO'?(x.actual===0?'no turnovers':count(x.actual,'TO')):count(x.actual,x.key)} against an average of ${average(x.expected)}`;
      const subject=he?C.capitalize(he):last;
      if(same.length)paragraphs.push(`${subject} also finished with ${C.listJoin(same.map(phrase))}.`);
      if(mixed.length)paragraphs.push(`${c.favorable?'It wasn\'t all good news':'There was a bright side'}: ${C.listJoin(mixed.map(phrase))}.`);
    }
    const line=['FGM','FGA'].every(k=>Number.isInteger(stats[k]))&&stats.FGA>0&&stats.FGM<=stats.FGA&&c.key==='PTS'?` on ${stats.FGM}-of-${stats.FGA} shooting`:'';
    if(line)paragraphs[0]=paragraphs[0].replace(`scored ${count(c.actual,'PTS')} ${in_}`,`scored ${count(c.actual,'PTS')}${line} ${in_}`);
    const games=C.plural(baseline.GP,'regular-season game');
    paragraphs.push(playoffs?`Those averages come from ${games} before the playoffs.`:
      baseline.GP<5?`It's an early read. Those averages cover just ${games} before this one.`:`Those averages cover ${games} before this one.`);
    return paragraphs;
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
      const comparisons=compare(snap.stats,baseline),qualifying=comparisons.filter(c=>c.qualifies);
      // An editor skips a 0-for-the-night bench line against a 0.5 average:
      // the story needs at least one swing big enough to notice.
      if(!qualifying.some(material))continue;
      // Scoring leads; the other categories follow in the requested order.
      const changes=[qualifying.find(material),...qualifying.filter(c=>c!==qualifying.find(material))],focus=changes[0],name=C.playerDisplay(player),id=`${fingerprint}:${year}:performance:${snap.gid}:${snap.pid}`;
      const ctx=C.gameContext(game,entry.dayIndex,league,lookup,map,fingerprint);
      const story=C.generateArticle(ctx,fingerprint,false);
      const good=changes.some(c=>c.favorable&&material(c)),poor=changes.some(c=>!c.favorable&&material(c));
      const mine=C.teamRef(snap.team),won=game.winner===snap.team.id,oppTeam=lookup.teams.get(game.homeTeam===snap.team.id?game.awayTeam:game.homeTeam),opp=C.teamRef(oppTeam);
      const he=C.pronoun(snap.player),last=player.ln||C.surname(name);
      const outcome={won,score:`${ctx.winnerScore}-${ctx.loserScore}`};
      Object.assign(story,{id,kind:'performance',type:good&&poor?'Mixed performance':good?'Above expectations':'Below expectations',
        headline:headline(name,focus,opp,id,snap.stats.GS===0),
        playerId:snap.pid,playerName:name,playerStats:structuredClone(snap.stats),coach:null,
        importance:focus.key==='PTS'?90:75,templateVersion:1,editorialVersion:2,quotesEnabled:false,
        performanceSnapshot:{baseline:structuredClone(baseline),comparisons,threshold,source:'season-before-game',
          fingerprint,season:year,gid:snap.gid,day:snap.day,playerId:snap.pid,team:{id:snap.team.id,city:snap.team.city,name:snap.team.name},
          opponent:oppTeam?{id:oppTeam.id,city:oppTeam.city,name:oppTeam.name}:null,won,pronoun:he},
        paragraphs:article({name,last,he,focus,changes,baseline,playoffs,mine,opp,result:outcome,stats:snap.stats,id})});
      result.push({story,context:{...ctx,potg:snap.player,potgStats:snap.stats,potgStatsTrusted:true,potgSnapshot:snap,scenePlayer:snap.player}});
    }
    return result.sort((a,b)=>b.story.importance-a.story.importance||a.story.id.localeCompare(b.story.id));
  }
  function script(story,n=['Maya','Jordan','Andre','Nina']){
    const snapshot=story.performanceSnapshot,qualifying=(snapshot?.comparisons||[]).filter(c=>c.qualifies);
    if(!qualifying.length)return [];
    const lead=qualifying.find(material)||qualifying[0],changes=[lead,...qualifying.filter(c=>c!==lead)];
    const pick=(options,role)=>C.choose(story.id||story.headline||'',options,role);
    const focus=changes[0],name=story.playerName,last=C.surname(name),turns=[],say=(speaker,text)=>turns.push({speaker,text});
    const g=story.gameSummary,w=g.home.score>g.away.score?g.home:g.away,l=w===g.home?g.away:g.home;
    const mine=snapshot.team?C.teamRef(snapshot.team):null,opp=snapshot.opponent?C.teamRef(snapshot.opponent):C.teamRef(snapshot.team?.id===w.id?l:w);
    const W=C.teamRef(w),avg=average(focus.expected),up=focus.favorable,early=snapshot.baseline.GP<5;
    const stat=focus.key==='TO'&&focus.actual===0?'zero turnovers':`${focus.actual} ${focus.actual===1?unit[focus.key][0]:unit[focus.key][1]}`;
    say(0,pick([`Let's talk about ${name}. ${C.capitalize(stat)} against ${opp.nick}, and the average coming in was ${avg}. ${n[1]}?`,
      `${name}: ${stat} against ${opp.nick}. Coming in, the average was ${avg}. ${n[1]}, what do you make of it?`,
      `${name} with ${stat}. Normal night is ${avg}. ${n[1]}, go.`],'perf:open'));
    say(1,focus.key==='TO'?(up?pick([`That's grown-up basketball. Take care of the rock, give your team a chance.`,`I love it. No careless giveaways. That's how you earn trust.`],'perf:to-up'):pick([`${focus.actual} turnovers? Come on. You can't give the ball away like that.`,`That's sloppy. ${focus.actual} giveaways, and somebody's going to be looking at the film.`],'perf:to-down')):
      up?pick([`That's what I've been waiting for! ${last} gave ${mine?mine.nick:'them'} way more than usual, and I want to see it again.`,`Breakout night. I don't want to hear about one game. That's a player figuring something out.`,`More of that. That's the kind of night that gets you more minutes.`,
        `Now that's a role player making noise. Somebody give ${last} some love.`,`See, this is why you watch every game. Nights like that come out of nowhere.`,`I'm a fan. That's exactly what ${mine?mine.nick:'that team'} needed from ${last}.`],'perf:up'):
        pick([`That's a dud. ${last} didn't give ${mine?mine.nick:'them'} what they usually get.`,`Rough one. ${last} has to be better than that.`,`Off night. I'm not going to pretend it wasn't.`,`Where was ${last}? ${mine?C.capitalize(mine.nick):'That team'} needed more than that.`,`That one goes straight in the trash. Next game.`],'perf:down'));
    say(3,early?`Easy, ${n[1]}. That average is from ${snapshot.baseline.GP} ${snapshot.baseline.GP===1?'game':'games'}. We're still learning what normal looks like.`:
      up?pick([`It's one game, but it's a real one. ${C.capitalize(stat)} isn't a fluke number.`,`And that's not a small sample. ${snapshot.baseline.GP} games at ${avg} a night, and then this.`],'perf:n-up'):
        pick([`One game doesn't make a slump. ${snapshot.baseline.GP} games say ${last} is better than this.`,`I'd call it noise. ${snapshot.baseline.GP} games at ${avg} tells you more than one bad night.`],'perf:n-down'));
    const secondary=changes.find(c=>c.favorable!==focus.favorable&&material(c))||changes.slice(1).find(material);
    if(secondary){
      const label=secondary.key==='TO'&&secondary.actual===0?'no turnovers':`${secondary.actual} ${secondary.actual===1?unit[secondary.key][0]:unit[secondary.key][1]}`;
      say(2,`${secondary.favorable===focus.favorable?'And':'But'} look at the rest of it, ${n[1]}. ${C.capitalize(label)}, against an average of ${average(secondary.expected)}.`);
      say(1,secondary.favorable===focus.favorable?(secondary.favorable?"So it wasn't just one thing. That's a complete night.":"So it's more than one problem. That's what worries me."):
        secondary.favorable?"Okay, fair. Give credit where it's due.":"Fair point. One good thing doesn't wash out the rest.");
    }
    say(0,pick([`${C.capitalize(W.nick)} won it, ${w.score}-${l.score}. Next topic.`,`Final was ${W.nickname} ${w.score}, ${C.teamRef(l).nickname} ${l.score}. We'll see what ${last} does for an encore.`,`For the record, ${W.nick} won ${w.score}-${l.score}. Moving on.`],'perf:close'));
    return turns;
  }
  return {categories,threshold,average,compare,comparisonLine,candidates,script};
});
