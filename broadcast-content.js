/* The Daily Desk: a debate show, not a box-score readout. Maya runs the room,
   Jordan brings the take, Andre sees the whole floor and Nina checks the math.
   Every opinion rests on a verified number; box scores never prove a play. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./core'),require('./season-coverage'),require('./broadcast-context'),require('./performance-coverage'));
  else root.HoopWireBroadcastContent=factory(root.HoopWireCore,root.HoopWireSeason,root.HoopWireBroadcastContext,root.HoopWirePerformance);
})(globalThis,function(C,Season,Context,Performance){
  'use strict';
  const labels={PTS:'points',REB:'rebounds',AST:'assists',STL:'steals',BLK:'blocks'};
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  const turn=(speaker,text)=>({speaker,text});
  const defaultNames=['Maya Brooks','Jordan Price','Andre Cole','Nina Reyes'];
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
  // Thresholds are written for a full-length pro game and scaled to the
  // scoring in front of us, so a 9-point night in a 25-point game still lands.
  const policy=Object.freeze({close:3,blowout:12,upsetGames:5,upsetGap:.15,streak:3,exceptionalPoints:40,averageGames:5,aboveAverage:10,fullGame:200});
  const validCount=n=>Number.isInteger(n)&&n>=0;
  function pick(story,options,role=''){
    let hash=2166136261;
    for(const c of `${story.id||story.headline||''}|${role}`)hash=Math.imul(hash^c.charCodeAt(0),16777619);
    return options[(hash>>>0)%options.length];
  }
  const join=C.listJoin,cap=C.capitalize;
  function sentence(text){const s=cap(String(text));return /[.!?]$/.test(s)?s:s+'.';}
  function rate(s,k){return valid(s?.[k])&&s.GP>0?(s[k]/s.GP).toFixed(1):null;}
  function count(n,label){return `${n} ${n===1?label.replace(/s$/,''):label}`;}
  function shotPair(s,m,a){return validCount(s?.[m])&&validCount(s?.[a])&&s[a]>0&&s[m]<=s[a];}
  function record(r){return Array.isArray(r)&&r.length===2&&r.every(validCount);}
  function preRecord(g,side,won){const r=g?.[side+'Record'];if(!record(r)||r[won?0:1]<1)return null;const pre=[...r];pre[won?0:1]--;return pre;}
  function fraction(x){return x>=.5?'more than half':x>=.45?'almost half':x>=.33?'more than a third':x>=.3?'almost a third':x>=.25?'a quarter':null;}
  function first(names){return (names||defaultNames).map(n=>String(n).split(/\s+/)[0]);}
  const kinds=['','','double-double','triple-double','quadruple-double','quintuple-double'];
  function selectEvidence(story,context={}){
    const g=story.gameSummary;
    if(!g?.home||!g?.away||![g.home.score,g.away.score].every(valid)||g.home.score===g.away.score)return null;
    const homeWon=g.home.score>g.away.score,winner=homeWon?g.home:g.away,loser=homeWon?g.away:g.home;
    const s=story.playerStats||{},archived=(story.paragraphs||[]).map(p=>typeof p==='string'?p.match(/^(.+?) was named player of the game/):null).find(Boolean)?.[1];
    const name=story.playerName||archived;
    const snaps=(context.snapshots||[]).filter(x=>x?.team&&C.validStats(x.stats));
    const ref=side=>C.teamRef(snaps.find(x=>x.team.id===side.id)?.team||side);
    const W=ref(winner),L=ref(loser),me=snaps.find(x=>x.pid===story.playerId);
    const box=snaps.map(x=>({pid:x.pid,tid:x.team.id,name:C.playerDisplay(x.player),last:x.player?.ln||C.surname(C.playerDisplay(x.player)),stats:x.stats}));
    const average=context.average?.day===story.day&&context.average?.playerId===story.playerId?context.average:null;
    const doubles=Object.keys(labels).filter(k=>validCount(s[k])&&s[k]>=10);
    const F=story.facts?.version>=1?story.facts:null,series=F?.series||null;
    // Playoff games carry series records, so season comparisons come from the facts.
    const playoffGame=F?F.playoffs:context.game?.tRound>0;
    const winnerPre=F?(record(F.records?.[winner.id]?.pre)?F.records[winner.id].pre:null):playoffGame?null:preRecord(context.game,homeWon?'home':'away',true);
    const loserPre=F?(record(F.records?.[loser.id]?.pre)?F.records[loser.id].pre:null):playoffGame?null:preRecord(context.game,homeWon?'away':'home',false);
    const percentage=r=>r[0]/(r[0]+r[1]);
    const upset=!playoffGame&&winnerPre&&loserPre&&winnerPre.reduce((a,b)=>a+b)>=policy.upsetGames&&loserPre.reduce((a,b)=>a+b)>=policy.upsetGames&&percentage(loserPre)-percentage(winnerPre)>policy.upsetGap;
    const fromFacts=id=>{const f=F?.form?.[id];return f?{streak:f.ended?{won:f.streak.won,length:1,ended:f.ended}:f.streak,recent:[]}:null;};
    const histories=[winner,loser].map(team=>({team,ref:team===winner?W:L,history:F?fromFacts(team.id):playoffGame?null:context.teams?.[team.id]}));
    const streak=histories.find(x=>x.history?.streak?.ended?.length>=policy.streak)||histories
      .filter(x=>x.history?.streak?.length>=policy.streak)
      .sort((a,b)=>b.history.streak.length-a.history.streak.length||Number(a.history.streak.won)-Number(b.history.streak.won))[0];
    const scale=Math.min(1,Math.max(.15,(winner.score+loser.score)/policy.fullGame));
    const ppg=average?.average?.GP>=policy.averageGames?rate(average.average,'PTS'):null;
    // Share of the scoring needs to know which side the player was on.
    const side=me?(me.team.id===winner.id?'winner':me.team.id===loser.id?'loser':null):null;
    const teamScore=side==='winner'?winner.score:side==='loser'?loser.score:null;
    const share=validCount(s.PTS)&&teamScore>0?s.PTS/teamScore:null;
    // With a known average, exceptional means exceptional for this player.
    const aboveNorm=ppg!==null&&s.PTS-Number(ppg)>=Math.max(3,policy.aboveAverage*scale);
    const exceptional=!!name&&(doubles.length>=3||aboveNorm||ppg===null&&(s.PTS>=Math.max(8,policy.exceptionalPoints*scale)||(share!==null&&share>=.45&&s.PTS>=6)));
    // Consequences need explicit evidence, never a score or phase number.
    const consequence=series?.title?{kind:'championship',verified:true}:context.consequence?.verified===true&&['championship','elimination'].includes(context.consequence.kind)?context.consequence:null;
    const player=name?{full:name,last:me?.player?.ln||C.surname(name),he:C.pronoun(me?.player)}:null;
    return {story,series,facts:F,winner,loser,W,L,margin:winner.score-loser.score,name,player,s,average,ppg,doubles,upset,winnerPre,loserPre,streak,exceptional,consequence,box,side,share,teamScore,scale};
  }
  function selectAngle(e){
    if(!e)return 'brief';
    if(e.consequence)return e.consequence.kind;
    if(e.series)return e.series.clinched?'clinch':'series';
    if(e.upset)return 'upset';
    // A huge individual night outranks a streak; a long streak outranks a big margin.
    const run=e.streak?.history.streak,long=run&&(run.ended?.length>=5||run.length>=5);
    if(e.exceptional)return 'performance';
    if(long)return 'streak';
    if(e.margin>=policy.blowout*2*Math.max(e.scale,.5))return 'blowout';
    if(e.streak)return 'streak';
    if(e.margin>=policy.blowout)return 'blowout';
    if(e.margin<=policy.close)return 'close';
    return 'routine';
  }
  const rec=r=>record(r)?`${r[0]}-${r[1]}`:'';
  function achievement(e){
    const s=e.s;
    // Broadcast shorthand: "a 28-point, 10-rebound, 11-assist triple-double".
    if(e.doubles.length>=3)return `a ${e.doubles.map(k=>`${s[k]}-${labels[k].replace(/s$/,'')}`).join(', ')} ${kinds[e.doubles.length]}`;
    if(e.doubles.length===2)return `${join(e.doubles.map(k=>count(s[k],labels[k])))}`;
    return count(s.PTS,'points');
  }
  function streakFacts(e){
    const st=e.streak?.history.streak;if(!st)return null;
    const t=e.streak.ref,recent=e.streak.history.recent||[];
    return {st,t,won:st.ended?st.ended.won:st.won,length:st.ended?st.ended.length:st.length,ended:!!st.ended,
      victims:recent.slice(0,Math.max(0,(st.ended?0:st.length-1))).filter(x=>x.won===st.won).map(x=>x.opponent).filter(Boolean).slice(0,3).map(name=>C.teamRef({name}).nick)};
  }
  function gameOpening(story,e,angle,n){
    const {W,L}=e,ws=e.winner.score,ls=e.loser.score,score=`${W.nickname} ${ws}, ${L.nickname} ${ls}`,J=n[1];
    const sf=streakFacts(e);
    const streakLead=!sf?'':sf.ended?`${cap(sf.t.nick)}' ${sf.length}-game ${sf.won?'winning':'losing'} streak is over`.replace(/s' /,(m)=>sf.t.nick.endsWith('s')?m:"'s "):`That's ${sf.length} straight ${sf.won?'wins':'losses'} for ${sf.t.nick}`;
    const leads={
      routine:[`${score}. ${J}, ${W.nick} ${C.verb(W,'take')} care of business. What did you see?`,`Final from earlier: ${score}. ${J}, are we impressed, or is that just a win?`,`${score}. ${J}, I know you've got thoughts on ${W.nick}.`,`Let's start with ${W.nick} and ${L.nick}. ${score}. ${J}, your takeaway?`],
      close:[`${score}. A ${e.margin}-point game, ${J}. About as tight as it gets.`,`${W.nickname} by ${e.margin}, ${ws}-${ls}. ${J}, a win's a win?`,`Tight one. ${score}. ${J}, who should feel better about that game?`,`${score}. ${J}, ${L.nick} were right there.`],
      blowout:[`${score}. That's a ${e.margin}-point beatdown, ${J}.`,`It wasn't close. ${score}. ${J}, where do you even start?`,`${cap(W.nick)} ${C.verb(W,'roll')}, ${ws}-${ls}. ${J}?`,`${score}. ${J}, ${L.nick} have some answering to do.`.replace(` ${L.nick} have`,` ${L.nick} ${C.verb(L,'have')}`)],
      upset:[`Nobody saw this one coming. ${score}. ${J}, are you surprised?`,`Upset alert. ${score}. ${J}, talk to me.`,`${cap(W.nick)} just knocked off ${L.nick}, ${ws}-${ls}. ${J}, what are we making of this?`,`${score}, and that's not the result the records pointed to. ${J}?`],
      streak:[`${sentence(streakLead)} ${score}. ${J}, what does it mean?`,`${sentence(streakLead)} Final: ${score}. ${J}, you first.`,`${score}. ${sentence(streakLead)} ${J}?`,`${sentence(streakLead)} ${W.nickname} ${ws}, ${L.nickname} ${ls}. ${J}, go.`],
      performance:[`${e.player?.full} went off. ${cap(achievement(e))}, and ${W.nick} beat ${L.nick} ${ws}-${ls}. ${J}?`,`We have to start with ${e.player?.full}: ${achievement(e)}. ${score}. ${J}, your reaction.`,`${score}, but the story is ${e.player?.full}. ${cap(achievement(e))}. ${J}?`,`${e.player?.full} finishes with ${achievement(e)}. ${score}. ${J}, where does that rank?`],
      ...seriesOpenings(e,score,J),
      championship:[`Your champions: ${W.full}! ${score}. ${J}, take it away.`,`${W.display}. Champions. ${score}. ${J}, say it.`,`${cap(W.nick)} ${C.verb(W,'win')} it all, ${ws}-${ls}. ${J}, how do we sum up this team?`,`It's over, and ${W.nick} ${C.verb(W,'are')} champions. ${score}. ${J}?`],
      elimination:[`${cap(L.nick)}' run is over. ${score}. ${J}?`.replace(`${cap(L.nick)}' `,C.possessive(cap(L.nick))+' '),`${cap(W.nick)} ${C.verb(W,'move')} on. ${cap(L.nick)} ${C.verb(L,'go')} home. ${score}. ${J}?`,`Season over for ${L.nick}. ${score}. ${J}, your thoughts.`,`${score}, and that ends it for ${L.nick}. ${J}?`]
    };
    return pick(story,leads[angle],angle+':opening');
  }
  // Playoff segments: the series state is the story.
  function seriesOpenings(e,score,J){
    const S=e.series;if(!S)return {};
    const {W,L}=e,ws=e.winner.score,ls=e.loser.score,lead=`${S.wins}-${S.losses}`;
    const clinch=S.sweep?[`Brooms out. ${score}, and ${W.nick} ${C.verb(W,'finish')} off a ${C.num(S.firstTo)}-game sweep. ${J}?`,`${cap(W.nick)} ${C.verb(W,'sweep')} ${L.nick}. ${score} in Game ${S.gameNumber}. ${J}, are you impressed?`,`Sweep. ${score}. ${J}, say something nice about ${L.nick}.`,`${C.num(S.firstTo)} and done. ${cap(W.nick)} ${C.verb(W,'sweep')} ${L.nick}. ${J}?`.replace(/^./,c=>c.toUpperCase())]:
      S.decider?[`Game ${S.gameNumber}. Winner take all. ${score}, and ${W.nick} ${C.verb(W,'move')} on. ${J}?`,`${cap(W.nick)} ${C.verb(W,'win')} Game ${S.gameNumber}, ${ws}-${ls}. ${J}, what a series.`,`It took ${C.num(S.gameNumber)} games, but ${W.nick} ${C.verb(W,'are')} through. ${score}. ${J}?`,`${score} in Game ${S.gameNumber}. ${cap(L.nick)} ${C.verb(L,'are')} done. ${J}?`]:
      S.firstTo===1?[`${score}. ${cap(W.nick)} ${C.verb(W,'advance')}, ${L.nick} ${C.verb(L,'go')} home. ${J}?`,`Win or go home, and ${W.nick} won. ${score}. ${J}?`,`${cap(W.nick)} ${C.verb(W,'are')} moving on to the ${S.nextRound||'next round'}. ${score}. ${J}?`,`${score}, and that's the end of the road for ${L.nick}. ${J}?`]:
      [`${cap(W.nick)} ${C.verb(W,'close')} it out in ${C.num(S.gameNumber)}. ${score}. ${J}?`,`Series over. ${score}, ${W.nick} ${C.verb(W,'win')} it ${lead}. ${J}?`,`${cap(W.nick)} ${C.verb(W,'are')} moving on to the ${S.nextRound||'next round'}. ${score} in Game ${S.gameNumber}. ${J}?`,`${score}, and ${W.nick} ${C.verb(W,'take')} the series ${lead}. ${J}, your thoughts.`];
    const series=S.tied&&S.wins===S.firstTo-1?[`We're going to Game ${S.bestOf}! ${score}. ${J}?`,`${cap(W.nick)} ${C.verb(W,'force')} a Game ${S.bestOf}. ${score}. ${J}, who wins it?`,`Game ${S.bestOf}, everybody. ${score}. ${J}?`,`${score}, and this series is going the distance. ${J}?`]:
      S.savedSeason?[`${cap(W.nick)} ${C.verb(W,'are')} still alive. ${score} in Game ${S.gameNumber}. ${J}?`,`Not yet. ${cap(W.nick)} ${C.verb(W,'stave')} off elimination, ${ws}-${ls}. ${J}?`,`${score}. ${cap(L.nick)} still ${C.verb(L,'lead')} ${S.losses}-${S.wins}, but ${W.nick} ${C.verb(W,'are')} breathing. ${J}?`,`${cap(W.nick)} ${C.verb(W,'refuse')} to go home. ${score}. ${J}?`]:
      S.tied?[`All square. ${score} in Game ${S.gameNumber}, and we're tied ${lead}. ${J}, who's got the edge now?`,`${cap(W.nick)} ${C.verb(W,'even')} it up, ${ws}-${ls}. ${J}?`,`${lead}. ${score} in Game ${S.gameNumber}. ${J}, what changed?`,`Tied series. ${score}. ${J}, go.`]:
      S.gameNumber===1?[`Game 1 goes to ${W.nick}, ${ws}-${ls}. ${J}, how much does an opener tell you?`,`${score} in Game 1. ${J}?`,`First blood: ${W.nick}. ${score}. ${J}?`,`${cap(W.nick)} ${C.verb(W,'take')} the opener, ${ws}-${ls}. ${J}, overreaction time?`]:
      S.wins===S.firstTo-1?[`${cap(W.nick)} ${C.verb(W,'are')} one win away. ${score}, and they lead ${lead}. ${J}?`,`${lead}, ${W.nick}. ${score} in Game ${S.gameNumber}. ${J}, is it over?`,`${score}. ${cap(L.nick)} ${C.verb(L,'are')} on the brink. ${J}?`,`${cap(W.nick)} ${C.verb(W,'go')} up ${lead}. ${score}. ${J}, can ${L.nick} come back?`]:
      S.wins>S.losses?[`${cap(W.nick)} ${C.verb(W,'take')} a ${lead} lead. ${score}. ${J}?`,`${lead}, ${W.nick}. ${score} in Game ${S.gameNumber}. ${J}?`,`${score}. ${J}, are ${L.nick} in trouble?`,`${cap(W.nick)} ${C.verb(W,'are')} in control, ${lead}. ${J}?`]:
      [`${cap(W.nick)} ${C.verb(W,'get')} one back. ${score}. ${J}?`,`${score} in Game ${S.gameNumber}. ${cap(L.nick)} still ${C.verb(L,'lead')} ${S.losses}-${S.wins}. ${J}?`,`${cap(W.nick)} ${C.verb(W,'cut')} it to ${S.losses}-${S.wins}. ${J}, is there a series here?`,`Game ${S.gameNumber} goes to ${W.nick}. ${J}?`];
    // A huge individual night leads the segment before the series talk.
    if(e.exceptional&&e.player){const lead=`${e.player.full} with ${achievement(e)}. `;for(const list of [clinch,series])list.forEach((t,i)=>{list[i]=lead+t.charAt(0).toLowerCase()+t.slice(1);});}
    return {clinch,series};
  }
  function seriesDebates(e,n){
    const S=e.series;if(!S)return {};
    const {W,L}=e,[M,J,A,N]=n,rec=t=>{const r=e.facts?.records?.[t.id]?.post;return record(r)?`${r[0]}-${r[1]}`:'';};
    const need=S.firstTo-S.wins,leaderNeeds=S.firstTo-S.losses;
    const clinch=S.sweep?[
      [[1,`Brooms! ${cap(W.nick)} didn't just win the series, they embarrassed ${L.nick}. Not one win. Not one!`],[2,`Embarrassed is strong. ${cap(L.nick)} ${rec(e.loser)?`won ${rec(e.loser).split('-')[0]} games this year`:'had a season'}. But a sweep is a statement, no question.`],[3,`And ${W.nick} get rest before the ${S.nextRound||'next round'}. That matters.`]],
      [[1,`I said ${W.nick} in four, and I want my flowers.`],[3,`Did you say that, Jordan?`],[1,`I thought it very loudly.`],[2,`Either way, that's as clean as a series gets.`]]]:
      S.decider?[
      [[1,`That's why we love this time of year. ${C.num(S.gameNumber)} games, and ${W.nick} came up with the one that mattered.`],[2,`Credit both teams. ${cap(L.nick)} took it the distance. Somebody had to go home.`],[3,`And the final was ${e.winner.score}-${e.loser.score}. ${e.margin<=5?`Tight to the end. That's a Game ${S.gameNumber}.`:`Not close in the end, which is a little surprising for a Game ${S.gameNumber}.`}`]]]:
      [[[1,`Job done. ${cap(W.nick)} ${S.firstTo===1?'won the game they had to win':`won ${S.wins} of ${S.gameNumber}`}, and they never looked like the team in trouble.`],[2,`"Never looked" is a stretch, Jordan. ${S.losses?`${cap(L.nick)} took ${S.losses===1?'a game':`${C.num(S.losses)} games`} off them.`:`They won the games, though.`}`],[1,`And then they lost the series.`],[3,`The ${S.nextRound||'next round'} is a different animal. We'll see if this holds up.`]],
       [[1,`${cap(W.nick)} ${C.verb(W,'are')} moving on, and honestly, I'm not surprised.`],[3,`${rec(e.winner)&&rec(e.loser)?`Regular season said ${W.nick} at ${rec(e.winner)}, ${L.nick} at ${rec(e.loser)}. `:''}${S.winnerHigherSeed?'The higher seed held serve.':'And it was the lower seed that advanced, for the record.'}`],[2,`Seeds don't win series. Players do. ${cap(W.nick)} had more of them.`]]];
    const series=S.tied&&S.wins===S.firstTo-1?[
      [[1,`Game ${S.bestOf}. The two best words in sports. I've got ${W.nick}, and I'm not thinking twice.`],[2,`Of course you're not. You never think twice.`],[3,`For the record, this series is ${S.wins}-${S.losses}. Nobody has separated. One game for everything.`]]]:
      S.savedSeason?[
      [[1,`Still alive! I'm not saying they're coming back, but ${W.nick} have a pulse.`.replace(` ${W.nick} have`,` ${W.nick} ${C.verb(W,'have')}`)],[3,`They still need ${C.plural(need,'more win')} in a row, Jordan. ${cap(L.nick)} ${C.verb(L,'need')} ${leaderNeeds===1?'one more':C.plural(leaderNeeds,'more win')}.`],[2,`One game at a time. That's all you can do down ${S.losses}-${S.wins}.`]]]:
      S.tied?[
      [[1,`Momentum is all ${W.nick} right now. All of it.`],[3,`Momentum lasts until the next tip, Jordan. It's ${S.wins}-${S.losses}. Best-of-${C.num(S.bestOf-S.gameNumber)}.`],[2,`I'm with Nina. Nobody's taken control of this series yet.`]],
      [[1,`I didn't believe in ${W.nick} three days ago. I'm starting to.`],[2,`Three days ago? It's tied, Jordan. Calm down.`],[1,`I'm calm. I'm evolving.`]]]:
      S.gameNumber===1?[
      [[1,`Game 1 matters. Don't let anybody tell you different. ${cap(W.nick)} set the tone.`],[3,`It's one game, Jordan. Ask me after Game 3.`],[2,`It's one game, but you'd still rather be up than down.`]],
      [[1,`I'll overreact. ${cap(W.nick)} in ${C.num(Math.min(S.bestOf,S.firstTo+1))}.`],[2,`You'll say that about whoever wins Game 2, too.`],[1,`Probably. But I'm right this time.`]]]:
      S.wins===S.firstTo-1?[
      [[1,`It's over. I'm sorry, it's over. ${cap(L.nick)} ${C.verb(L,'are')} not winning ${C.num(need===1?leaderNeeds:need)} straight against this team.`.replace(/not winning \w+ straight/,`not winning ${C.num(S.firstTo-S.losses)} straight`)],[2,`Nothing's over until somebody gets win number ${C.num(S.firstTo)}, Jordan.`],[3,`${cap(L.nick)} need ${C.num(S.firstTo-S.losses)} in a row. Tall order. Not zero.`.replace(` ${L.nick} need`,` ${L.nick} ${C.verb(L,'need')}`)]]]:
      S.wins>S.losses?[
      [[1,`${cap(W.nick)} ${C.verb(W,'are')} in control, and I don't see that changing.`],[2,`${S.wins}-${S.losses} isn't control. It's a lead. There's a difference.`],[3,`They do need ${C.plural(need,'more win')}, Jordan.`]]]:
      [[[1,`Okay, now we've got a series. ${cap(W.nick)} punched back.`],[3,`They're still down ${S.losses}-${S.wins}. ${cap(L.nick)} need ${C.plural(leaderNeeds,'win')}.`.replace(` ${L.nick} need`,` ${L.nick} ${C.verb(L,'need')}`)],[2,`But this is how comebacks start. One game.`]]];
    return {clinch,series};
  }
  // The argument that follows the opening. Each variant is one coherent exchange.
  function angleDebate(story,e,angle,n){
    const {W,L,margin:m}=e,ws=e.winner.score,ls=e.loser.score,[M,J,A,N]=n;
    const lp=e.loserPre,wp=e.winnerPre,goodLoser=lp&&lp[0]/(lp[0]+lp[1]||1)>=.6,badLoser=lp&&lp[0]/(lp[0]+lp[1]||1)<=.4;
    const comfortable=m/ws>=.2,bucket=m<=2?'one bucket':'one possession',sf=streakFacts(e);
    const variants={
      routine:[
        [[1,goodLoser?`I'll tell you what, that's a real win. ${cap(L.nick)} came in ${rec(lp)}. You beat a team like that by ${m}, people should notice.`:badLoser?`Look, it's not making the highlight package. ${cap(L.nick)} came in ${rec(lp)}. You're supposed to beat that team, and ${W.nick} did. Next.`:`It's a ${m}-point win. Not a statement, not a scare. ${cap(W.nick)} did what they were supposed to do.`],
         [2,`I'm with Jordan. You can't win them all by 20. Handle the games in front of you and the rest takes care of itself.`]],
        [[1,`${cap(W.nick)} did their job. Nothing fancy. ${ws}-${ls}, move on.`],
         [3,comfortable?`I'd push back on "nothing fancy," Jordan. A ${m}-point margin when they only scored ${ws}? That's a comfortable night.`:`Nothing fancy is right. ${m} points isn't nothing, but it's not a beatdown either.`],
         [1,comfortable?`Comfortable, sure. I'm not handing out trophies for it.`:`That's what I said. A win. Put it in the column and keep moving.`]],
        [[1,`I like it. I don't love it, I like it. ${cap(W.nick)} won by ${m}, and they never needed anything crazy to do it.`],
         [2,`You sure about that? You don't know what they needed. But the final says ${m}, and I'll take the final.`],
         [1,`Fair. The final is all I'm judging.`]]
      ],
      close:[
        [[1,`That's a coin flip, and ${W.nick} called it right. I'm not going to sit here and act like ${count(m,'points')} tells me who the better team is.`],
         [2,`No, but you've got to win those. Close games are where seasons get decided. ${cap(W.nick)} will take it and run.`],
         [3,`And ${L.nick} have nothing to hang their heads about. They were ${bucket} away.`.replace(` ${L.nick} have`,` ${L.nick} ${C.verb(L,'have')}`)]],
        [[1,`Give me the team that wins the tight ones. That's all I'm saying. ${cap(W.nick)} found a way, ${ws}-${ls}.`],
         [3,`I'd be careful there, Jordan. A ${m}-point game is basically a toss-up. One more make for ${L.nick} and we're having the opposite conversation.`],
         [1,`But they didn't make it! That's the whole point. Results matter.`],
         [2,`Both things can be true. It's a good win, and it's not proof of anything yet.`]],
        [[1,`I'm happy for ${W.nick}, but I'm not crowning anybody off a ${m}-point game.`],
         [2,`Nobody asked you to crown anybody, Jordan.`],
         [1,`I'm just getting ahead of it, Andre. Somebody always tries.`]]
      ],
      blowout:[
        [[1,`That was a beatdown. ${m} points. ${cap(L.nick)} need answers, and they need them fast.`.replace(` ${L.nick} need`,` ${L.nick} ${C.verb(L,'need')}`)],
         [2,`Credit to ${W.nick}, though. You don't win by ${m} by accident.`],
         [3,`${cap(L.nick)} scored ${ls}. In a game where the other side put up ${ws}, that's just not enough offense.`]],
        [[1,`I'm not going to overthink this. ${cap(W.nick)} were the better team, period. You win by ${m}, you don't get a lot of follow-up questions.`.replace(` were the`,` ${C.verb(W,'were')} the`)],
         [3,`I'll give you one follow-up. ${lp?`${cap(L.nick)} came in ${rec(lp)}. `:''}How much of that is ${W.nick} and how much is ${L.nick} just having a bad night?`],
         [1,`Does it matter? Scoreboard says ${ws}-${ls}.`],
         [2,`It matters for ${L.nick}. For ${W.nick}, no. Enjoy it.`]],
        [[1,`${cap(W.nick)} sent a message tonight. ${m} points. Whoever's next on that schedule saw it.`],
         [2,`I don't know about messages, Jordan. I know they won by ${m}, and that's hard to do against anybody.`]]
      ],
      upset:[
        [[1,`I don't care what the records said. ${cap(W.nick)} came in ${rec(wp)}, ${L.nick} came in ${rec(lp)}, and ${W.nick} won by ${m}. Records don't play the game.`],
         [3,`I'm going to pump the brakes a little, Jordan. One game. ${cap(L.nick)} still have the better record, and I'm not rewriting the season off a single result.`.replace(` ${L.nick} still have`,` ${L.nick} still ${C.verb(L,'have')}`)],
         [1,m>=8?`Pump the brakes? They beat them by ${m}!`:`Nobody's rewriting anything. I'm saying give them their flowers.`],
         [2,`Here's where I land. It's a quality win for ${W.nick}. Whether it means anything depends on what they do next.`]],
        [[1,`This is why you play the games. On paper, ${L.nick} should win that ten times out of ten. Not tonight.`],
         [2,`Ten out of ten is a bit much, Jordan. But ${rec(lp)} against ${rec(wp)}? Yeah, ${L.nick} should be embarrassed.`],
         [3,`I wouldn't say embarrassed. Upsets happen. What I'd want to know is whether ${W.nick} can do it again.`]],
        [[1,`${cap(L.nick)} came in ${rec(lp)} and lost to a ${rec(wp)} team. I'm sorry, that's a bad loss. There's no other way to say it.`],
         [3,`Or it's a good win. Same game, Jordan. Depends which locker room you're sitting in.`],
         [1,`I'm sitting in ${possessive(L.nick)}, and I'm not happy.`]]
      ],
      streak:sf?[
        sf.ended?(sf.won?[[1,`It was going to end eventually. ${sf.length} straight is a heck of a run. I'm not panicking over one loss.`],[3,`Agreed. The question is whether it's one loss or the start of a slide. One game won't tell you that.`],[2,`Get back on the floor and win the next one. That's the only answer.`]]:
          [[1,`Finally! ${sf.length} straight losses, and ${sf.t.nick} finally get one. You could feel the weight lifting off that group.`.replace(` ${sf.t.nick} finally get`,` ${sf.t.nick} finally ${C.verb(sf.t,'get')}`)],[2,`You can't feel anything from here, Jordan. But I get it. A win's a relief after a run like that.`],[3,`One win doesn't fix ${sf.length} losses. But it's a start.`]]):
        sf.won&&sf.length>=8?[[1,`${sf.length} in a row! Nobody can beat ${sf.t.nick} right now. Nobody.`],[3,`${sf.length} straight wins. The last time ${sf.t.nick} lost was ${C.num(sf.length)} games ago, Jordan. That's a long time in this league.`],[2,`What I like is they're not letting up. You get comfortable on a run like this, and they haven't.`]]:
        sf.won?[[1,sf.t===e.W&&record(e.facts?.records?.[e.winner.id]?.post)&&e.facts.records[e.winner.id].post[0]/(e.facts.records[e.winner.id].post[0]+e.facts.records[e.winner.id].post[1])>=.6?`${sf.length} straight. This team is rolling, and I don't see anybody slowing them down.`:`${sf.length} straight. At what point do we start taking ${sf.t.nick} seriously? Because I'm there.`],[2,`I'm getting there. You don't stack ${sf.length} wins by accident.`],[3,sf.victims.length?`And look who they've beaten: ${join(sf.victims)}. Say what you want about the schedule, ${sf.length} in a row is ${sf.length} in a row.`:`I want to see who they've been beating, but ${sf.length} in a row is ${sf.length} in a row.`]]:
          [[1,`${sf.length} in a row. At some point this stops being a slump and it's just who you are.`],[2,`That's harsh, Jordan.`],[1,`Is it wrong, though?`],[3,`It's not right yet. ${sf.length} games is a rough stretch, not a verdict. But they need to stop it soon.`]]
      ]:[[[1,`I'll take the win.`]]],
      performance:[
        [[1,`Come on. ${e.player?.last} was the best player on that floor and it wasn't close.`],[3,`You won't get an argument from me. That line speaks for itself.`]],
        [[1,`That's a star turn right there. When ${e.player?.last} plays like that, ${W.nick} are a different team.`.replace(` ${W.nick} are`,` ${W.nick} ${C.verb(W,'are')}`)],[3,`One game, Jordan. But it's a heck of a game.`]],
        [[1,`I need everybody to stop what they're doing and look at ${C.possessive(e.player?.last||'that')} line.`],[3,`I've seen it, Jordan. It holds up.`]]
      ],
      ...seriesDebates(e,n),
      championship:[
        [[1,`They did it. Whatever you thought about ${W.nick} at the start of the year, they're the last team standing. That's all that matters now.`],[2,`You've got to soak this in. Everybody wants this, and almost nobody gets it.`],[3,`And nobody hands you a ring. ${cap(W.nick)} earned every bit of it.`]],
        [[1,`Champions! I don't want to hear a single criticism about ${W.nick} today. Not one.`],[2,`Nobody's criticizing, Jordan. Let them celebrate.`]]
      ],
      elimination:[
        [[1,`That's it for ${L.nick}. There's no tomorrow. Whatever they did right this year, it ends here.`],[2,`That's the cruel part. You build all season and it's over in one night.`]],
        [[1,`${cap(W.nick)} survive and advance. ${cap(L.nick)} get to think about this one all offseason.`.replace(` ${L.nick} get`,` ${L.nick} ${C.verb(L,'get')}`).replace(`${W.nick} survive`,`${W.nick} ${C.verb(W,'move')} on`)],[3,`And a ${m}-point margin is the number they'll be staring at.`]]
      ]
    };
    return pick(story,variants[angle],angle+':debate').map(([speaker,text])=>turn(speaker,text));
  }
  function possessive(text){return C.possessive(text);}
  // Player segments: each thread is a short exchange built from one fact.
  function supportingThreads(e,angle,n=first()){
    const s=e.s,p=e.player,threads=[],[M,J,A,N]=n,story=e.story||{};
    const say=(key,options)=>pick(story,options,'thread:'+key);
    if(e.streak&&angle!=='streak'){
      const sf=streakFacts(e);
      threads.push({key:'continuity',priority:95,speaker:3,
        question:`And ${N}, what does this do to the streak?`,
        detail:sf.ended?`${cap(possessive(sf.t.nick))} ${sf.length}-game ${sf.won?'winning':'losing'} streak ends here. ${sf.won?"Good run. One loss doesn't erase it.":"They finally get one. It's been a while."}`:
          `That's ${sf.length} straight ${sf.won?'wins':'losses'} for ${sf.t.nick}. ${sf.won?"They keep stacking them.":"That's a hole they have to climb out of."}`,
        response:sf.ended?(sf.won?"Now I want to see the bounce-back. That tells you who they are.":"Build on it. That's all you can do."):sf.won?"Give them their credit. It gets harder to call it luck every night they win.":"Somebody in that locker room has to stop the bleeding."});
    }
    if(!p)return threads;
    const subject=p.he||p.last,pts=validCount(s.PTS)?count(s.PTS,'points'):null;
    if(shotPair(s,'FGM','FGA')&&s.FGA>=4){
      const pct=s.FGM/s.FGA,poor=pct<=.334,strong=pct>=.6,line=`${s.FGM} for ${s.FGA}`;
      threads.push({key:'shooting',player:true,priority:poor?100:strong?85:50,speaker:3,
        question:pts?`${N}, ${pts} for ${p.last}. How'd ${subject} get there?`:`${N}, how was ${p.last} shooting it?`,
        detail:poor?say('poor',[`Not efficiently. ${p.last} went ${line} from the field. That's a rough shooting night, and you can't just look past it.`,`Volume. ${line} from the field. That's a rough shooting night, I don't care how many went in.`,`The hard way. ${line}. If we're being honest, that's a rough shooting night.`]):
          strong?say('strong',[`Efficiently. ${p.last} went ${line} from the field. That's efficient scoring, about as clean as it gets.`,`${line} from the field. That's efficient scoring. Barely a wasted possession.`,`On ${line} shooting. That's efficient scoring, and that's the part I love.`]):
          say('fine',[`${p.last} went ${line} from the field. Nothing crazy, nothing to complain about.`,`${line}. Respectable. Not a shooting clinic, not a problem.`]),
        response:poor?`I hear you, ${N}, but somebody had to take those shots.${pts?` ${cap(pts)} is ${pts}.`:''}`:
          strong?say('strong-r',s.FGA>=Math.max(8,20*e.scale)?[`${s.FGA} shots, ${s.FGM} makes. That's not normal. That's a player in a zone.`,`That's volume and efficiency. You almost never get both.`,`Professional. That's a pro's night right there.`]:[`That's a bucket-getter. Didn't need volume. Just cashed in.`,`Give me that every night. You don't need a ton of shots when you're making them.`,`Professional. That's a pro's night right there.`]):say('fine-r',[`Solid. I'd look at what else came with it before I get too high or too low.`,`Fine. I want to know what else was in that box score.`]),
        rebuttal:poor?`It's not just "somebody had to." It's ${s.FGA} shots, Jordan. Make a couple more of those and it's a different night.`:null});
    }
    if(validCount(s.TO)&&(s.TO>=4||(s.TO===0&&s.PTS>=Math.max(6,20*e.scale))||(s.AST>=5&&s.AST>s.TO))){
      threads.push({key:'security',player:true,priority:s.TO>=4?95:65,speaker:2,
        question:say('security-q',[`${A}, how about the decision-making?`,`${A}, was ${p.last} careful with it?`,`${A}, ball security?`]),
        detail:s.TO===0?say('clean',[`Zero turnovers. Not one. That's the stuff that doesn't make the highlight package, but it wins you games.`,`No turnovers. ${pts?cap(pts):'The production'} without giving a single possession away. I love that.`,`Didn't turn it over once. People skip right past that, and they shouldn't.`]):
          `My issue is the turnovers. ${s.TO} of them${validCount(s.AST)?` against ${count(s.AST,'assists')}`:''}. ${s.TO>=4?"You can't be that loose with the ball.":"I'll take that balance."}`,
        response:s.TO>=4?(s.AST>s.TO?`Come on, ${A}. ${s.AST} assists, ${s.TO} turnovers. When you're making that many plays for people, some of that comes with it.`:`Yeah, that's too many. You can love the rest of it and still want that cleaned up.`):
          say('clean-r',[`That's winning basketball. Take care of the rock and everybody eats.`,`Underrated. You don't beat yourself, you give yourself a chance every night.`,`That's grown-man basketball right there.`])});
    }
    if(e.ppg!==null&&validCount(s.PTS)){
      const delta=s.PTS-Number(e.ppg),near=Math.abs(delta)<Math.max(1.5,3*e.scale);
      threads.push({key:'average',player:true,priority:Math.abs(delta)>=Math.max(3,10*e.scale)?90:55,speaker:3,
        question:say('avg-q',[`${N}, what does ${p.last} usually give them?`,`${N}, how does that compare to the usual?`,`${N}, is that normal for ${p.last}?`]),
        detail:`${p.last} is averaging ${e.ppg} points a game ${e.average.period==='playoffs'?'in the playoffs':'this season'}. ${near?"So tonight was pretty much right on schedule.":delta>0?`Tonight was ${s.PTS}. Way above the norm.`:`Tonight was ${s.PTS}. Well below the norm.`}`,
        response:near?say('avg-near',["That's what I love about it. You know what you're getting every night.","Reliable. Coaches love reliable."]):
          delta>0?say('avg-up',["So don't tell me it's just another night. That's a breakout, and I'm enjoying it.","That's a different gear. I want to see it again.","Somebody's been holding out on us."]):say('avg-down',["Quiet night by those standards. Happens. I'm not worried about one game.","Off night. Everybody gets one."])});
    }
    // What counts as a notable secondary line grows with the length of the game.
    const notable={AST:Math.max(3,7*e.scale),REB:Math.max(5,10*e.scale),BLK:Math.max(2,3*e.scale),STL:Math.max(2,3*e.scale)};
    const contribution=['AST','REB','BLK','STL'].filter(k=>validCount(s[k])&&s[k]>=notable[k]).sort((a,b)=>s[b]/notable[b]-s[a]/notable[a])[0];
    // A scoring-only follow-up repeats the shooting discussion. Keep it when
    // it's the main story, or when we have another contribution to discuss.
    if(contribution||(validCount(s.PTS)&&(angle==='performance'||!threads.some(t=>t.key==='shooting')))){
      const stats=e.doubles.length>=3?e.doubles.map(k=>count(s[k],labels[k])):
        [validCount(s.PTS)?count(s.PTS,'points'):null,contribution?count(s[contribution],labels[contribution]):null].filter(Boolean);
      const share=e.share!==null&&e.side==='winner'?fraction(e.share):null;
      threads.push({key:'contribution',player:true,priority:angle==='performance'?110:75,speaker:2,
        question:say('contrib-q',[`${A}, what jumped out at you from ${p.last}?`,`${A}, what did you like from ${p.last}?`,`${A}, give me the full picture on ${p.last}.`]),
        detail:angle==='performance'&&e.doubles.length>=3?`Forget the points for a second. ${join(e.doubles.filter(k=>k!=='PTS').map(k=>count(s[k],labels[k])))}. ${e.doubles.includes('AST')?"I love the passing. That's somebody making the whole offense better.":"That's somebody doing everything."}`:
          `${p.last} finished with ${join(stats)}. ${contribution==='AST'?"I love the passing. That's somebody making the whole offense better.":contribution==='REB'?"And don't skip past the rebounds. That's work.":contribution?"That's real impact on the defensive end, too.":s.PTS===0?"Couldn't buy a bucket.":share?`That's ${share} of ${possessive(e.W.nick)} points.`:"That's where I start."}`,
        response:e.doubles.length>=2?`That's a ${kinds[e.doubles.length]}. ${e.doubles.includes('AST')?"And those assists mean other guys are eating, too.":"That's more than just getting buckets."}`:contribution==='AST'?"Right, and that's the part people miss. The assists make everybody better.":contribution==='REB'?`${s.REB} boards. Doing the dirty work and still scoring. Give me that.`:contribution?`${count(s[contribution],labels[contribution])}. That's a two-way night.`:s.PTS===0?"You've got to find a way to help somewhere else on a night like that.":share?`That's carrying the load. They needed every one of them.`:shotPair(s,'FGM','FGA')?"How many shots did it take, though? That's my next question.":"Without the shooting numbers, I'll just say it's a solid night."});
    }
    const helper=e.side==='winner'?e.box.filter(r=>r.tid===e.winner.id&&r.pid!==story.playerId&&r.stats.PTS>=Math.max(3,.2*e.winner.score)).sort((a,b)=>b.stats.PTS-a.stats.PTS||a.pid-b.pid)[0]:null;
    if(helper){
      threads.push({key:'support',priority:60,speaker:2,
        question:say('support-q',[`Who else stepped up?`,`${A}, who's the unsung guy?`.replace(' guy',' name'),`Anybody else, ${A}?`]),
        detail:`Don't sleep on ${helper.name}. ${count(helper.stats.PTS,'points')}${helper.stats.GS===0?' off the bench':''}. Every team needs a second option.`,
        response:say('support-r',[`Good call. You can't do it alone in this league.`,`That's the guy nobody's talking about tomorrow. They should be.`.replace('the guy','the name'),`Depth wins. Simple as that.`])});
    }
    const top=e.side==='winner'?e.box.filter(r=>r.tid===e.loser.id&&r.stats.PTS>0).sort((a,b)=>b.stats.PTS-a.stats.PTS||a.pid-b.pid)[0]:null;
    if(top){
      const cold=shotPair(top.stats,'FGM','FGA')&&top.stats.FGA>=5&&top.stats.FGM/top.stats.FGA<=.35;
      threads.push({key:'opponent',priority:cold?70:45,speaker:3,
        question:say('opp-q',[`What about the other side?`,`${N}, what happened to ${e.L.nick}?`,`And ${e.L.nick}?`]),
        detail:cold?`${top.name} led ${e.L.nick} with ${top.stats.PTS}, but it took ${top.stats.FGA} shots. ${top.stats.FGM} for ${top.stats.FGA}. That's not going to beat anybody.`:
          `Credit ${top.name}: ${count(top.stats.PTS,'points')} for ${e.L.nick}. Just didn't have enough help.`,
        response:cold?say('opp-cold',["When your best scorer has that kind of night, you're in trouble.","You need your top option to show up. Didn't happen."]):say('opp-r',["That's the problem when one guy's doing all the lifting.","Nobody else gave them anything. That's the game."])});
    }
    return threads.sort((a,b)=>b.priority-a.priority).slice(0,2);
  }
  function teamEdgeLine(e){
    const w=C.teamTotals(e.box,e.winner.id),l=C.teamTotals(e.box,e.loser.id);
    if(!w||!l)return null;
    if(l.FGA>0&&w.FGA>0&&l.FGM!==null&&w.FGM!==null&&l.FGM/l.FGA<=.36&&w.FGM/w.FGA-l.FGM/l.FGA>=.1)return `${cap(e.L.nick)} shot ${l.FGM} for ${l.FGA} as a team. You're not winning many games like that.`;
    if(w.REB!==null&&l.REB!==null&&w.REB-l.REB>=Math.max(4,.3*l.REB))return `${cap(e.W.nick)} won the glass ${w.REB} to ${l.REB}. That's extra possessions all night.`;
    if(w.TO!==null&&l.TO!==null&&l.TO-w.TO>=3)return `${cap(e.L.nick)} turned it over ${l.TO} times. ${cap(e.W.nick)}: ${w.TO}. That's free possessions.`;
    return null;
  }
  function gameClosing(story,e,angle,n){
    const {W,L}=e,p=e.player;
    const options={
      routine:[`${cap(W.nick)} ${C.verb(W,'get')} the W. Let's keep it moving.`,`Business as usual for ${W.nick}. We'll leave it there.`,`All right. Good win for ${W.nick}. Moving on.`,`${cap(L.nick)} will want that one back. That's the desk on this game.`],
      close:[`A ${e.margin}-point game. We could argue about this one all day, but we won't.`,`Tight one, and ${W.nick} ${C.verb(W,'come')} out on the right side of it.`,`One possession. That's the difference tonight.`,`${cap(W.nick)} ${C.verb(W,'take')} the close one. Let's move on.`],
      blowout:[`${cap(L.nick)} will want to burn the tape on that one.`,`${cap(W.nick)} by ${e.margin}. Enough said.`,`Statement made. Let's move on.`,`Ugly night for ${L.nick}. Big one for ${W.nick}.`],
      upset:[`Don't sleep on ${W.nick}. That's the lesson tonight.`,`The records said one thing. The scoreboard said another.`,`We'll find out soon enough if ${W.nick} can back it up.`,`Upset of the night. Let's keep it moving.`],
      streak:[`That's the streak watch. We'll keep an eye on it.`,`We'll see where it goes from here.`,`Streaks make the season interesting. This one's no exception.`,`All right. Next topic.`],
      performance:[`${p?.last} owned the night. That's where we'll leave it.`,`What a night for ${p?.last}.`,`${p?.last} gets the headline. ${cap(W.nick)} get the W.`.replace(`${cap(W.nick)} get`,`${cap(W.nick)} ${C.verb(W,'get')}`),`Tip of the cap to ${p?.last}.`],
      clinch:[`${cap(W.nick)} ${C.verb(W,'move')} on. ${cap(L.nick)} ${C.verb(L,'go')} home.`,`On to the ${e.series?.nextRound||'next round'} for ${W.nick}.`,`Series over. We'll see you in the ${e.series?.nextRound||'next round'}.`,`That's a wrap on that series.`],
      series:[`On to Game ${(e.series?.gameNumber||0)+1}.`,`Game ${(e.series?.gameNumber||0)+1} can't come soon enough.`,`Series ${e.series?.wins>e.series?.losses?`${e.series?.wins}-${e.series?.losses}, ${W.nick}`:e.series?.wins===e.series?.losses?`tied ${e.series?.wins}-${e.series?.losses}`:`${e.series?.losses}-${e.series?.wins}, ${L.nick}`}. Stay tuned.`,`That's where the series stands. Let's keep it moving.`],
      championship:[`Tonight belongs to the champions. Congratulations to ${W.nick}.`,`The offseason questions can wait. Enjoy it, ${W.nick}.`,`Champions. Hard to say it any better than that.`,`A title for ${W.nick}. What a way to finish.`],
      elimination:[`${cap(L.nick)} ${C.verb(L,'are')} out. Tough way to go.`,`${cap(W.nick)} ${C.verb(W,'move')} on. ${cap(L.nick)} ${C.verb(L,'are')} done.`,`That's the end of the road for ${L.nick}.`,`Season over for ${L.nick}. That one stings.`]
    };
    return pick(story,options[angle],angle+':closing');
  }
  function gameScript(story,context={},n=first()){
    const e=selectEvidence(story,context);if(!e)return genericScript(story,n);
    const angle=selectAngle(e),turns=[turn(0,gameOpening(story,e,angle,n)),...angleDebate(story,e,angle,n)];
    const threads=supportingThreads(e,angle,n);
    let introduced=angle==='performance';
    for(const [index,thread] of threads.entries()){
      // Maya pivots when the subject changes; a performance opening already
      // put the player on the table, so the desk picks it up directly.
      let question=index&&thread.key==='shooting'?`And ${n[3]}, the shooting?`:
        index&&thread.key==='contribution'?`What else did ${e.player.last} give them?`:thread.question;
      if(thread.player&&!introduced){
        question=`${pick(story,[`Let's get to ${e.player.full}, the player of the game.`,`Player of the game: ${e.player.full}.`,`${e.player.full} got player of the game.`],'intro')} ${question}`;
        introduced=true;
      }
      if(index||angle!=='performance')turns.push(turn(0,question));
      turns.push(turn(thread.speaker,thread.detail),turn(thread.speaker===1?2:1,thread.response));
      if(thread.rebuttal&&['upset','performance','championship','elimination','streak'].includes(angle))turns.push(turn(3,thread.rebuttal));
      // A second pass develops the same shooting thread with new evidence.
      if(['championship','elimination','upset','streak','performance'].includes(angle)&&thread.key==='shooting'&&
        shotPair(e.s,'TPM','TPA')&&e.s.TPA>=4&&e.s.TPA<=e.s.FGA&&e.s.TPM<=e.s.FGM){
        turns.push(turn(0,`How much of that came from deep?`),
          turn(3,`${e.s.TPM} for ${e.s.TPA} from three. ${e.s.TPM===0?"None of it. All inside the arc.":e.s.TPM/e.s.TPA>=.4?"That's a good night from out there.":"The outside shot wasn't there."}`));
      }
    }
    const edge=teamEdgeLine(e);
    if(edge&&turns.length<=10)turns.push(turn(3,`${pick(story,['One more number for you.','Here\'s the stat that tells the story.','And this is the number I keep coming back to.'],'edge')} ${edge}`));
    turns.push(turn(0,gameClosing(story,e,angle,n)));
    // Back-to-back lines from one host read as a single answer.
    const merged=[];
    for(const t of turns){const last=merged.at(-1);if(last&&last.speaker===t.speaker)last.text+=' '+t.text;else merged.push({...t});}
    return merged.length>14?[...merged.slice(0,13),merged.at(-1)]:merged;
  }
  function featuredStats(story){return Season.featuredStatsForStory(story);}
  function teamRecords(story){return (story.seasonSnapshot?.teamRecords||[]).map(x=>({
    name:(story.relatedTeams||[]).find(t=>t.id===x.teamId)?.name,r:x.record?.seasonStats||x.record
  })).filter(x=>x.name&&validCount(x.r?.W)&&validCount(x.r?.L));}
  function frame(story,kind,openings,closings,body){
    return [turn(0,pick(story,openings,kind+':opening')),...body,turn(0,pick(story,closings,kind+':closing'))];
  }
  // Award segments argue about the evidence that fits the award.
  function awardDesk(story,n){
    const snap=story.seasonSnapshot,a=snap.award,p=snap.featuredPlayer,s=featuredStats(story),[M,J,A,N]=n;
    const name=p.name,last=C.surname(name),r=k=>rate(s,k),rec=a.teamRecord?`${a.teamRecord[0]}-${a.teamRecord[1]}`:null,he=a.pronoun||last;
    const T=a.teamName?C.teamRef({city:a.teamCity,name:a.teamNickname||a.teamName}):null,body=[];
    const honors=Season.honorLines(story).slice(0,1).map(t=>turn(3,`And worth noting: ${t.replace(/^It's/,"it's")}`));
    const takes={
      mvp:[`Deserved. No debate. ${last} was the best player in this league, and it wasn't close.`,`I had ${last} on my ballot from day one. Day one!`,`Easiest call of the year. I'm not even entertaining other names.`],
      finals:[`Biggest stage, biggest games, and ${last} delivered. That's what this award is for.`,`You want to know who shows up when it matters? There's your answer.`],
      dpoy:[`Finally, somebody gets credit for the other end of the floor. ${last} earned it.`,`Nobody wants to drive on ${last}. That's the whole case.`],
      roy:[`The kid can play. I'm not surprised one bit.`,`Rookie of the Year, and I think we're just getting started with ${last}.`],
      sixth:[`I love this award. It's for the players who take the role and own it.`,`${last} could start for half this league. That's the case right there.`],
      mip:[`Talk about a jump. ${last} came back a different player.`,`That's the award for the work nobody saw. Love it.`],
      PTS:[`Bucket-getter. ${last} got buckets all year, and now there's hardware to prove it.`],REB:[`${last} lived on the glass. Every board, every night.`],AST:[`${last} made everybody around them better. That's what a point guard does.`.replace('them',a.pronoun==='she'?'her':a.pronoun==='he'?'him':'them')],
      STL:[`Quick hands. ${last} made life miserable for ball handlers.`],BLK:[`Don't come in the paint. ${last} has been sending that message all season.`]
    }[a.kind]||[`Good for ${last}. That's recognition that was a long time coming.`];
    body.push(turn(1,pick(story,takes,'award:take')));
    if(s?.GP>0){
      const evidence={
        mvp:`${r('PTS')} points, ${r('REB')} rebounds and ${r('AST')} assists a game${rec?`, for a team that went ${rec}`:''}.`,
        finals:s.GP===1?`${C.plural(s.PTS,'point')}, ${C.plural(s.REB,'rebound')} and ${C.plural(s.AST,'assist')} in the title game.`:`${r('PTS')} points and ${r('REB')} rebounds a game over ${C.plural(s.GP,'Finals game')}.`,
        dpoy:`${r('BLK')} blocks and ${r('STL')} steals a game${a.allowedRank?`, and that defense ranked ${a.allowedRank===1?'first':`No. ${a.allowedRank}`} in points allowed`:''}.`,
        roy:`${r('PTS')} points and ${r('REB')} rebounds a game as a rookie${Number.isFinite(s.GS)?`, with ${s.GS} starts in ${s.GP} games`:''}.`,
        sixth:Number.isFinite(s.GS)?`${r('PTS')} points a game, and ${s.GP-s.GS} of ${s.GP} games off the bench.`:`${r('PTS')} points a game.`,
        mip:a.previous?`${(a.previous.PTS/a.previous.GP).toFixed(1)} points a game last year. ${r('PTS')} this year.`:`${r('PTS')} points a game.`,
        PTS:`${r('PTS')} points a game${s.FGA>0?` on ${(100*s.FGM/s.FGA).toFixed(1)} percent shooting`:''}.`,REB:`${r('REB')} rebounds a game.`,AST:`${r('AST')} assists a game${Number.isFinite(s.TO)?` against ${r('TO')} turnovers`:''}.`,STL:`${r('STL')} steals a game.`,BLK:`${r('BLK')} blocks a game.`
      }[a.kind]||`${r('PTS')} points a game.`;
      body.push(turn(3,`The numbers: ${evidence}`));
      const angle={
        mvp:rec&&a.teamRecord[0]<a.teamRecord[1]?`And I'll push back a little. ${rec}. Can the most valuable player be on a losing team?`:`And it showed up in the standings. That matters for an MVP.`,
        finals:`Remember this one. Those are the games people talk about for years.`,
        roy:`Most rookies are just trying to survive. ${last} was producing.`,
        sixth:`That's a starter's production in a bench role. That's the award.`,
        mip:`That's not luck. That's a summer of work.`,
        dpoy:`Defense doesn't always show up in a box score. Some of it does, and ${last}'s does.`,
        other:`Good season. Well earned.`
      }[a.kind]||`Leading the league over ${C.plural(s.GP,'game')} isn't a hot streak. That's a season.`;
      body.push(turn(2,angle));
      if(a.kind==='mvp'&&rec&&a.teamRecord[0]<a.teamRecord[1])body.push(turn(1,`Yes! Value doesn't care about the standings.`));
    }
    if(a.alsoWon?.length)body.push(turn(0,`And ${last} also won ${join(a.alsoWon)}. ${A}?`),turn(2,a.alsoWon.length>1?`That's a trophy case. What a season.`:`Two awards. That's a season people remember.`));
    body.push(...honors);
    return frame(story,'award',[`${name}${T?` of ${T.nick}`:''} is your ${a.name}. ${J}, your reaction?`,`${a.name} goes to ${name}. ${J}?`,`It's official: ${name} wins ${a.name}. ${J}, did they get it right?`,`Hardware for ${name}: ${a.name}. ${J}, go.`],
      [`Congratulations to ${name}. Well earned.`,`${last} gets the hardware. We'll leave it there.`,`An award to be proud of. Congrats, ${last}.`,`That's recognition for the work already done.`],body);
  }
  function awardScript(story,n=first()){
    if(story.seasonSnapshot?.award&&story.seasonSnapshot?.featuredPlayer)return awardDesk(story,n);
    const row=story.seasonSnapshot?.rows?.[0],p=story.seasonSnapshot?.featuredPlayer;
    const name=p?.name||row?.[1]||String(story.headline).split(' wins ')[0],award=row?.[0]||String(story.headline).split(' wins ').slice(1).join(' wins ')||'the award';
    const last=C.surname(name),J=n[1];
    const s=featuredStats(story),body=Season.honorLines(story).slice(0,2).map(text=>turn(3,`And worth noting: ${text.replace(/^It's/,"it's")}`));
    const categories=/defens/i.test(award)?['BLK','STL']:['PTS','AST'];
    const values=categories.filter(k=>rate(s,k)!==null);
    if(s?.GP>0&&values.length){
      const postseason=story.statsPeriod==='finals'||story.statsPeriod==='playoffs'||story.seasonSnapshot?.tables?.some(t=>t.label==='Playoff player statistics');
      body.unshift(turn(1,pick(story,[`Deserved. No debate. ${last} was the guy, and everybody in the league knew it.`,`Easiest call of the year. I'm not even entertaining other names.`,`I had ${last} on my ballot from day one. Day one!`],'award:take')));
      body.push(turn(3,`${last} averaged ${join(values.map(k=>`${rate(s,k)} ${labels[k]}`))} a game${postseason?' in the postseason':''}. ${/defens/i.test(award)?"That's a lot of disruption.":"That's production you can't ignore."}`));
      body.push(turn(0,`${n[3]}, how big is the sample?`));
      body.push(turn(3,s.GP===1?`Just the one game. Big stage, though.`:`${s.GP} games. That's not a hot week. That's a body of work.`));
      if(rate(s,'MIN')!==null)body.push(turn(2,`And ${rate(s,'MIN')} minutes a night. The coaches trusted ${last}, and ${last} delivered.`));
      body.push(turn(1,pick(story,["Let them enjoy it. We'll argue about next year next year.","Put it on the mantel. Well earned.","Hardware. That's what this is all about."],'award:close-take')));
    }else body.unshift(turn(1,`Good for ${last}. That's recognition that was a long time coming.`));
    return frame(story,'award',[`${name} wins ${award}. ${J}, your reaction?`,`${award} goes to ${name}. ${J}?`,`It's official: ${name} is your ${award} winner. ${J}, did they get it right?`,`Hardware for ${name}: ${award}. ${J}, go.`],
      [`Congratulations to ${name}. Well earned.`,`${last} gets the hardware. We'll leave it there.`,`An award to be proud of. Congrats, ${last}.`,`That's recognition for the work already done.`],body);
  }
  function playoffScript(story,n=first()){
    const rows=story.seasonSnapshot?.rows||[];if(!rows.length)return genericScript(story,n);
    const teams=teamRecords(story),round=Number(String(story.eventKey||'').match(/playoff-round-(\d+)/)?.[1]),J=n[1];
    if(rows[0].length>=4)return seriesTracker(story,rows,n);
    const paired=rows.map(row=>({row,a:teams.find(t=>t.name===row[0]),b:teams.find(t=>t.name===row[1])}));
    const pair=paired.filter(x=>x.a&&x.b).sort((a,b)=>Math.abs(a.a.r.W-a.b.r.W)-Math.abs(b.a.r.W-b.b.r.W))[0]||paired[0];
    const {row,a,b}=pair,A=C.teamRef({name:row[0]}),B=C.teamRef({name:row[1]});
    const body=[turn(1,`${cap(A.nick)} against ${B.nick}. That's the one I'm circling. ${row[2]==='Single elimination'?"One game. No Game 2 to fix your mistakes. Lose and you're on vacation.":/^Best of \d+$/.test(row[2])?`${row[2]}. You can survive a bad night. That changes everything.`:"I want to see how those two match up."}`)];
    if(a&&b){
      const gap=Math.abs(a.r.W-b.r.W);
      body.push(turn(3,`${A.nickname}: ${a.r.W}-${a.r.L}. ${B.nickname}: ${b.r.W}-${b.r.L}. ${gap===0?"Same number of wins. Good luck picking a favorite off that.":`A ${gap}-win difference. ${gap<=3?"That's nothing. Coin flip.":"Real gap, but it's not enough on its own to call the series."}`}`));
      const offense=rate(a.r,'PTS'),allowed=rate(b.r,'OPP');
      if(offense!==null&&allowed!==null){
        body.push(turn(0,`${n[3]}, where's the matchup?`));
        body.push(turn(3,`${A.nickname} score ${offense} points a game. ${B.nickname} allow ${allowed}. That's the battle I want to watch.`));
        body.push(turn(1,`Give me the offense. I'll always take the team that can get a bucket.`));
        body.push(turn(2,`Defense travels, Jordan. I'll take the other side of that.`));
      }
      body.push(turn(2,row[2]==='Single elimination'?"And they get one shot at it. Bad night, you're done.":"Let me see Game 1 before I pick a side. We'll have a lot more to argue about then."));
    }
    return frame(story,'playoff',[`${round>1?`Round ${round}`:'The playoffs'}: ${rows.length} ${rows.length===1?'matchup':'matchups'} set. ${J}, where are you looking?`,`It's ${round>1?`Round ${round}`:'playoff time'}. Let's look at the matchups. ${J}, you first.`,`${round>1?`Round ${round}`:'The playoff field'} is locked in. ${J}, which series has your attention?`,`Win or go home time. ${J}, what's the series to watch?`],
      ["The matchups are set. Let the games begin.","We'll be watching when they tip off.","I can't wait for this round.","We'll revisit after they play. Somebody's going to be wrong."],body);
  }
  // Mid-round: the desk works through the open series.
  function seriesTracker(story,rows,n){
    const ref=name=>C.teamRef({name}),score=r=>r[3].split('-').map(Number),firstTo=r=>(Number(String(r[2]).match(/\d+/)?.[0])+1)/2||1;
    const done=rows.filter(r=>Math.max(...score(r))===firstTo(r)),live=rows.filter(r=>!done.includes(r));
    const tied=live.filter(r=>score(r)[0]===score(r)[1]),brink=live.filter(r=>Math.max(...score(r))===firstTo(r)-1&&score(r)[0]!==score(r)[1]);
    const lead=r=>{const [a,b]=score(r);return a>=b?[ref(r[0]),ref(r[1]),a,b]:[ref(r[1]),ref(r[0]),b,a];};
    const body=[];
    const focus=tied[0]||brink[0]||live[0];
    if(focus){
      const [x,y,a,b]=lead(focus);
      body.push(turn(1,a===b?`${cap(x.nick)} and ${y.nick}, tied ${a}-${b}. That's the series. Everything else is noise.`:`${cap(x.nick)} up ${a}-${b} on ${y.nick}. ${a===firstTo(focus)-1?"Put a fork in it.":"They're in control."}`));
      body.push(turn(3,a===b?`It's a best-of-${C.num(firstTo(focus)*2-1-a-b)} now. Nobody's separated.`:`${cap(y.nick)} need ${C.num(firstTo(focus)-b)} to win it. ${a===firstTo(focus)-1?"Tall order.":"Plenty of time."}`.replace(` ${y.nick} need`,` ${y.nick} ${C.verb(y,'need')}`)));
    }
    if(brink.length>1||(brink.length&&brink[0]!==focus))body.push(turn(2,`And keep an eye on ${join(brink.filter(r=>r!==focus).map(r=>{const [x,y,a,b]=lead(r);return `${x.nick} up ${a}-${b} on ${y.nick}`;}))}. Closeout games are the hardest ones to win.`));
    if(done.length)body.push(turn(1,`Shout-out to ${join(done.map(r=>lead(r)[0].nick))}. ${done.length>1?'Already moving on.':'Already moving on.'} ${done.filter(r=>Math.min(...score(r))===0).length>=2?'Brooms everywhere.':''}`.trim()));
    return frame(story,'tracker',[`Playoff check-in. ${C.plural(done.length,'series')} done, ${C.plural(live.length,'still going')}. ${n[1]}, where are you looking?`.replace('series','series'),`Let's run through the bracket. ${n[1]}?`,`Where every series stands. ${n[1]}, start us off.`,`Playoff tracker time. ${n[1]}?`],
      ["That's the bracket. Buckle up.","Lots of basketball left. Stay tuned.","We'll check back after the next round of games.","Somebody's season ends soon. Let's see who."],body);
  }
  function championshipScript(story,n=first()){
    const row=story.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.relatedTeams?.[0]?.name;
    if(!champ)return genericScript(story,n);
    const T=C.teamRef({name:champ}),J=n[1];
    const body=Season.honorLines(story).slice(0,2).map(text=>turn(3,text)),team=teamRecords(story).find(t=>t.name===champ);
    body.unshift(turn(1,pick(story,[`They did it! I don't want to hear anything negative about ${T.nick} today. Nothing.`,`Champions. Say it with me. That's the only word that matters now.`,`Whatever you thought about ${T.nick} at the start of the year, they're the last team standing.`],'title:take')));
    const run=story.seasonSnapshot?.run||[],mvp=story.seasonSnapshot?.finalsMvp,last=run.at(-1);
    if(row[1]&&row[1]!=='Not available')body.push(turn(2,last?.firstTo>1?(last.losses===0?`And a sweep in the Finals? Against ${C.teamRef({name:row[1]}).nick}? That's a statement.`:`${last.wins}-${last.losses} over ${C.teamRef({name:row[1]}).nick} in the Finals. They'll tell their kids about that one.`):
      `And beating ${C.teamRef({name:row[1]}).nick}${story.seasonSnapshot?.finalScore?` ${story.seasonSnapshot.finalScore}`:''} to finish it? That's the one they'll tell their kids about.`));
    const sevens=run.filter(r=>r.firstTo>1&&r.games===r.firstTo*2-1).length;
    if(sevens>=2)body.push(turn(3,`And don't forget how they got there. ${C.capitalize(C.num(sevens))} series that went the distance. That's a tough team.`));
    if(mvp)body.push(turn(0,`${mvp.name} took ${mvp.award}. ${n[2]}?`),turn(2,mvp.GP===1?`${mvp.PTS} points and ${mvp.REB} rebounds in the title game. Big stage, big night.`:`${(mvp.PTS/mvp.GP).toFixed(1)} points a game in the Finals. When it mattered most, the ball found ${C.surname(mvp.name)}.`));
    if(team){
      body.push(turn(0,`${n[3]}, what did the regular season look like?`));
      body.push(turn(3,`${team.r.W}-${team.r.L}. ${team.r.W>team.r.L*2?"In control from the jump.":team.r.W>team.r.L?"Good, not overwhelming. Which makes this run even better.":"Not great, honestly. Which makes this one of the better stories in a while."}`));
      const ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP');
      if(ppg!==null&&opp!==null)body.push(turn(3,`${ppg} points scored and ${opp} allowed a game in the regular season. ${Number(ppg)>Number(opp)?"They outscored people all year.":"Not the profile of a champion on paper. Didn't matter."}`));
      body.push(turn(1,"And now they've got the trophy. Every other team would trade places with them right now."));
    }
    return frame(story,'championship',[`${T.display}: champions. That's the headline. ${J}?`,`It's over, and ${T.nick} ${C.verb(T,'are')} champions. ${J}, take it away.`,`The title belongs to ${T.nick}. ${J}?`,`Confetti's falling for ${T.nick}. ${J}, your reaction.`],
      [`Enjoy this one, ${T.nickname} fans. The next challenge can wait.`,"There will be offseason questions. Tonight belongs to the champions.","They earned the celebration. Congratulations.","A title gives this season its ending. What a ride."],body);
  }
  // A team review leads with how the season ended. A title outranks any
  // record, so a middling regular season becomes the backstory, not the grade.
  function teamReviewScript(story,n=first()){
    const team=teamRecords(story)[0];if(!team)return seasonScript(story,n);
    const snap=story.seasonSnapshot?.postseason,result=snap?.result||story.seasonOutcome,J=n[1],A=n[2],N=n[3];
    const T=C.teamRef({name:team.name}),rec=`${team.r.W}-${team.r.L}`,pct=team.r.W/Math.max(1,team.r.W+team.r.L);
    const ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP'),gap=ppg!==null&&opp!==null?(team.r.PTS-team.r.OPP)/team.r.GP:null;
    const fin=snap?.final,college=snap?.college??story.seasonSnapshot?.leagueType===1,field=college?'tournament':'playoffs';
    const oppNick=fin?.opponent?C.teamRef({name:fin.opponent}).nick:null,margin=gap===null?'':Math.abs(gap).toFixed(1);
    const seriesText=f=>!f?'':f.firstTo>1?` ${Math.max(f.wins,f.losses)}-${Math.min(f.wins,f.losses)}`:'';
    const table=story.seasonSnapshot?.tables?.find(t=>t.label==='Regular-season player statistics');
    const scorer=[...(table?.rows||[])].filter(r=>Number.isFinite(Number(r[2]))&&r[2]!==''&&r[2]!==null).sort((a,b)=>Number(b[2])-Number(a[2]))[0];
    const body=[];
    if(result==='champion'){
      body.push(turn(1,pct>=.7?`A-plus. ${rec}, then the trophy. That's a complete season, start to finish.`:
        pct>.5?pick(story,[`A-plus. Nobody hangs a banner for ${rec}. They hang one for the title, and that's what they've got.`,`A-plus. ${rec} is the footnote. Champions is the headline.`],'review:title'):
        `A-plus, and I don't want to hear about ${rec}. Nobody gave them a chance. They won it anyway.`));
      if(gap!==null)body.push(turn(3,gap<0?`And it wasn't supposed to happen. They were outscored by ${margin} a night in the regular season. Teams with that profile don't win titles. This one did.`:
        pct<.6?`The regular season undersold them. ${ppg} scored, ${opp} allowed, plus ${margin} a night. The margin said they were better than ${rec}.`:
        `${ppg} scored, ${opp} allowed, plus ${margin} a night. The numbers said champion all year.`));
      body.push(turn(2,pct<.6?pick(story,["They peaked when it counted. The regular season was the warm-up.","That's a team that figured it out at exactly the right time."],'review:peak'):
        "And they never let up. Hard to stay that good for that long."));
      if(fin&&oppNick)body.push(turn(0,fin.firstTo<=1?`And they finished it by beating ${oppNick} in the ${fin.round}.`:fin.losses===0?`And they swept ${oppNick} in the ${fin.round}.`:`And they beat ${oppNick}${seriesText(fin)} in the ${fin.round}.`));
      if(snap?.roundsWon>=3&&pct<=.55)body.push(turn(3,`${cap(C.num(snap.roundsWon))} rounds won from a ${rec} start. Remember that the next time somebody writes a team off in the regular season.`));
      if(scorer){body.push(turn(0,`Who led the way?`));body.push(turn(2,`${scorer[0]}. ${Number(scorer[2]).toFixed(1)} points a game, team high. And now a champion.`));body.push(turn(1,`Put some respect on that name.`));}
      return frame(story,'review-title',[`${cap(T.nick)} went ${rec} in the regular season and finished as champions. ${J}, grade it.`,`From ${rec} to a title. ${J}, grade ${C.possessive(T.nick)} season.`,`${T.display}: champions. That's the whole review. ${J}?`],
        ["Enjoy it. They earned every bit of it.","Banner season. Congratulations.","That's how you end a season.","Champions. Nothing else to say."],body);
    }
    if(result==='runnerup'){
      body.push(turn(1,`It stings, but it's a great season. ${rec}, and ${college?'one game':'one series'} from a title.`));
      if(fin&&oppNick)body.push(turn(3,fin.firstTo>1?`${cap(oppNick)} took the ${fin.round}${seriesText(fin)}. ${fin.wins>0?`${cap(T.nick)} made them earn it.`:"That one got away fast."}`:`${cap(oppNick)} won the title game. One night, and it went the other way.`));
      body.push(turn(2,pct<.55?`Nobody expected them there off a ${rec} season. That's real progress.`:"Now they know what it takes. Get back and finish it."));
      if(scorer){body.push(turn(0,`Who carried them?`));body.push(turn(2,`${scorer[0]}. ${Number(scorer[2]).toFixed(1)} points a game, team high.`));}
      return frame(story,'review-runnerup',[`${cap(T.nick)} got all the way to the ${fin?.round||'final'}. ${J}, how do you grade it?`,`One step short for ${T.nick}. ${J}?`],
        ["So close. They'll be back.","A great run that ended one step early.","That one will hurt for a while, and it should."],body);
    }
    // A run is the story for an underdog or a team that reached the last four;
    // a favorite going out earlier fell short, however many rounds it won.
    const lastFour=fin&&/semifinal|Final Four/i.test(fin.round),favorite=pct>=.6;
    if(result==='eliminated'&&snap?.roundsWon>0&&(!favorite||lastFour)){
      body.push(turn(1,pct<.5?`I'll take it. ${rec} and they won ${snap.roundsWon===1?'a round':`${C.num(snap.roundsWon)} rounds`}. Nobody saw that coming.`:`Good season. ${rec}, and a run to the ${fin?.round}.`));
      if(fin&&oppNick)body.push(turn(3,fin.firstTo>1?`${cap(oppNick)} ended it in the ${fin.round},${seriesText(fin)}.`:`${cap(oppNick)} ended it in the ${fin.round}.`));
      body.push(turn(2,"They found something in the postseason. That's the part to build on."));
      if(scorer){body.push(turn(0,`Who carried them?`));body.push(turn(2,`${scorer[0]}. ${Number(scorer[2]).toFixed(1)} points a game, team high.`));}
      return frame(story,'review-run',[`${cap(T.nick)} made a run to the ${fin?.round||'later rounds'}. ${J}?`,`${T.display}: ${rec}, then a ${college?'tournament':'playoff'} run. ${J}, grade it.`],
        ["A run worth remembering.","They'll take a lot from that one.","Good season. Not the ending they wanted."],body);
    }
    if(result==='eliminated'&&favorite&&snap?.roundsWon>0){
      body.push(turn(1,`${rec} and out in the ${fin?.round}. For a team this good, that's short.`));
      if(fin&&oppNick)body.push(turn(3,fin.firstTo>1?`${cap(oppNick)} took the series${seriesText(fin)}.${fin.wins===0?' Swept.':''}`:`${cap(oppNick)} sent them home in the ${fin.round}.`));
      body.push(turn(2,"They won a round, sure. But a regular season like that sets the bar higher."));
      if(scorer){body.push(turn(0,`Who carried them?`));body.push(turn(2,`${scorer[0]}. ${Number(scorer[2]).toFixed(1)} points a game, team high.`));}
      return frame(story,'review-short',[`${cap(T.nick)}: ${rec}, then out in the ${fin?.round||'playoffs'}. ${J}?`,`A ${rec} season that ended early for ${T.nick}. ${J}, grade it.`],
        ["They'll want more next year.","The bar's higher now.","Good regular season. Short postseason."],body);
    }
    if(result==='eliminated'){
      body.push(turn(1,pct>.55?`Disappointing. ${rec} and out in the first round. That's not the finish a winning team wants.`:pct<.5?`${rec} and they still made the ${field}. Getting there was the win.`:`${rec}, one round, done. About what the record said.`));
      if(fin&&oppNick)body.push(turn(3,fin.firstTo>1?`${cap(oppNick)} took the series${seriesText(fin)}.${fin.wins===0?' Not much of a fight.':''}`:`${cap(oppNick)} sent them home in the ${fin.round}.`));
      body.push(turn(2,pct>.55?"The regular season was good. The postseason is what people remember.":"Get back there and win a round next time."));
      return frame(story,'review-out',[`${cap(T.nick)}: ${rec} and a first-round exit. ${J}?`,`An early ${field} exit for ${T.nick}. ${J}, grade it.`],
        ["They'll want more next year.","The offseason starts now.","Short postseason. Long summer."],body);
    }
    if(result==='alive')return seasonScript(story,n);
    if(result==='missed'&&team.r.W>team.r.L){
      body.push(turn(1,`${rec} and no ${college?'tournament':'postseason'}. That's the frustrating part. You win more than you lose and still go home.`));
      if(gap!==null)body.push(turn(3,`${ppg} scored, ${opp} allowed. ${gap>0?"They were better than the result.":"The margin explains it."}`));
      body.push(turn(2,"A couple of wins either way and this is a different conversation."));
      return frame(story,'review-missed',[`${cap(T.nick)} finished ${rec} and missed the ${field}. ${J}?`,`Left out at ${rec}. ${J}, grade it.`],["So close to the field.","They'll want those losses back.","That one's going to bug them all summer."],body);
    }
    return seasonScript(story,n);
  }
  function seasonScript(story,n=first()){
    const teams=teamRecords(story).sort((a,b)=>b.r.W-a.r.W||a.r.L-b.r.L);if(!teams.length)return genericScript(story,n);
    const team=teams[0],T=C.teamRef({name:team.name}),ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP'),gap=ppg!==null&&opp!==null?(team.r.PTS-team.r.OPP)/team.r.GP:null,J=n[1];
    const pctW=team.r.W/Math.max(1,team.r.W+team.r.L);
    const body=[turn(1,`${team.r.W}-${team.r.L}. ${pctW>=.7?`That's a contender. I don't want to hear otherwise.`:pctW>.5?"Winning record. Good, not great. I want more.":pctW<.5?"Too many losses. That's not good enough, and everybody in that building knows it.":"Right in the middle. A .500 team. Which is the worst place to be, if you ask me."}`)];
    if(gap!==null){
      body.push(turn(3,`I'd look at the scoring margin. ${ppg} a game, ${opp} allowed. That's ${Math.abs(gap).toFixed(1)} points a game ${gap>=0?'in their favor':'in the wrong direction'}. ${gap>0?"That's a team that outscored people.":gap<0?"That's a team that got outscored.":"Dead even."}`));
      body.push(turn(2,gap>0?"And that's sustainable. Margin tells you more than a couple of lucky wins.":"Find a few more points or give up a few less. That's the whole offseason."));
    }
    const table=story.seasonSnapshot?.tables?.find(t=>t.label==='Regular-season player statistics');
    const scorer=[...(table?.rows||[])].filter(r=>r[2]!==null&&r[2]!==''&&r[2]!=='—'&&Number.isFinite(Number(r[2]))).sort((a,b)=>Number(b[2])-Number(a[2]))[0];
    if(scorer){
      body.push(turn(0,`Who's carrying them?`));
      body.push(turn(2,`${scorer[0]}. ${Number(scorer[2]).toFixed(1)} points a game, team high. That's the go-to option.`));
      body.push(turn(1,"And that's the question. Who's the second option? One player can't do it all."));
    }else if(story.type==='Regular-season review'&&teams[1]){
      const other=teams[1];body.push(turn(1,`And don't forget ${C.teamRef({name:other.name}).nick} at ${other.r.W}-${other.r.L}. ${team.r.W===other.r.W&&team.r.L===other.r.L?"Same record. Nobody separated.":"They were right there."}`));
    }
    const verdict=team.r.W>team.r.L?'a winning season':team.r.W<team.r.L?'a losing season':'a .500 season';
    return frame(story,'season',[`${cap(T.full)} ${C.verb(T,'finish')} with ${verdict}. ${J}, grade it.`,`${cap(verdict)} for ${T.nick}. ${J}, are you satisfied?`,`${T.display}: regular season's in the books. ${J}?`,`Let's put a bow on ${possessive(T.nick)} regular season. ${J}?`],
      ["They'll want more next year.","That's the season. On to what's next.","We'll see what they do with it.","Grade's in. Moving on."],body);
  }
  function leadersScript(story,n=first()){
    const rows=(story.seasonSnapshot?.rows||[]).filter(r=>labels[r[0]]&&valid(r[2])&&r[3]>0);
    if(!rows.length)return genericScript(story,n);
    const categories=[...new Set(rows.map(r=>r[0]))].slice(0,2),body=[];
    for(const [i,k] of categories.entries()){
      const tied=rows.filter(r=>r[0]===k),names=join(tied.map(r=>r[1])),value=(tied[0][2]/tied[0][3]).toFixed(1);
      if(i)body.push(turn(0,`${n[2]}, who else stood out?`));
      // The opening already named the first leader; after that it's the last name.
      const who=!i&&tied.length===1?C.surname(tied[0][1]):names;
      body.push(turn(i?2:1,`${who} ${tied.length===1?'led':'shared the lead'} in ${labels[k]} at ${value} a game. ${k==='PTS'?"Bucket-getter. That's an average, not one big night.":k==='REB'?"Somebody has to do the dirty work on the glass.":"There's more to this game than scoring."}`));
      const honor=(story.seasonSnapshot.leaderHonors||[]).find(h=>h.category===k&&tied.some(r=>h.name===r[1]));
      if(honor)for(const line of Season.honorLines({...story,seasonSnapshot:{...story.seasonSnapshot,honorHistory:honor}}).slice(0,1))body.push(turn(3,line.split(honor.name).join(C.surname(honor.name))));
      body.push(turn(3,i?`${tied.length>1?"They split that one.":"Strong season in that category."} ${k==='REB'?"Rebounding wins you possessions.":"Different players bring different things. You need all of it."}`:
        `${tied.length>1?"Can't leave either name out. They split it.":`And that's over ${tied[0][3]} games, Jordan. Not a hot streak.`}`));
    }
    const lead=join(rows.filter(r=>r[0]===categories[0]).map(r=>r[1])),category=labels[categories[0]],shared=rows.filter(r=>r[0]===categories[0]).length>1;
    return frame(story,'leaders',[`${lead} ${shared?'shared the lead':'finished on top'} in ${category}. ${n[1]}, start us off.`,`Let's talk league leaders. ${cap(category)} first: ${lead}. ${n[1]}?`,`The stat sheet's final. ${lead} on top in ${category}. ${n[1]}?`,`${lead} ${shared?'finish together at':'finishes at'} the top in ${category}. ${n[1]}, is that the best player in the league?`],
      ["Those are the names at the top.","More than one way to leave a mark on a season.","Good seasons from the leaders.","That's your leaderboard. Argue amongst yourselves."],body);
  }
  function genericScript(story,n=first()){
    const headline=sentence(String(story.headline||'More news from around the league'));
    const paragraphs=(story.paragraphs||[]).filter(p=>typeof p==='string'&&!/[“”"]/.test(p)&&p!==story.headline&&p.length<=240);
    // Anchors rewrite a headline into a sentence; the article's lede already is one.
    const lede=paragraphs[0]&&paragraphs[0].length<=200?paragraphs[0]:null;
    const detail=paragraphs.find(p=>p!==lede&&!p.startsWith(String(story.headline)));
    const type=story.type||'',J=detail?n[2]:n[1],evidence=story.seasonSnapshot?.evidence||[];
    const openings=lede?[`${lede} ${J}?`,`Around the league: ${lede}`,`News of the day. ${lede}`,`Here's the latest. ${lede} ${J}, your reaction.`]:[`${headline} ${J}?`,`Around the league: ${headline}`,`News of the day. ${headline}`,`Here's the latest. ${headline}`];
    const take=/trade request/i.test(type)?["That's a bad sign for the franchise. You don't ask out when things are going well.","Here we go. Once a player asks out, there's no putting that genie back in the bottle."]:
      /draft declaration/i.test(type)?["Good for the kid. Bet on yourself.","Big decision. Now it's about where they land."]:
      /injury return/i.test(type)?["That's a big boost. You don't realize what you're missing until it's gone.","Welcome back. Now let's see how fast they can get up to speed."]:
      /injury/i.test(type)?["That hurts. Somebody else has to step up now.","Brutal news. That's a real hole in that rotation."]:
      /trade/i.test(type)?["I like it. Somebody's trying to get better.","Interesting move. I want to see how it fits before I hand out grades."]:
      /sign|commit|option|extend/i.test(type)?["Good business. You keep your guys, you build continuity.","I like the move. Now earn it."]:
      /retir|hall|jersey/i.test(type)?["Give it up for that career. That deserves a moment.","That's a legacy. Take a second and appreciate it."]:
      /coach/i.test(type)?["Coaching changes always come with pressure. Now we find out if it was the right call.","That's a big decision. The next hire has to be right."]:
      /team record/i.test(type)?(/low/i.test(story.headline||'')||evidence.some(e=>/low/.test(e.label))?["That's ugly. I don't know what else to say about that. You have to score.","Rock bottom. The only good news is it can't get much worse."]:["The offense was cooking. Best scoring night of the year, and I'm here for it.","That's what it looks like when everything's falling."]):
      /record watch/i.test(type)?["Get your popcorn ready. That record's in trouble.","I want to see this one fall. Go get it."]:
      /milestone/i.test(type)?["That's a lot of buckets. Longevity matters, and that's proof.","Put that on the résumé. Milestones don't happen by accident."]:
      /record/i.test(type)?["That's history. Put it in the books.","That's a number that's going to stick around for a while."]:
      ["Something to keep an eye on.","Noted. We'll see where it goes."];
    const closings=/trade request/i.test(type)?["No deal yet. We'll see how the team handles it.","Now we wait to see whether a trade happens.","The clock's ticking on that one.","Stay tuned. These things move fast."]:
      /draft/i.test(type)?["Now we wait for draft day.","The declaration's official. The pick comes later.","Big decision. We'll see where it lands.","Draft night just got more interesting."]:
      /injury return/i.test(type)?["Good to have another body back.","Now the attention turns to getting back on the floor.","Welcome back. Let's see the rust come off.","A healthy roster is a dangerous roster."]:
      /injury/i.test(type)?["We'll watch for an update on the return.","For now, it's next man up.","Get well soon. That one stings.","Somebody's getting more minutes. Let's see who takes them."]:
      /team record/i.test(type)?["That's the number of the night.","Moving on.","We'll see if it holds up.","Next topic."]:
      /record/i.test(type)?["Put it in the books.","We'll keep watching the record book.","History made. Moving on.","That one's going in the archive."]:
      ["We'll keep an eye on that.","We'll come back to it when there's more to report.","Something to keep an eye on around the league.","Moving on."];
    const body=detail?[turn(2,detail),turn(1,pick(story,take,'brief:take'))]:[turn(1,pick(story,take,'brief:take'))];
    return frame(story,'brief',openings,closings,body.slice(0,2));
  }
  // Offseason roundups: the desk argues about the names at the top.
  function roundupScript(story,n=first()){
    const r=story.seasonSnapshot.roundup,items=r.items||[],top=items[0];if(!top)return genericScript(story,n);
    const T=x=>C.teamRef({city:x.teamCity,name:x.teamNickname||x.team}).nick,line=c=>c?`${c.PTS} points${c.REB?` and ${c.REB} rebounds`:''}`:'',last=x=>C.surname(x.name),[M,J,A,N]=n;
    const body=[];let open,close;
    if(r.type===2){
      const second=items[1],third=items[2],sleeper=items.slice(3).filter(x=>x.college).sort((a,b)=>Number(b.college.PTS)-Number(a.college.PTS))[0];
      open=pick(story,[`${cap(T(top))} ${C.verb(C.teamRef({city:top.teamCity,name:top.teamNickname||top.team}),'take')} ${top.name} No. ${top.pick||1}. ${J}, grade the pick.`,`The draft's in the books, and ${top.name} goes first to ${T(top)}. ${J}?`,`${top.name}, No. ${top.pick||1} overall. ${J}, did ${T(top)} get it right?`,`Draft night. ${top.name} to ${T(top)} at the top. ${J}, go.`],'draft:open');
      body.push(turn(1,top.college?pick(story,[`I like it. ${line(top.college)} in college. You don't overthink the top pick.`,`Solid, not spectacular. ${line(top.college)} in college is good. I want to see it translate.`,`A-minus. ${last(top)} can play, and ${T(top)} needed somebody who can play.`],'draft:take'):`I like it. You don't overthink the top pick.`));
      if(second)body.push(turn(3,`${second.name} went second to ${T(second)}${second.college?` after ${line(second.college)} a night in college`:''}.${third?` ${third.name} went third to ${T(third)}${third.college?`, ${third.college.PTS} points a night`:''}.`:''}`));
      if(sleeper&&Number(sleeper.college.PTS)>Number(top.college?.PTS||0))body.push(turn(2,`My guy is ${sleeper.name} at No. ${sleeper.pick}. ${sleeper.college.PTS} points a night in college, more than the top pick. ${cap(T(sleeper))} might have gotten a steal.`),turn(1,`Steal is a strong word, ${A}. Let's see the kid play first.`));
      body.push(turn(3,`${C.plural(r.count,'player')} drafted in all. Most of them are going to fight for minutes.`));
      close=pick(story,["Grades are in. Now they have to play.","Draft night is about hope. Now comes the hard part.","We'll revisit these grades in a year. Somebody's going to look silly.","That's the draft. On to free agency."],'draft:close');
    }else if(r.type===3){
      const vets=items.filter(x=>!x.rookie),rookies=r.count-vets.length;
      open=vets.length?pick(story,[`Free agency is moving. ${top.name} signs with ${T(top)}. ${J}, winners and losers?`,`Big signing: ${top.name} to ${T(top)}. ${J}?`,`${top.name} has a new home: ${T(top)}. ${J}, your reaction.`,`Let's talk free agency. ${top.name} to ${T(top)}. ${J}?`],'fa:open'):
        pick(story,[`${C.capitalize(C.plural(r.count,'rookie'))} put pen to paper. ${J}, anything there?`,`Rookie contracts are signed. ${top.name} leads the way with ${T(top)}. ${J}?`],'fa:open');
      if(vets.length){
        body.push(turn(1,top.last?.PTS?`${top.last.PTS} points a night last year. ${cap(T(top))} just got better. I don't need to overthink that.`:`I like the fit. ${cap(T(top))} needed bodies, and they got a real one.`));
        body.push(turn(2,top.years?`${C.capitalize(C.num(top.years))} years, though. That's a real commitment.${top.age?` ${last(top)}'s ${top.age}.`:''}`:`I want to see where ${last(top)} fits in that rotation before I start celebrating.`));
        if(vets.length>1)body.push(turn(3,`Also moving: ${join(vets.slice(1,4).map(x=>`${x.name} to ${T(x)}`))}.${rookies?` And ${C.plural(rookies,'rookie')} signed first deals.`:''}`));
      }else body.push(turn(1,"Rookie contracts don't win championships. Wake me up when a real free agent moves."),turn(3,`Mostly rookie deals, Jordan. ${top.name} with ${T(top)} is the headliner.`));
      close=pick(story,["The market's open. We'll keep tracking it.","More moves to come. Stay tuned.","Free agency isn't over. Not even close.","That's the latest from the market."],'fa:close');
    }else if(r.type==='draft-watch'){
      const word={'Fr.':'freshman','So.':'sophomore','Jr.':'junior','Sr.':'senior'}[top.year]||'player',sleeper=items.slice(1,4).find(x=>Number(x.season?.PTS)<8);
      open=pick(story,[`Draft watch. ${top.name} sits atop our big board. ${J}, is that the right No. 1?`,`The college season's over, so let's talk draft. ${top.name} is our top prospect. ${J}?`,`${top.name} tops the HoopWire big board. ${J}, go.`],'watch:open');
      body.push(turn(1,top.season?.PTS?`I'm good with it. ${top.season.PTS} points and ${top.season.REB} rebounds as a ${word}. That's a pro.`:`I'm good with it. You bet on that kind of talent.`));
      if(!top.senior)body.push(turn(2,`The question is whether ${last(top)} comes out. There's eligibility left, but you don't stay at the top of a board forever.`));
      if(sleeper)body.push(turn(3,`${sleeper.name} is on that board at ${sleeper.season.PTS} points a game. That's a bet on the ceiling.`),turn(1,`That's a projection pick. Show me production.`));
      if(Number.isInteger(r.seniors))body.push(turn(3,r.seniors?`${cap(C.num(r.seniors))} of our top ten are seniors. The rest would have to declare early.`:`Not one senior in our top ten. Every one of them would have to declare early.`));
      close=pick(story,["The board will move. It always does.","Draft night is a long way off.","We'll update the board as the decisions come in."],'watch:close');
    }else if(r.type==='seniors'){
      open=pick(story,[`Last call for the seniors. ${top.name} leads the class out the door. ${J}?`,`The senior class has played its last college game. ${top.name} headlines it. ${J}?`],'sen:open');
      body.push(turn(1,`${top.season?.PTS} a night in a final season. That's how you go out.`));
      if(items.length>1)body.push(turn(3,`Also out of eligibility: ${join(items.slice(1,4).map(x=>`${x.name} at ${x.season?.PTS}`))}.`));
      body.push(turn(2,`Some of them get drafted. Some of them don't. Either way, that chapter's closed.`));
      close=pick(story,["Tip of the cap to the seniors.","That's a class that gave us a lot.","Draft night decides the rest."],'sen:close');
    }else if(r.type==='draft-class'){
      open=pick(story,[`The draft class is set. ${C.capitalize(C.plural(r.count,'college player'))} are in it, led by ${top.name}. ${J}?`,`${top.name} is officially headed to the draft. ${J}, the class as a whole?`],'class:open');
      body.push(turn(1,top.season?.PTS?`${top.season.PTS} a night as a ${({'Fr.':'freshman','So.':'sophomore','Jr.':'junior','Sr.':'senior'})[top.year]||'player'}. He's ready. I'm not worried about that one.`.replace(/He's ready/,top.pronoun==='she'?"She's ready":top.pronoun==='he'?"He's ready":`${C.surname(top.name)}'s ready`):`I like the top of this class.`));
      if(r.fresh)body.push(turn(2,`${C.capitalize(C.num(r.fresh))} of them played one college season. One. That's a lot of projection.`),turn(1,`That's the game now, ${A}. Talent goes when it's ready.`));
      if(items.length>1)body.push(turn(3,`Also in the class: ${join(items.slice(1,4).map(x=>`${x.name} out of ${x.teamCity||x.team}`))}.`));
      close=pick(story,["Now the pros get their look.","Draft night is next.","Plenty of rosters just got thinner."],'class:close');
    }else if(r.type==='preseason-poll'){
      const teams=r.teams||[],first=teams[0];if(!first)return genericScript(story,n);
      const ref=x=>C.teamRef({city:x.teamCity,name:x.teamNickname||x.team}),TT=x=>ref(x).nick;
      open=pick(story,[`The preseason poll is out, and ${TT(first)} ${C.verb(ref(first),'are')} No. 1. ${J}, agree?`,`${cap(TT(first))} ${C.verb(ref(first),'open')} the season at the top of the poll. ${J}?`],'pre:open');
      body.push(turn(1,first.recruiting?`It's the freshmen. ${C.capitalize(C.plural(first.freshmen,'recruit'))}${first.eliteFreshmen?`, ${C.num(first.eliteFreshmen)} of them blue-chippers`:''}${first.starters===0?', and no starters back':''}. The voters are betting on that class. I need to see it on the floor.`:first.starters===0?`No starters back and they're No. 1? The voters are betting on talent. I need to see it.`:first.starters>=4?`${C.capitalize(C.num(first.starters))} starters back. Hard to argue with that.`:`I'll take it. ${first.star?`${first.star} at ${first.starPTS} a night is a good place to start.`:'Talent wins.'}`));
      if(r.champion)body.push(turn(2,r.championRank&&r.championRank<=25?`The defending champs at No. ${r.championRank}. They'll have something to say about that.`:`And the defending champs start unranked. That's going to be on the locker-room wall.`));
      if(teams.length>1)body.push(turn(3,`Rounding out the top five: ${join(teams.slice(1,5).map(x=>ref(x).short))}.`));
      close=pick(story,["Now go play the games.","Polls are for the preseason. The season is for proving them wrong.","Ask us again in a month."],'pre:close');
    }else if(r.type==='returning'){
      open=pick(story,[`Let's look at who's back. ${top.name} is the best returning scorer in the country. ${J}?`,`Who's back this season? ${top.name} leads the list. ${J}?`,`${top.name}, ${top.season?.PTS} points a game last season, and back for more. ${J}?`],'back:open');
      body.push(turn(1,`${top.season?.PTS} a night, and ${last(top)} is back? That's trouble for everybody else.`));
      if(items.length>1)body.push(turn(3,`Also back: ${join(items.slice(1,4).map(x=>`${x.name} at ${x.season?.PTS}`))}.`));
      body.push(turn(2,`Experience matters in this sport. Those teams know what they've got.`));
      close=pick(story,["The season's taking shape.","That's who's back.","Now let's see what they do with it."],'back:close');
    }else if(r.type==='early-top-ten'){
      const teams=r.teams||[],first=teams[0];if(!first)return genericScript(story,n);
      const ref=x=>C.teamRef({city:x.teamCity,name:x.teamNickname||x.team}),TT=x=>ref(x).nick,rank=r.championRank;
      open=pick(story,[`Way-too-early top 10. We've got ${TT(first)} at No. 1. ${J}, agree?`,`It's never too early. ${cap(TT(first))} ${C.verb(ref(first),'open')} next season at No. 1 on our list. ${J}?`,`Our early top 10 is out, and ${TT(first)} ${C.verb(ref(first),'are')} on top. ${J}, go.`],'early:open');
      const starters=first.starters>0?(first.startersBack===first.starters?`All ${C.num(first.starters)} starters back`:first.startersBack?`${cap(C.num(first.startersBack))} starters back`:`No starters back`):null;
      body.push(turn(1,starters?`I'll take it. ${starters}, and ${first.star} at ${first.starPTS} a night. That's a real start.`:`I'll take it. ${first.star} at ${first.starPTS} a night is a real start.`));
      if(rank&&r.champion)body.push(turn(2,rank===1?`Hard to argue. The champs bring back enough to do it again.`:rank>10?`The defending champs aren't even in the top ten? I'd keep the champs higher until somebody knocks them off.`:`The defending champs at No. ${rank}? I'd keep the champs higher until somebody knocks them off.`));
      if(teams.length>1)body.push(turn(3,`Rounding out the top five: ${join(teams.slice(1,5).map(x=>ref(x).short))}.`));
      close=pick(story,["It's never too early.","Ask us again when the season opens.","Plenty of time for this list to look silly."],'early:close');
    }else if(r.type===14){
      open=pick(story,[`Recruiting news. ${top.name} commits to ${T(top)}. ${J}?`,`${C.capitalize(C.plural(r.count,'commitment'))} in one day, and ${top.name} headlines it. ${J}?`,`${top.name} picks ${T(top)}. ${J}, how big is that?`,`Signing day energy. ${top.name} to ${T(top)}. ${J}?`],'rec:open');
      body.push(turn(1,pick(story,[`That's a get. ${cap(T(top))} just won the day.`,`Huge. That's the kind of name that changes a program.`,`I love it. You recruit, you win. Simple.`],'rec:take')));
      if(items.length>1)body.push(turn(2,`Don't overlook the rest: ${join(items.slice(1,4).map(x=>`${x.name} to ${T(x)}`))}.`));
      body.push(turn(3,`${C.capitalize(C.plural(r.count,'recruit'))} made their choices. Plenty of rosters just changed.`));
      close=pick(story,["The recruiting trail never stops.","We'll see who pans out.","Programs get built on days like this.","That's the recruiting roundup."],'rec:close');
    }else{
      open=pick(story,[`${C.capitalize(C.plural(r.count,'player'))} have declared for the draft, led by ${top.name}. ${J}?`,`Early entrants: ${top.name} headlines the list. ${J}, ready for the pros?`,`${top.name} is turning pro. ${J}?`,`Draft declarations are in. ${top.name} leads the group. ${J}?`],'dec:open');
      body.push(turn(1,top.season?.PTS?`${top.season.PTS} a night. Go get paid. That's ready.`:`Bet on yourself. I respect it.`));
      if(items.length>1)body.push(turn(3,`Also declaring: ${join(items.slice(1,4).map(x=>`${x.name}${x.season?.PTS?` at ${x.season.PTS} points a game`:''}`))}.`));
      body.push(turn(2,`Not all of them are ready. Some of them are going to wish they'd stayed.`));
      close=pick(story,["Draft night just got more interesting.","Now we wait for draft day.","Big decisions all around.","That's the early-entry list."],'dec:close');
    }
    return [turn(0,open),...body,turn(0,close)];
  }
  // College seeding: a strong record, a poor seed, and a desk that can't believe it.
  function snubScript(story,n=first()){
    const x=story.seasonSnapshot?.snub,lead=x?.lead;if(!lead)return genericScript(story,n);
    const ref=t=>C.teamRef({city:t.teamCity,name:t.teamNickname||t.team}),T=t=>ref(t).nick,rec=t=>`${t.W}-${t.L}`,[M,J,A,N]=n;
    const body=[];
    const open=pick(story,[`The bracket is out, and ${T(lead)} ${C.verb(ref(lead),'have')} a complaint. ${rec(lead)} and a No. ${lead.seed} seed. ${J}?`,`${rec(lead)}, and ${T(lead)} get a ${lead.seed} seed. ${J}, explain that.`,`Seeding snub of the year: ${T(lead)}, ${rec(lead)}, seeded ${lead.seed}th. ${J}?`].map(t=>t.replace(/(\d+)th\b/,(m,d)=>`${d}${Number(d)%100>=11&&Number(d)%100<=13?'th':Number(d)%10===1?'st':Number(d)%10===2?'nd':Number(d)%10===3?'rd':'th'}`)),'snub:open');
    body.push(turn(1,pick(story,[`That's a robbery. You win ${lead.W} games, you should be hosting, not hoping.`,`I don't get it. ${lead.W} wins used to mean something.`,`Disrespect. Plain and simple. ${cap(T(lead))} earned better than that.`],'snub:take')));
    body.push(turn(3,lead.poll?`Here's why: the bracket follows the poll, and the poll had ${T(lead)} at No. ${lead.poll}. The record never moved the voters.`:`Here's why: the bracket follows the poll, not the standings.`));
    if(x.gift)body.push(turn(2,`And ${T(x.gift)} ${C.verb(ref(x.gift),'go')} ${rec(x.gift)} and ${C.verb(ref(x.gift),'get')} a No. ${x.gift.seed}? Explain that one to me.`),turn(1,`I can't. Nobody can.`));
    else if(x.company?.length)body.push(turn(2,`${cap(T(x.company[0]))} got the same treatment: ${rec(x.company[0])} and a No. ${x.company[0].seed}.`));
    if(x.left?.length)body.push(turn(3,`At least ${T(lead)} ${C.verb(ref(lead),'are')} in. ${cap(T(x.left[0]))} went ${rec(x.left[0])} and missed the field.`));
    const close=pick(story,["Somebody's playing with a chip on their shoulder.","Now go prove the voters wrong.","Seeds are just numbers once the ball goes up.","Circle that first game."],'snub:close');
    return [turn(0,open),...body,turn(0,close)];
  }
  function reportedReaction(story,n=first()){
    if(!story.quotesEnabled||!story.templateVersion)return [];
    const quotes=(story.paragraphs||[]).flatMap(p=>typeof p==='string'?[...p.matchAll(/[“"]([^”"]+)[”"]\s+([^.!?“"]+?) said\.(?:\s+[“"]([^”"]+)[”"])?/g)]:[]).filter(q=>q[1].length<=240);
    const q=quotes.find(q=>/\bcoach\s/.test(q[2]))||quotes[0];if(!q)return [];
    const coach=/\bcoach\s+(.+)$/.exec(q[2]),who=coach?`Coach ${coach[1]}`:q[2];
    const words=(q[1].replace(/,$/,'.')+(q[3]&&q[1].length+q[3].length<=200?' '+q[3]:'')).trim();
    const award=story.eventKey?.startsWith('award-')||story.type==='Award announcement',title=story.type==='Championship review'||story.eventKey==='championship';
    const response=award?pick(story,["Love that. You can hear what it means.","That's a coach who's been watching every day. That carries weight.","Humble. I respect it.","Well said. Now go get another one."],'quote:award'):
      title?pick(story,["That's a championship reaction I can understand. Let them enjoy it.","You can feel it. That's a group that went through something together."],'quote:title'):
      /consisten/i.test(words)?"Consistency. That's the challenge: doing it again next game, and the game after that.":/champion|title|finish the job/i.test(words)?"That's a championship reaction I can understand. Let them enjoy it.":
      /responsib|not good enough|higher|better|identity/i.test(words)?"Fair. Now show me. Saying it is the easy part.":/proud|earned/i.test(words)?"And they should be proud. That's a group that earned it.":/records|believ|chance|nothing to lose/i.test(words)?"That's a locker room that believes. I love that.":
      /disappoint|isn't the ending|wasn't the ending|bitter|hurts?\b/i.test(words)?pick(story,["That's honest. You can hear how much that one hurts.","You can hear it in that. They expected more."],'quote:hurt'):
      /film|clean up|get back to work/i.test(words)?"That's the right mentality. Enjoy the win, fix the mistakes.":null;
    return response?[turn(0,`Here's what ${who} had to say: “${words}”`),turn(pick(story,[1,2],'quote:reactor'),response)]:[];
  }
  function baseScript(story,context,n){
    if(story.performanceSnapshot)return Performance.script(story,n);
    if(story.seasonSnapshot?.roundup)return roundupScript(story,n);
    if(story.type==='Season leaders')return leadersScript(story,n);
    if(story.type==='Seeding snub')return snubScript(story,n);
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return awardScript(story,n);
    if(story.type==='Playoff preview'||story.eventKey?.startsWith('playoff-round-'))return playoffScript(story,n);
    if(story.type==='Championship review'||story.eventKey==='championship')return championshipScript(story,n);
    if(story.gameSummary)return gameScript(story,context,n);
    if(story.type==='Team season review')return teamReviewScript(story,n);
    if(story.type==='Regular-season review')return seasonScript(story,n);
    return genericScript(story,n);
  }
  // AP style, as in the articles: a lone count of one to nine is spelled out
  // ("six straight", "three steals"). Scores, records, splits ("7 for 10"),
  // decimals, ranks and game numbers stay as figures.
  const countNouns='straight|in a row|wins?|losses|loss|games?|points?|rebounds?|assists?|steals?|blocks?|turnovers?|threes?|times|rounds?|seasons?|years?|titles?|players?|teams?|more|shots?|series';
  const countPattern=new RegExp(`(^|[^\\w.,#/–-])([1-9])(?=\\s+(?:${countNouns})\\b)`,'g');
  function apCounts(text){
    return String(text).replace(countPattern,(m,before,d,offset,whole)=>/(?:No\.|Game|Day|Week|Round|Season)\s*$/.test(whole.slice(Math.max(0,offset-8),offset+before.length))?m:before+C.num(Number(d)));
  }
  function script(story,context,names){
    if(!story)return [];
    context||=Context.buildContext(story);
    const n=first(names),turns=baseScript(story,context,n),reaction=reportedReaction(story,n),budget=turns.length<=4?4:14;
    if(reaction.length&&turns.length+reaction.length<=budget)turns.splice(turns.length-1,0,...reaction);
    // Back-to-back lines from one host read as a single answer.
    const merged=[];
    for(const t of turns){const last=merged.at(-1);if(last&&last.speaker===t.speaker)last.text+=' '+t.text;else merged.push({...t});}
    return merged.map(t=>({...t,text:apCounts(t.text)}));
  }
  function episode(story,names=defaultNames,context){
    if(!story)return [];
    const n=first(names);
    return [
      turn(0,`Welcome to HoopWire TV! I'm ${names[0]}, and this is The Daily Desk.`),
      turn(1,`${names[1]}. I've got takes, and I'm not apologizing for any of them.`),turn(2,`${names[2]}, here to keep ${n[1]} honest.`),turn(3,`And I'm ${names[3]}, with the numbers. Let's get into it.`),
      ...script(story,context,names),
      turn(0,`That's the show. ${n[1]}, ${n[2]}, ${n[3]}, thank you.`),
      turn(1,"Always a pleasure. Even when they're wrong."),
      turn(0,`For ${names[1]}, ${names[2]} and ${names[3]}, I'm ${names[0]}. Thanks for watching HoopWire TV. We'll see you next time!`)
    ];
  }
  return {script,episode,chunkDialogue,selectEvidence,selectAngle,supportingThreads,policy,awardScript,playoffScript,championshipScript,gameScript,genericScript,seasonScript,leadersScript};
});
