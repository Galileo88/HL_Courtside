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
  function shotPair(s,made,attempts){return valid(s?.[made])&&valid(s?.[attempts])&&s[attempts]>0&&s[made]<=s[attempts];}
  function gameAnalysis(story,name,s,margin){
    const turns=[turn(0,pick(story,[`Let's stay with ${name} for a minute. What stands out beyond the points?`,`Before we move on, how would you evaluate ${name}'s night?`],3))];
    if(shotPair(s,'FGM','FGA')){
      const pct=s.FGM/s.FGA;
      turns.push(turn(3,pct>=.6?`To your point, the scoring looks even better when you look at the attempts. ${s.FGM} makes on ${s.FGA} shots. I'd take that kind of efficiency every night.`:pct<=.334?`The points are there, but ${s.FGA-s.FGM} of ${s.FGA} shots didn't fall. I'd want to look at the shot selection before treating the scoring as the whole story.`:`I'd start with the ${s.FGA} field-goal attempts. The points tell us the output; the shooting line helps us judge what it took to get there.`));
      if(shotPair(s,'TPM','TPA')&&s.TPA<=s.FGA&&s.TPM<=s.FGM){
        turns.push(turn(1,`${s.TPA} of those ${s.FGA} attempts were threes. ${s.TPM===0?"None went in. I'd want another way to get good looks when that shot isn't falling.":s.TPM/s.TPA>=.4?"That shot was paying off. If I'm preparing for the next matchup, taking away comfortable threes is high on my list.":"I'd ask whether those were the looks they wanted. The shooting line gives us a question to take into the next matchup."}`));
      }
    }else if(s.AST>=5)turns.push(turn(3,`For me, it's the ${s.AST} assists. That's production for teammates as well as individual scoring. I'd want the next opponent thinking about the pass, too.`));
    else if(s.REB>=5)turns.push(turn(2,`I'd start with the ${s.REB} rebounds. Scoring gets the headline, but collecting the ball is part of finishing a possession.`));
    else turns.push(turn(2,"I'd want to see how those points came. Shot selection and the work away from the ball would be my next questions."));
    if(valid(s.TO)){
      turns.push(turn(0,`Where do the ${count(s.TO,'turnovers')} fit into that assessment?`));
      turns.push(turn(2,s.TO===0?`That's a real positive for ${name}. No turnovers to put against the rest of that production.`:s.TO>=4?`That's the part I'd push back on. ${s.TO} giveaways are too many for my liking${valid(s.AST)?`, even with ${count(s.AST,'assists')}`:''}. I'd be asking how to keep the production and cut those mistakes.`:valid(s.AST)&&s.AST>s.TO?`${s.AST} assists against ${count(s.TO,'turnovers')}. I like that balance. There's room to clean it up without losing the passing.`:`I'd still bring them up. ${count(s.TO,'turnovers')} may not lead the discussion, but protecting the ball belongs in it.`));
    }
    const defense=['STL','BLK'].filter(k=>valid(s[k])&&s[k]>0);
    if(defense.length)turns.push(turn(3,`And that connects with the ${join(defense.map(k=>count(s[k],labels[k])))} we mentioned. Give those plays their credit. I'd still judge the rest of the defense separately; those numbers are only part of that conversation.`));
    const season=story.cumulativeStats?.season,ppg=rate(season,'PTS');
    if(ppg&&valid(s.PTS)&&season.GP>1){
      const difference=s.PTS-Number(ppg),period=story.cumulativeStats.period==='playoffs'?'playoff':'season';
      turns.push(turn(0,`Put that alongside the ${ppg} points a game ${period} average. How much does this performance change your view?`));
      turns.push(turn(1,Math.abs(difference)<3?`It's close to ${name}'s usual scoring level. That makes the rest of the line more interesting to me. What else are we getting along with the points?`:difference>0?`${s.PTS} points is above that average. Give the night its due, but I want to see that level again before I raise the expectation every game.`:`It's below the scoring average. That makes the other contributions worth discussing. I'd judge the whole night before calling it a disappointment.`));
    }
    turns.push(turn(0,`Let's take that to the next matchup. What's the first question you'd ask?`));
    turns.push(turn(3,margin<=3?"I'd ask how to get cleaner possessions. With that little separating the teams, shot selection and protecting the ball are where I'd begin.":margin>=20?"For the losing side, I'd start with which problem to address first. I'd review the possessions before deciding whether the bigger issue was their offense or their defense.":`I'd ask whether ${name} can produce that way again, and what the opponent will try to take away. That's the matchup I'd keep an eye on.`));
    return turns;
  }
  function reportedReaction(story){
    // Reuse the game's generated reporting without moving a postgame quote to
    // pregame or pretending that box-score data includes interviews or film.
    if(!story.quotesEnabled||!story.templateVersion)return [];
    const quotes=(story.paragraphs||[]).flatMap(p=>typeof p==='string'?[...p.matchAll(/[“"]([^”"]+)[”"]\s+([^.!?]+?) said\./g)]:[]).filter(q=>q[1].length<=240);
    const quote=quotes.find(q=>q[2].startsWith('head coach '))||quotes[0];
    if(!quote)return [];
    const coach=quote[2].startsWith('head coach '),speaker=quote[2].replace(/^head coach /,'');
    const response=/consisten/i.test(quote[1])?"That emphasis on consistency is worth following up on. I'd ask which part of their game they need to bring more reliably, and how they'll judge the improvement.":/compos|stay|together|connect/i.test(quote[1])?"That emphasis on staying together is interesting. I'd follow up by asking what they want from each player when a possession gets difficult.":/champion|title|finish the job/i.test(quote[1])?"You can hear how much the title matters. I'd ask which part of the run they'll remember most, before turning the conversation to what's next.":/responsib|not good enough|did not|higher|better/i.test(quote[1])?"There's a clear demand to get better there. I'd follow up with a basketball question: what is the first thing they're going to work on?":pick(story,["That's the message. My question is what it looks like on the floor next time. I'd want to hear which part they're planning to build on.","And that brings us back to the basketball. I'd ask what they want to carry forward and what they want to change. That's where the follow-up gets interesting."],4);
    return [turn(0,`Speaking of that, let's bring in ${coach?'Coach ':''}${speaker}'s reaction.`),turn(3,`${speaker} said, “${quote[1]}”`),turn(2,response)];
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
      turns.push(turn(0,`Let's stay on ${closest.row[0]} and ${closest.row[1]}. Where would you start with that matchup?`));
      const offense=rate(closest.a.r,'PTS'),allowed=rate(closest.b.r,'OPP');
      if(offense&&allowed)turns.push(turn(3,`${closest.row[0]} score ${offense} points a game. ${closest.row[1]} allow ${allowed}. I'd start with whether that offense can get its usual production against this opponent.`));
      else turns.push(turn(3,"I'd start with which team can get good shots without giving the ball away. The records give us the stakes; that would be my basketball question."));
      turns.push(turn(1,gap===0?"I'm with you. Matching records don't mean matching strengths. I want to see which side can make the other uncomfortable.":`And I wouldn't make those ${gap} wins the entire argument. They matter, but I'd still ask how the teams match up.`));
      turns.push(turn(2,closest.row[2]==='Single elimination'?"To your point, there's no chance to wait for the next game. I'd put a premium on taking care of the ball and finishing defensive possessions.":"That's why Game 1 interests me. What does each side try first, and what does the other coach decide to change? Keep that in mind as this round gets going."));
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
    if(s?.GP>0&&numbers(s)){
      turns.push(turn(0,`What makes ${name}'s case stand out to you?`));
      if(/defens/i.test(award))turns.push(turn(2,`I'd start with ${join(['STL','BLK'].filter(k=>rate(s,k)!==null).map(k=>`${rate(s,k)} ${labels[k]} a game`))||'the defensive impact'}. Those are contributions we can count. Positioning and covering for teammates are what I'd want to evaluate alongside them.`));
      else turns.push(turn(2,`${s.GP} game${s.GP===1?'':'s'} of production. ${s.GP===1?"It's a one-game sample, so I'd keep that in mind.":"That's what gives the averages weight. We're discussing a body of work."}`));
      turns.push(turn(3,`To your point, I'd judge how ${name} contributes across the line${rate(s,'AST')!==null?`, including ${rate(s,'AST')} assists a game`:''}. I'd want to know what the team can count on beyond the scoring.`));
      turns.push(turn(1,"And that's where I'd keep the standard high. Recognize the award, then ask what the next step looks like. Give the player credit and something to build toward."));
    }
    return turns;
  }
  function championshipScript(story){
    const row=story.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.relatedTeams?.[0]?.name||story.headline;
    const turns=[turn(0,`${champ} have won the championship!`)];
    if(row[1]&&row[1]!=='Not available')turns.push(turn(1,`They beat ${row[1]} for the title. Give them their credit. Nobody can argue with a championship.`));
    const record=teamRecords(story).find(x=>x.name===champ);
    if(record)turns.push(turn(2,`${record.r.W} wins in the regular season, and now a championship. That's the finish they wanted.`));
    turns.push(turn(3,`Enjoy it, ${champ} fans. You're bringing home a banner.`));
    turns.push(turn(0,`Now that ${champ} have the title, what would you ask them going into next season?`));
    turns.push(turn(2,"I'd ask which parts of this group they most want to keep together. Winning the title gives them a reason to believe in what they've built."));
    turns.push(turn(1,"I'm with you on keeping the strengths. I'd also ask where they can improve. The next opponent will be trying to find an answer to the champions."));
    turns.push(turn(3,"And that's the conversation for later. Right now, give the players and coaches their moment. They finished the job."));
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
      turns.push(...gameAnalysis(story,name,s,margin));
    }else{
      turns.push(turn(0,`What would you want to know about how ${winner.name} got that result?`));
      turns.push(turn(3,margin<=3?"I'd start with the possessions where either team had a chance to get a better shot. There's very little separating them on the scoreboard.":"I'd start with shot quality and protecting the ball. Those would be my first questions before drawing a bigger conclusion from the final score."));
      turns.push(turn(2,`And I'd ask what ${loser.name} want to change for the next meeting. That's how I'd take this discussion forward.`));
    }
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
    turns.push(turn(0,`So where would you start if you're planning the next step for ${team.name}?`));
    if(ppg&&opp){
      const gap=(team.r.PTS-team.r.OPP)/team.r.GP;
      turns.push(turn(3,gap>0?`The ${Math.abs(gap).toFixed(1)}-point scoring margin gives us something to build on. I'd ask which parts of their offense and defense they can keep producing against stronger opposition.`:gap<0?`I'd start with that ${Math.abs(gap).toFixed(1)}-point deficit per game. I'd look at both shot creation and defensive possessions before picking which end needs the most work.`:"They scored as much as they allowed on average. I'd look for where they can create a little more room, whether that's better shots or fewer giveaways."));
    }else turns.push(turn(3,"I'd start with what they can count on from night to night. Then I'd ask where the roster needs help to take the next step."));
    turns.push(turn(2,"To your point, I'd put rebounding and taking care of the ball in that discussion. Those are parts of a possession I want addressed alongside the scoring."));
    turns.push(turn(1,team.r.W>team.r.L?"And the winning record matters. Build on what worked, but give me a concrete answer about how this group gets better.":"The record leaves room to improve. I'd want the coaching staff to name the first problem they're going to tackle, and explain why."));
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
  function baseScript(story){
    if(!story)return [];
    if(story.eventKey?.startsWith('award-')||story.type==='Award announcement')return awardScript(story);
    if(story.type==='Playoff preview'||story.eventKey?.startsWith('playoff-round-'))return playoffScript(story);
    if(story.type==='Championship review'||story.eventKey==='championship')return championshipScript(story);
    if(story.gameSummary)return gameScript(story);
    if(['Team season review','Regular-season review'].includes(story.type))return seasonScript(story);
    return genericScript(story);
  }
  function script(story){return story?[...baseScript(story),...reportedReaction(story)]:[];}
  function episode(story,names=['Maya Brooks','Jordan Price','Andre Cole','Nina Reyes']){
    if(!story)return [];
    const opening=[
      turn(0,`Welcome to HoopWire TV! I'm ${names[0]}, and this is The Daily Desk.`),
      turn(1,`I'm ${names[1]}. Glad you're with us. Let's talk basketball.`),
      turn(2,`And I'm ${names[2]}. Ready to get into it.`),
      turn(3,`I'm ${names[3]}. We've got a lot to talk about, so let's get to it.`)
    ];
    const closing=[
      turn(0,"That wraps up today's show. Thanks for joining us at The Daily Desk."),
      turn(3,"Come back for the next show. We'll have more basketball to talk about."),
      turn(0,`For ${names[1]}, ${names[2]} and ${names[3]}, I'm ${names[0]}. Thanks for watching HoopWire TV. We'll see you next time!`)
    ];
    return [...opening,...script(story),...closing];
  }
  return {script,episode,chunkDialogue,awardScript,playoffScript,championshipScript,gameScript,genericScript,seasonScript};
});
