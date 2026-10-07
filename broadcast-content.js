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
    const winnerPre=preRecord(context.game,homeWon?'home':'away',true),loserPre=preRecord(context.game,homeWon?'away':'home',false);
    const percentage=r=>r[0]/(r[0]+r[1]);
    const upset=winnerPre&&loserPre&&winnerPre.reduce((a,b)=>a+b)>=policy.upsetGames&&loserPre.reduce((a,b)=>a+b)>=policy.upsetGames&&percentage(loserPre)-percentage(winnerPre)>policy.upsetGap;
    const histories=[winner,loser].map(team=>({team,ref:team===winner?W:L,history:context.teams?.[team.id]}));
    const streak=histories.find(x=>x.history?.streak?.ended?.length>=policy.streak)||histories
      .filter(x=>x.history?.streak?.length>=policy.streak)
      .sort((a,b)=>b.history.streak.length-a.history.streak.length||Number(a.history.streak.won)-Number(b.history.streak.won))[0];
    const scale=Math.min(1,Math.max(.15,(winner.score+loser.score)/policy.fullGame));
    const ppg=average?.average?.GP>=policy.averageGames?rate(average.average,'PTS'):null;
    // Share of the scoring needs to know which side the player was on.
    const side=me?(me.team.id===winner.id?'winner':me.team.id===loser.id?'loser':null):null;
    const teamScore=side==='winner'?winner.score:side==='loser'?loser.score:null;
    const share=validCount(s.PTS)&&teamScore>0?s.PTS/teamScore:null;
    const exceptional=!!name&&(doubles.length>=3||s.PTS>=Math.max(8,policy.exceptionalPoints*scale)||
      (ppg!==null&&s.PTS-Number(ppg)>=Math.max(3,policy.aboveAverage*scale))||(share!==null&&share>=.45&&s.PTS>=6));
    // Consequences need explicit evidence, never a score or phase number.
    const consequence=context.consequence?.verified===true&&['championship','elimination'].includes(context.consequence.kind)?context.consequence:null;
    const player=name?{full:name,last:me?.player?.ln||C.surname(name),he:C.pronoun(me?.player)}:null;
    return {story,winner,loser,W,L,margin:winner.score-loser.score,name,player,s,average,ppg,doubles,upset,winnerPre,loserPre,streak,exceptional,consequence,box,side,share,teamScore,scale};
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
      championship:[`Your champions: ${W.full}! ${score}. ${J}, take it away.`,`${W.display}. Champions. ${score}. ${J}, say it.`,`${cap(W.nick)} ${C.verb(W,'win')} it all, ${ws}-${ls}. ${J}, how do we sum up this team?`,`It's over, and ${W.nick} ${C.verb(W,'are')} champions. ${score}. ${J}?`],
      elimination:[`${cap(L.nick)}' run is over. ${score}. ${J}?`.replace(`${cap(L.nick)}' `,C.possessive(cap(L.nick))+' '),`${cap(W.nick)} ${C.verb(W,'move')} on. ${cap(L.nick)} ${C.verb(L,'go')} home. ${score}. ${J}?`,`Season over for ${L.nick}. ${score}. ${J}, your thoughts.`,`${score}, and that ends it for ${L.nick}. ${J}?`]
    };
    return pick(story,leads[angle],angle+':opening');
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
        sf.won?[[1,`${sf.length} straight. At what point do we start taking ${sf.t.nick} seriously? Because I'm there.`],[2,`I'm getting there. You don't stack ${sf.length} wins by accident.`],[3,sf.victims.length?`And look who they've beaten: ${join(sf.victims)}. Say what you want about the schedule, ${sf.length} in a row is ${sf.length} in a row.`:`I want to see who they've been beating, but ${sf.length} in a row is ${sf.length} in a row.`]]:
          [[1,`${sf.length} in a row. At some point this stops being a slump and it's just who you are.`],[2,`That's harsh, Jordan.`],[1,`Is it wrong, though?`],[3,`It's not right yet. ${sf.length} games is a rough stretch, not a verdict. But they need to stop it soon.`]]
      ]:[[[1,`I'll take the win.`]]],
      performance:[
        [[1,`Come on. ${e.player?.last} was the best player on that floor and it wasn't close.`],[3,`You won't get an argument from me. That line speaks for itself.`]],
        [[1,`That's a star turn right there. When ${e.player?.last} plays like that, ${W.nick} are a different team.`.replace(` ${W.nick} are`,` ${W.nick} ${C.verb(W,'are')}`)],[3,`One game, Jordan. But it's a heck of a game.`]],
        [[1,`I need everybody to stop what they're doing and look at ${C.possessive(e.player?.last||'that')} line.`],[3,`I've seen it, Jordan. It holds up.`]]
      ],
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
          strong?say('strong-r',[`That's a bucket-getter. Didn't need volume. Just cashed in.`,`Give me that every night. You don't need 20 shots when you're making them.`,`Professional. That's a pro's night right there.`]):say('fine-r',[`Solid. I'd look at what else came with it before I get too high or too low.`,`Fine. I want to know what else was in that box score.`]),
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
    const contribution=['AST','REB','BLK','STL'].filter(k=>validCount(s[k])&&s[k]>=({AST:3,REB:5,BLK:2,STL:2}[k])).sort((a,b)=>s[b]-s[a])[0];
    // A scoring-only follow-up repeats the shooting discussion. Keep it when
    // it's the main story, or when we have another contribution to discuss.
    if(contribution||(validCount(s.PTS)&&(angle==='performance'||!threads.some(t=>t.key==='shooting')))){
      const stats=e.doubles.length>=3?e.doubles.map(k=>count(s[k],labels[k])):
        [validCount(s.PTS)?count(s.PTS,'points'):null,contribution?count(s[contribution],labels[contribution]):null].filter(Boolean);
      const share=e.share!==null&&e.side==='winner'?fraction(e.share):null;
      threads.push({key:'contribution',player:true,priority:angle==='performance'?110:75,speaker:2,
        question:say('contrib-q',[`${A}, what jumped out at you from ${p.last}?`,`${A}, what did you like from ${p.last}?`,`${A}, give me the full picture on ${p.last}.`]),
        detail:angle==='performance'&&e.doubles.length>=3?`Forget the points for a second. ${join(e.doubles.filter(k=>k!=='PTS').map(k=>count(s[k],labels[k])))}. ${e.doubles.includes('AST')?"I love the passing. That's somebody making the whole offense better.":"That's somebody doing everything."}`:
          `${p.full} finished with ${join(stats)}. ${contribution==='AST'?"I love the passing. That's somebody making the whole offense better.":contribution==='REB'?"And don't skip past the rebounds. That's work.":contribution?"That's real impact on the defensive end, too.":s.PTS===0?"Couldn't buy a bucket.":share?`That's ${share} of ${possessive(e.W.nick)} points.`:"That's where I start."}`,
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
  function awardScript(story,n=first()){
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
    const teams=teamRecords(story),round=Number(String(story.eventKey||'').split('-').at(-1)),J=n[1];
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
  function championshipScript(story,n=first()){
    const row=story.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.relatedTeams?.[0]?.name;
    if(!champ)return genericScript(story,n);
    const T=C.teamRef({name:champ}),J=n[1];
    const body=Season.honorLines(story).slice(0,2).map(text=>turn(3,text)),team=teamRecords(story).find(t=>t.name===champ);
    body.unshift(turn(1,pick(story,[`They did it! I don't want to hear anything negative about ${T.nick} today. Nothing.`,`Champions. Say it with me. That's the only word that matters now.`,`Whatever you thought about ${T.nick} at the start of the year, they're the last team standing.`],'title:take')));
    if(row[1]&&row[1]!=='Not available')body.push(turn(2,`And beating ${C.teamRef({name:row[1]}).nick} to finish it? That's a worthy final. That's the one they'll tell their kids about.`));
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
    return frame(story,'season',[`${T.display} finish with ${verdict}. ${J}, grade it.`,`${cap(verdict)} for ${T.nick}. ${J}, are you satisfied?`,`${T.display}: regular season's in the books. ${J}?`,`Let's put a bow on ${possessive(T.nick)} regular season. ${J}?`],
      ["They'll want more next year.","That's the season. On to what's next.","We'll see what they do with it.","Grade's in. Moving on."],body);
  }
  function leadersScript(story,n=first()){
    const rows=(story.seasonSnapshot?.rows||[]).filter(r=>labels[r[0]]&&valid(r[2])&&r[3]>0);
    if(!rows.length)return genericScript(story,n);
    const categories=[...new Set(rows.map(r=>r[0]))].slice(0,2),body=[];
    for(const [i,k] of categories.entries()){
      const tied=rows.filter(r=>r[0]===k),names=join(tied.map(r=>r[1])),value=(tied[0][2]/tied[0][3]).toFixed(1);
      if(i)body.push(turn(0,`${n[2]}, who else stood out?`));
      body.push(turn(i?2:1,`${names} ${tied.length===1?'leads':'share the lead'} in ${labels[k]} at ${value} a game. ${k==='PTS'?"Bucket-getter. That's an average, not one big night.":k==='REB'?"Somebody has to do the dirty work on the glass.":"There's more to this game than scoring."}`));
      const honor=(story.seasonSnapshot.leaderHonors||[]).find(h=>h.category===k&&tied.some(r=>h.name===r[1]));
      if(honor)for(const line of Season.honorLines({...story,seasonSnapshot:{...story.seasonSnapshot,honorHistory:honor}}).slice(0,1))body.push(turn(3,line));
      body.push(turn(3,i?`${tied.length>1?"They split that one.":"Strong season in that category."} ${k==='REB'?"Rebounding wins you possessions.":"Different players bring different things. You need all of it."}`:
        `${tied.length>1?"Can't leave either name out. They split it.":`And that's over ${tied[0][3]} games, Jordan. Not a hot streak.`}`));
    }
    const lead=join(rows.filter(r=>r[0]===categories[0]).map(r=>r[1])),category=labels[categories[0]],shared=rows.filter(r=>r[0]===categories[0]).length>1;
    return frame(story,'leaders',[`${lead} ${shared?'share the lead':'is the leader'} in ${category}. ${n[1]}, start us off.`,`Let's talk league leaders. ${cap(category)} first: ${lead}. ${n[1]}?`,`The stat sheet's final. ${lead} on top in ${category}. ${n[1]}?`,`${lead} ${shared?'finish together at':'finishes at'} the top in ${category}. ${n[1]}, is that the best player in the league?`],
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
  function reportedReaction(story,n=first()){
    if(!story.quotesEnabled||!story.templateVersion)return [];
    const quotes=(story.paragraphs||[]).flatMap(p=>typeof p==='string'?[...p.matchAll(/[“"]([^”"]+)[”"]\s+([^.!?“"]+?) said\.(?:\s+[“"]([^”"]+)[”"])?/g)]:[]).filter(q=>q[1].length<=240);
    const q=quotes.find(q=>/\bcoach\s/.test(q[2]))||quotes[0];if(!q)return [];
    const coach=/\bcoach\s+(.+)$/.exec(q[2]),who=coach?`Coach ${coach[1]}`:q[2];
    const words=(q[1].replace(/,$/,'.')+(q[3]&&q[1].length+q[3].length<=200?' '+q[3]:'')).trim();
    const response=/consisten/i.test(words)?"Consistency. That's the challenge: doing it again next game, and the game after that.":/champion|title|finish the job/i.test(words)?"That's a championship reaction I can understand. Let them enjoy it.":
      /responsib|not good enough|higher|better|identity/i.test(words)?"Fair. Now show me. Saying it is the easy part.":/proud|earned/i.test(words)?"And they should be proud. That's a group that earned it.":/records|believ|chance|nothing to lose/i.test(words)?"That's a locker room that believes. I love that.":
      /film|clean up|work/i.test(words)?"That's the right mentality. Enjoy the win, fix the mistakes.":null;
    return response?[turn(0,`Here's what ${who} had to say: “${words}”`),turn(pick(story,[1,2],'quote:reactor'),response)]:[];
  }
  function baseScript(story,context,n){
    if(story.performanceSnapshot)return Performance.script(story,n);
    if(story.type==='Season leaders')return leadersScript(story,n);
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return awardScript(story,n);
    if(story.type==='Playoff preview'||story.eventKey?.startsWith('playoff-round-'))return playoffScript(story,n);
    if(story.type==='Championship review'||story.eventKey==='championship')return championshipScript(story,n);
    if(story.gameSummary)return gameScript(story,context,n);
    if(['Team season review','Regular-season review'].includes(story.type))return seasonScript(story,n);
    return genericScript(story,n);
  }
  function script(story,context,names){
    if(!story)return [];
    context||=Context.buildContext(story);
    const n=first(names),turns=baseScript(story,context,n),reaction=reportedReaction(story,n),budget=turns.length<=4?4:14;
    if(reaction.length&&turns.length+reaction.length<=budget)turns.splice(turns.length-1,0,...reaction);
    return turns;
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
