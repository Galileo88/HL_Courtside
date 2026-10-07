/* Original studio dialogue: lead with the story, use familiar basketball language,
   and let the other hosts respond to a specific fact. Box scores do not prove plays. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./season-coverage'),require('./broadcast-context'));
  else root.HoopWireBroadcastContent=factory(root.HoopWireSeason,root.HoopWireBroadcastContext);
})(globalThis,function(Season,Context){
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
      routine:[`${w.name} add another win to the ledger`,`${w.name} get the result against ${l.name}`,`A win for ${w.name}, and a loss for ${l.name}`,`${w.name} take this one`],
      close:[`Very little between ${w.name} and ${l.name}`,`Only ${e.margin} point${e.margin===1?'':'s'} separated these two`,`A close one goes to ${w.name}`,`${w.name} win, with almost nothing in it`],
      blowout:[`${w.name} leave ${l.name} with plenty to answer for`,`A decisive result for ${w.name}`,`${l.name} finish a long way off the pace`,`${w.name} win convincingly against ${l.name}`],
      upset:[`${w.name} turn the records on their head`,`The surprise here is ${w.name}`,`${l.name} had the stronger record; ${w.name} have the win`,`Give ${w.name} credit for beating the better-record team`],
      streak:[streakLead,`${streakLead}. That's the story tonight`,`${streakLead}. A result worth paying attention to`,`${streakLead}, and it changes the conversation`],
      performance:[`${name} gives us the headline with ${achievement}`,`${achievement} for ${name}. That deserves the spotlight`,`${name}'s night stands out: ${achievement}`,`Put ${name} at the center of this one: ${achievement}`],
      championship:[`${w.name} have won the championship`,`${w.name} finish the job with a title`,`The championship belongs to ${w.name}`,`${w.name} are champions`],
      elimination:[`${l.name}'s run is over`,`${w.name} end ${l.name}'s run`,`${l.name} have reached the end of the road`,`${w.name} advance; ${l.name} are out`]
    };
    return `${sentence(pick(story,leads[angle],angle+':opening'))} ${w.name} beat ${l.name}, ${w.score} to ${l.score}.`;
  }
  function angleResponse(story,e,angle){
    const {winner:w,loser:l,margin,streak,name}=e,st=streak?.history.streak;
    const options={
      routine:[`It's a ${margin}-point win. Give ${w.name} credit for the result, but there's no need to make an ordinary win into a declaration about the whole season.`,`A result like this belongs in the win column without needing a bigger label. ${w.name} have done enough to beat ${l.name}; that's the starting point.`],
      close:[`They'll take it. But a ${margin}-point margin doesn't give me much reason to separate these teams on this game alone. The result matters; the size of the gap matters too.`,`I wouldn't call this domination. ${l.name} finish within ${margin}, so the win and a convincing performance are two different judgments. Let's keep that distinction.`],
      blowout:[`${margin} points is a substantial gap. ${l.name} can't be satisfied with that. One result doesn't explain every problem, but this one certainly deserves an honest assessment.`,`Give ${w.name} the credit before we start picking apart the other side. A ${margin}-point win is convincing. ${l.name} have a result to answer for.`],
      upset:[`${w.name} were ${e.winnerPre?.[0]}-${e.winnerPre?.[1]} beforehand, against ${l.name}'s ${e.loserPre?.[0]}-${e.loserPre?.[1]}. That makes this a meaningful surprise. The stronger record didn't settle this game.`,`The expectations favored ${l.name} on record. ${w.name} have earned a different conversation with this result, even if one win doesn't erase the gap between their seasons.`],
      streak:st?.ended?[`For ${streak?.team.name}, that ends ${st?.ended.length} straight ${st?.ended.won?'wins':'losses'}. ${st?.ended.won?"That's a reminder that a good run isn't a guarantee.":"They needed a result like this. It doesn't solve everything, but it stops the slide."}`,st?.ended.won?"The run deserves credit, and the loss deserves scrutiny. I wouldn't throw out everything that worked because of one result, but I wouldn't wave this away either.":"Finally, a win to work with. I'd give them room to enjoy it before asking for proof that the improvement can last. Ending the losing run is a start."]:[`For ${streak?.team.name}, the results are beginning to repeat. ${st?.won?"That's encouraging. I want to see what's carrying over from one win to the next before calling it their identity.":"That's where the concern grows. A run of losses puts more pressure on the next performance."}`,st?.won?"The run matters because it isn't just one good night anymore. I'd still separate winning repeatedly from proving that every part of their game will hold up.":"Another loss makes this harder to shrug off. The record tells us there's a recurring problem with results; we need the basketball evidence to say exactly what it is."],
      performance:[`${name} deserves the attention. ${e.doubles.length>=3?"That's production in three or more categories, not just a scoring headline.":"That scoring total sets this night apart."} The team result still matters when we judge what the performance meant.`,`I'd give ${name} the spotlight without losing the team story. ${e.doubles.length>=3?"That contribution stretches beyond scoring.":"That's a substantial scoring night."} Individual recognition and the final result belong in the same conversation.`],
      championship:[`That's the result they'll remember. ${w.name} have the title, and the discussion can finally move from what they might achieve to what they've actually won.`,`There's no need to rush past this moment. ${w.name} are champions. The questions about what comes next can wait while we give this achievement its due.`],
      elimination:[`That's the consequence for ${l.name}: no next game in this run. The loss carries more weight than a regular-season setback because the chance to respond is gone.`,`For ${w.name}, there's more basketball ahead. For ${l.name}, this result closes the run. That's why the same final score can mean so much more at this stage.`]
    };
    return pick(story,options[angle],angle+':judgment');
  }
  function gameClosing(story,e,angle){
    const w=e.winner.name,l=e.loser.name;
    const options={
      routine:[`A useful win for ${w}. The next result will give us another piece of the picture.`,`Credit to ${w}. This one adds to their season without defining it.`,`${w} have the win. Now the question is what they can keep delivering.`,`For ${l}, the response matters more than any explanation tonight.`],
      close:[`A narrow result, and plenty of room for these teams to change the conversation.`,`${w} have the win; I'd keep the assessment of the performance more measured.`,`That small margin leaves both sides with something to think about.`,`One close game settles a result. It doesn't settle which team is better.`],
      blowout:[`${l} need a better performance to put this one behind them.`,`${w} have set a standard they'll want to meet again.`,`The score leaves ${l} with questions that another game will have to answer.`,`An emphatic win for ${w}. Repeating that level is the next challenge.`],
      upset:[`Maybe we need to give ${w} a little more attention.`,`The record still matters. Tonight is a reason to question what we expected.`,`${w} have earned the credit. Whether this changes their season is the next question.`,`A surprise result becomes a bigger story if ${w} can follow it up.`],
      streak:[`The next game will tell us whether this is another chapter or a change of direction.`,`That's a result with a history behind it. The response is worth watching.`,`We've got more than one night to consider now. Let's see what follows.`,`The run gives this result meaning. What happens next will give it perspective.`],
      performance:[`${e.name} has given us a night to remember. Now let's see what follows.`,`Give the performance its due without making it a new nightly requirement.`,`That's a substantial contribution. Sustaining it is a different challenge.`,`One remarkable night is worth celebrating. A pattern takes longer to establish.`],
      championship:[`For now, this moment belongs to the champions.`,`The offseason questions can wait. This is a title worth celebrating.`,`They've earned the celebration before the next challenge begins.`,`A championship is the ending every team wanted. This one belongs to ${w}.`],
      elimination:[`The response will have to come in a new chapter.`,`That's the end of this run, and the beginning of the assessment.`,`There's time to evaluate it now. There isn't another game to change it.`,`For ${l}, the next challenge starts after this run.`]
    };
    return pick(story,options[angle],angle+':closing');
  }
  function supportingThreads(e,angle){
    const s=e.s,n=e.name,threads=[];
    if(e.streak&&angle!=='streak'){
      const st=e.streak.history.streak,team=e.streak.team.name;
      threads.push({key:'continuity',priority:95,speaker:3,
        question:`There's a run of results behind this, too. What does that add to tonight's story?`,
        detail:st.ended?`${team}'s ${st.ended.length}-game ${st.ended.won?'winning':'losing'} streak ends here. ${st.ended.won?"That gives the loss a different perspective after a good run.":"That makes the win particularly welcome after a difficult run."}`:
          `It's ${st.length} straight ${st.won?'wins':'losses'} for ${team}. ${st.won?"The results are starting to repeat. That's more encouraging than an isolated good night.":"One loss is easier to dismiss. A run like this puts more pressure on the next performance."}`,
        response:st.ended?"That's why the history matters. This result interrupts a run, rather than extending it. Now the next performance will help us judge whether the change can last.":st.won?"And that gives us a reason to keep watching. Repeated wins are encouraging. I want to see which strengths keep showing up before calling this the team's identity.":"Exactly. The concern grows when the losses repeat. The run establishes a problem with results; how they respond is the next part of the story."});
    }
    if(!e.name)return threads;
    if(shotPair(s,'FGM','FGA')&&s.FGA>=4){
      const pct=s.FGM/s.FGA,poor=pct<=.334,strong=pct>=.6;
      threads.push({key:'shooting',priority:poor?100:strong?85:50,speaker:3,
        question:`Does the shooting change how you judge ${n}'s contribution to this result?`,
        detail:`${n} went ${s.FGM} for ${s.FGA} from the field. ${poor?"That's a rough shooting night. The scoring total needs to be read alongside how many attempts it took.":strong?"That's efficient scoring. The production looks better when you consider how few shots missed.":"That gives us a clearer picture of the scoring than the points alone."}`,
        response:poor?"And that's the concern. You can contribute in other ways, but those missed shots still count. I'd want a better shooting night before calling this a strong offensive performance.":strong?"That's the part I'd praise. Getting that return on your shots is valuable. The scoring deserves attention, and the efficiency gives us a better reason to like it.":"Fair point. I wouldn't make this shooting line the headline. It's part of the night, and the other contributions deserve their share of the attention."});
    }
    if(validCount(s.TO)&&(s.TO>=4||(s.TO===0&&s.PTS>=20)||(s.AST>=5&&s.AST>s.TO))){
      threads.push({key:'security',priority:s.TO>=4?95:65,speaker:2,
        question:`What does the balance between production and mistakes tell you about ${n}'s night?`,
        detail:s.TO===0?`${n} had no turnovers. That's a positive alongside the production: no giveaways to set against it. It doesn't describe every possession, but it belongs in the assessment.`:`${n} had ${s.TO} turnovers${validCount(s.AST)?` against ${s.AST} assists`:''}. ${s.TO>=4?"I'd want fewer mistakes, even with the other contributions. Production doesn't make those giveaways disappear.":"I like that balance. There were mistakes, but the passing deserves its share of the credit."}`,
        response:s.TO>=4?"That's a fair qualification. Give the good parts their credit, but don't make the player exempt from criticism. Keeping the production while reducing the mistakes would be a better night.":"And that makes the assessment more complete. Points are easy to notice; the balance between creating and giving the ball away can change how you judge the same performance."});
    }
    if(e.ppg!==null){
      const delta=s.PTS-Number(e.ppg);
      if(validCount(s.PTS))threads.push({key:'average',priority:Math.abs(delta)>=10?90:55,speaker:3,
        question:`How does this compare with what we've seen from ${n} across the season?`,
        detail:`${n} is averaging ${e.ppg} points a game ${e.average.period==='playoffs'?'in the playoffs':'in the regular season'}. ${Math.abs(delta)<3?"Tonight's scoring is close to that level. That makes this more consistent with the established production than a new development.":delta>0?"Tonight's scoring is above that level. Give it credit, but don't turn a better night into a new expectation immediately.":"Tonight's scoring is below that level. That's worth noticing, without treating one game as a new trend."}`,
        response:Math.abs(delta)<3?"That's useful perspective. The familiar scoring level doesn't make the result unimportant; it just tells us where to look for what was different tonight.":delta>0?"I'd celebrate the night before raising the standard. The average gives us a longer view. If this happens repeatedly, then we can start changing the expectation.":"Agreed. A quieter scoring night deserves attention, but the longer record still counts. I'd want repeated evidence before calling it a decline."});
    }
    const contribution=['AST','REB','BLK','STL'].filter(k=>validCount(s[k])&&s[k]>=({AST:3,REB:5,BLK:2,STL:2}[k])).sort((a,b)=>s[b]-s[a])[0];
    if(validCount(s.PTS)||contribution){
      const stats=e.doubles.length>=3?e.doubles.map(k=>count(s[k],labels[k])):
        [validCount(s.PTS)?count(s.PTS,'points'):null,contribution?count(s[contribution],labels[contribution]):null].filter(Boolean);
      threads.push({key:'contribution',priority:angle==='performance'?110:75,speaker:2,
        question:`Where does ${n}'s performance fit into the story of this game?`,
        detail:`${n} finished with ${join(stats)}. ${contribution==='AST'?"Give the passing some credit, too. Teammates benefited from that production; this wasn't only about putting up points.":contribution==='REB'?"The boards deserve attention. That's another contribution alongside the scoring, and it makes the whole night more interesting.":contribution?"Give those defensive contributions their credit. Steals and blocks don't capture everything, but they belong in the conversation.":s.PTS===0?"No scoring contribution tonight. That doesn't describe everything a player can do, but there's nothing to celebrate in that column.":"That's a scoring contribution worth noting. I'd judge it alongside the shooting and the team result before calling it a great night."}`,
        response:e.doubles.length>=2?`That's a ${['','','double-double','triple-double','quadruple-double','quintuple-double'][e.doubles.length]}. A contribution across the line. I'd give that its due, while keeping the team's result in view.`:contribution==='AST'?"I'm with you on the passing. Scoring gets the attention, but helping teammates produce belongs in the assessment too. That's a more useful way to judge the whole night.":"That's fair. Give the player credit for the contribution, but don't lose sight of the team result. A good individual night and a good team night don't always line up."});
    }
    return threads.sort((a,b)=>b.priority-a.priority).slice(0,2);
  }
  function gameScript(story,context={}){
    const e=selectEvidence(story,context);if(!e)return genericScript(story);
    const angle=selectAngle(e),turns=[turn(0,gameOpening(story,e,angle)),turn(1,angleResponse(story,e,angle))];
    for(const thread of supportingThreads(e,angle)){
      const reverse=pick(story,[false,true],angle+':'+thread.key+':route');
      const questions={
        shooting:[thread.question,`What do the attempts tell you about ${e.name}'s scoring tonight?`,`Does ${e.name}'s shooting line support the impression you get from the points?`,`How much weight would you put on the shooting in this assessment?`],
        security:[thread.question,`Is there a tradeoff here between creating for teammates and giving the ball away?`,`What about ball security? Does that change your view of the performance?`,`Where do the mistakes fit alongside the production we're discussing tonight?`],
        average:[thread.question,`Does tonight change what we should expect from ${e.name}, given the longer record?`,`Put this night against ${e.name}'s usual scoring. How different is it?`,`Are we seeing a different scoring level here, or something closer to the usual production?`],
        contribution:[thread.question,`Who deserves the individual attention here, and what stands out in that contribution?`,`Let's talk about ${e.name}. What deserves credit beyond just the final score?`,`How would you weigh ${e.name}'s contribution alongside the result we've just discussed?`],
        continuity:[thread.question,`Where does this result fit alongside the recent run of games?`,`What changes when we put tonight's result against the run that preceded it?`,`Is the recent sequence giving this game a different meaning for the team?`]
      };
      turns.push(turn(0,pick(story,questions[thread.key],angle+':'+thread.key+':question')),turn(thread.speaker,thread.detail),turn(reverse?1:thread.speaker===2?3:2,thread.response));
      // Develop the same shooting thread with new evidence when a major story
      // warrants a second pass. This is not a third statistical checklist.
      if(['championship','elimination','upset','streak','performance'].includes(angle)&&thread.key==='shooting'&&
        shotPair(e.s,'TPM','TPA')&&e.s.TPA>=4&&e.s.TPA<=e.s.FGA&&e.s.TPM<=e.s.FGM){
        turns.push(turn(0,`And from three? Does that add anything to the shooting assessment?`),
          turn(3,`${e.name} went ${e.s.TPM} for ${e.s.TPA} from three. ${e.s.TPM===0?"Nothing fell from outside. That's a part of the offense you'd want to improve.":e.s.TPM/e.s.TPA>=.4?"That's a good return from outside. It adds another reason to appreciate the shooting tonight.":"That part of the shooting wasn't as productive. I'd keep it in mind alongside the overall line."}`));
      }
    }
    turns.push(turn(0,gameClosing(story,e,angle)));return turns;
  }
  function featuredStats(story){const p=story.seasonSnapshot?.featuredPlayer;return story.statsPeriod==='finals'?p?.finalsStats||p?.playoffStats:p?.regularStats;}
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
      body.push(turn(2,`${name} averaged ${join(values.map(k=>`${rate(s,k)} ${labels[k]}`))} a game${story.statsPeriod==='finals'?' in the postseason':''}. ${/defens/i.test(award)?"Those are defensive contributions worth recognizing, even though the full assessment goes beyond steals and blocks.":"That's the production behind the recognition. It's a stronger starting point than treating the award as praise without substance."}`));
      body.push(turn(0,`What gives that production weight when you're judging ${name}'s case for the award?`));
      body.push(turn(3,`It's over ${s.GP} game${s.GP===1?'':'s'}. ${s.GP===1?"That's a one-game sample, so I wouldn't describe it as sustained form.":"The sample gives us a body of work. That's different from singling out one memorable night."}`));
      if(rate(s,'MIN')!==null)body.push(turn(2,`${rate(s,'MIN')} minutes a game also gives us perspective on the workload. I'd read the production with that in mind, rather than assuming every player had the same opportunity.`));
      body.push(turn(1,"The award recognizes what's been done. It doesn't mean there aren't ways to improve. Give the player credit without making the next season carry an impossible standard."));
    }
    return frame(story,'award',[`${name} wins ${award}. The recognition is official.`,`${award} belongs to ${name}.`,`The award goes to ${name}: ${award}.`,`A moment of recognition for ${name}, the ${award} winner.`],
      [`Give ${name} the moment. The next chapter can wait.`,`An award worth celebrating before attention turns to what's next.`,`That's recognition for the work already done.`,`Congratulations to ${name}. Now there's another achievement on the record.`],body);
  }
  function playoffScript(story){
    const rows=story.seasonSnapshot?.rows||[];if(!rows.length)return genericScript(story);
    const teams=teamRecords(story),round=Number(String(story.eventKey||'').split('-').at(-1));
    const paired=rows.map(row=>({row,a:teams.find(t=>t.name===row[0]),b:teams.find(t=>t.name===row[1])}));
    const pair=paired.filter(x=>x.a&&x.b).sort((a,b)=>Math.abs(a.a.r.W-a.b.r.W)-Math.abs(b.a.r.W-b.b.r.W))[0]||paired[0];
    const {row,a,b}=pair,body=[turn(1,`${row[0]} against ${row[1]}. ${row[2]==='Single elimination'?"It's win or go home. There's no Game 2 to answer a loss.":/^Best of \d+$/.test(row[2])?`${row[2]}. One game won't settle it, so I'd be careful about declaring the series decided after the opener.`:"That's a matchup to follow without making a prediction from the names alone."}`)];
    if(a&&b){
      const gap=Math.abs(a.r.W-b.r.W);
      body.push(turn(2,`${a.name} finished ${a.r.W}-${a.r.L}; ${b.name}, ${b.r.W}-${b.r.L}. ${gap===0?"They have the same number of wins. I'd want more than the records to separate them.":`There's a ${gap}-win difference. That's relevant, but it isn't a complete matchup assessment.`}`));
      const offense=rate(a.r,'PTS'),allowed=rate(b.r,'OPP');
      if(offense!==null&&allowed!==null){
        body.push(turn(0,`Where would you start when comparing what these teams usually score and allow?`));
        body.push(turn(3,`${a.name} score ${offense} points a game; ${b.name} allow ${allowed}. That's a useful comparison of their seasons. It isn't a forecast of the score when they meet.`));
        body.push(turn(1,"That's the distinction. Those averages tell us what each side has done. The matchup still has to show whether the offense can produce at that level against this opponent."));
      }
      body.push(turn(2,row[2]==='Single elimination'?"And the format leaves no room to wait for a second chance. I'd put a premium on avoiding mistakes, without pretending we know which team will handle it better.":"I'd keep the series format in mind before changing my assessment after one result. A strong opener is useful; sustaining that performance is another question."));
    }
    return frame(story,'playoff',[`${round>1?`Round ${round}`:'The playoffs'} bring ${rows.length} ${rows.length===1?'matchup':'matchups'} to the desk.`,`The stakes change with ${round>1?`Round ${round}`:'the playoffs'}. Let's look at the matchups.`,`${round>1?`Round ${round}`:'The playoff field'} gives us ${rows.length} ${rows.length===1?'matchup':'matchups'} to consider.`,`Time to look ahead to ${round>1?`Round ${round}`:'the playoffs'}.`],
      ["The matchups are set. Now the basketball has to answer the questions.","The records frame the discussion; the games will develop it.","There's enough here to be interested, without pretending the result is settled.","That's what makes this round worth following: expectations still need to be tested."],body);
  }
  function championshipScript(story){
    const row=story.seasonSnapshot?.rows?.[0]||[],champ=row[0]||story.relatedTeams?.[0]?.name;
    if(!champ)return genericScript(story);
    const body=Season.honorLines(story).slice(0,2).map(text=>turn(1,text)),team=teamRecords(story).find(t=>t.name===champ);
    if(row[1]&&row[1]!=='Not available')body.push(turn(1,`${champ} beat ${row[1]} for the title. That's the result that changes how this run will be remembered. They have the championship to show for it.`));
    if(team){
      body.push(turn(0,`How does the regular season look now that ${champ} have finished with a title?`));
      body.push(turn(2,`They went ${team.r.W}-${team.r.L} in the regular season. Now the season has a championship at the end of it. That gives the earlier results a different perspective.`));
      const ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP');
      if(ppg!==null&&opp!==null)body.push(turn(3,`${ppg} points scored and ${opp} allowed a game in the regular season. That's background to the title, rather than proof of how they won the final.`));
      body.push(turn(1,"And now they've got the title to go with that season. I'd give them their moment before starting the offseason debate. Every other team would love to be having this conversation."));
    }
    return frame(story,'championship',[`${champ} are champions. That's the headline tonight.`,`${champ} finish the season with a championship.`,`The title belongs to ${champ}.`,`A championship for ${champ}. Time to give them their moment.`],
      [`Enjoy this one, ${champ} fans. The next challenge can wait.`,"There will be offseason questions. Tonight belongs to the champions.","They've earned the celebration before anyone asks them to do it again.","A title gives this season its ending. What follows is another story."],body);
  }
  function seasonScript(story){
    const teams=teamRecords(story).sort((a,b)=>b.r.W-a.r.W||a.r.L-b.r.L);if(!teams.length)return genericScript(story);
    const team=teams[0],ppg=rate(team.r,'PTS'),opp=rate(team.r,'OPP'),gap=ppg!==null&&opp!==null?(team.r.PTS-team.r.OPP)/team.r.GP:null;
    const body=[turn(1,`${team.name} finish ${team.r.W}-${team.r.L}. ${team.r.W>team.r.L?"That's a winning season, and it deserves credit. The record gives us a result to assess, rather than a promise about what's next.":team.r.W<team.r.L?"That's a losing season. I'd be honest about the results before turning the discussion toward what might improve.":"An even record leaves a mixed assessment. I'd want to look at what sits behind it."}`)];
    if(gap!==null){
      body.push(turn(0,`Do the scoring averages support what that record tells us about ${team.name}?`));
      body.push(turn(3,`${ppg} points a game, against ${opp} allowed. That's a ${Math.abs(gap).toFixed(1)}-point scoring margin ${gap>=0?'in their favor':'against them'}. ${gap>0?"It supports the case that their results have substance.":gap<0?"That deficit is a concrete concern, even before we decide where the improvement should come.":"There's very little room between scoring and conceding on those averages."}`));
      body.push(turn(2,gap>0?"That gives the record some perspective. I'd still avoid treating an average margin as a description of every game. Consistency and a strong average aren't exactly the same thing.":"That's where I'd keep the assessment concrete. The gap tells us what needs to change on the scoreboard. It doesn't tell us which adjustment will make the difference."));
    }
    const table=story.seasonSnapshot?.tables?.find(t=>t.label==='Regular-season player statistics');
    const scorer=[...(table?.rows||[])].filter(r=>r[2]!==null&&r[2]!==''&&r[2]!=='—'&&Number.isFinite(Number(r[2]))).sort((a,b)=>Number(b[2])-Number(a[2]))[0];
    if(scorer){
      body.push(turn(0,`Who gives us a starting point when we look at the individual contributions?`));
      body.push(turn(2,`${scorer[0]} led their scoring at ${Number(scorer[2]).toFixed(1)} points a game. That's a contribution to recognize, while keeping the team's overall results in the same discussion.`));
      body.push(turn(1,"And that's a useful starting point, rather than the entire explanation. A leading scorer deserves attention; the team's season still needs to be judged as a whole."));
    }else if(story.type==='Regular-season review'&&teams[1]){
      const other=teams[1];body.push(turn(1,`${other.name} finish ${other.r.W}-${other.r.L}. ${team.r.W===other.r.W&&team.r.L===other.r.L?"The records are tied, so I'd be careful about separating them without more evidence.":"That gives us another season to compare. Records are a starting point, not a complete ranking of team quality."}`));
    }
    const verdict=team.r.W>team.r.L?'a winning season':team.r.W<team.r.L?'a losing season':'an even record';
    return frame(story,'season',[`${team.name} finish with ${verdict}. That's the assessment to start with.`,`${verdict.charAt(0).toUpperCase()+verdict.slice(1)} for ${team.name}. Now let's look at what sits behind it.`,`${team.name}'s regular season ends with ${verdict}.`,`${team.name} have ${verdict} to look back on. What should they take from it?`],
      ["The next step is turning that assessment into better results.","That's the season we can assess. The next one will bring its own questions.","There's a record to build on and an assessment to make before the next chapter.","The averages give us perspective. Progress will have to show up in the results."],body);
  }
  function leadersScript(story){
    const rows=(story.seasonSnapshot?.rows||[]).filter(r=>labels[r[0]]&&valid(r[2])&&r[3]>0);
    if(!rows.length)return genericScript(story);
    const categories=[...new Set(rows.map(r=>r[0]))].slice(0,2),body=[];
    for(const [i,k] of categories.entries()){
      const tied=rows.filter(r=>r[0]===k),names=join(tied.map(r=>r[1])),value=(tied[0][2]/tied[0][3]).toFixed(1);
      if(i)body.push(turn(0,`And who stands out when we look beyond ${labels[categories[0]]}?`));
      body.push(turn(i?2:1,`${names} ${tied.length===1?'leads':'share the lead'} in ${labels[k]} at ${value} a game. ${k==='PTS'?"That's scoring production over the season, rather than a single night's headline.":"That category gives us another way to recognize production beyond the most obvious scoring stories."}`));
      const honor=(story.seasonSnapshot.leaderHonors||[]).find(h=>h.category===k&&tied.some(r=>h.name===r[1]));
      if(honor)for(const line of Season.honorLines({...story,seasonSnapshot:{...story.seasonSnapshot,honorHistory:honor}}).slice(0,1))body.push(turn(2,line));
      body.push(turn(3,i?`${tied.length>1?"That category has joint leaders, and they both deserve the recognition.":"That's another individual season deserving attention."} ${k==='REB'?"The rebounding story belongs alongside the scoring story. They recognize different contributions.":"It's another way to contribute. The scoring leader doesn't have to be the leader everywhere else."}`:
        `${tied.length>1?"They share the lead, so the recognition needs to be shared too.":`That rate comes over ${tied[0][3]} games. The sample belongs in the assessment.`} I'd give the category leader credit without treating one category as the entire player.`));
    }
    const first=rows.filter(r=>r[0]===categories[0]),lead=join(first.map(r=>r[1])),category=labels[categories[0]];
    return frame(story,'leaders',[`${lead} ${first.length>1?'share the lead':'is the leader'} in ${category}. That's where we start.`,`${category.charAt(0).toUpperCase()+category.slice(1)} honors ${first.length>1?'are shared by':'go to'} ${lead}.`,`Give ${lead} the spotlight ${first.length>1?'as joint leaders':'as the leader'} in ${category}.`,`${lead} ${first.length>1?'finish together at':'finishes at'} the top in ${category}.`],
      ["Recognition in one category starts the discussion. It doesn't finish the player assessment.","There's more than one way to leave a mark on a season.","Those performances deserve attention beyond a single game.","Give the leaders credit, and keep the whole performance in view."],body);
  }
  function genericScript(story){
    const headline=sentence(String(story.headline||'More news from around the league'));
    const paragraphs=(story.paragraphs||[]).filter(p=>typeof p==='string'&&!/[“”"]/.test(p)&&p!==story.headline&&p.length<=240);
    const detail=paragraphs.find(p=>!p.startsWith(String(story.headline)));
    const openings=[headline,`Around the league: ${headline}`,`A development to follow. ${headline}`,`Here's the latest. ${headline}`];
    const type=story.type||'';
    const closings=/trade request/i.test(type)?["The request is on the table. A completed deal would be a different development.","Now the question is how the team responds to the request.","There's a request to address, and no completed trade to assess yet.","The request changes the conversation. We'll see whether it leads to a deal."]:
      /draft declaration/i.test(type)?["Entering the draft starts a new chapter. The destination is still to be decided.","The declaration is official. The selection comes later.","Now the attention turns to where that next opportunity will be.","A draft decision to follow, with the next step still ahead."]:
      /injury return/i.test(type)?["Availability is the news. The next performance will tell us more.","Being available is a start. The return to the floor is worth following.","Now the attention turns from recovery to playing again.","That's another option for the team. Let's see how the return develops."]:
      /injury/i.test(type)?["That's an absence the team will have to account for.","The next update on availability is the one to follow.","For now, the team has an absence to manage.","The return will be a separate development. This is the news today."]:
      /trade|sign|draft|commit|option|extend/i.test(type)?["The move is the news. Its effect on the floor is still a question.","There's a roster development to follow as the season moves on.","Now we'll see what that decision means for the team.","The next chapter will give the decision some perspective."]:
      /retir|hall|jersey/i.test(type)?["A moment to recognize before the league moves to its next chapter.","That achievement deserves its place in the league's history.","The next chapter begins with that recognition on the record.","There's a career story here that deserves its own moment."]:
      ["That's the development to follow from here.","We'll have more to assess as the next chapter develops.","The facts give us a starting point. What follows will add perspective.","A league story worth keeping in view."];
    return frame(story,'brief',openings,closings,detail?[turn(2,detail)]:[]);
  }
  function reportedReaction(story){
    if(!story.quotesEnabled||!story.templateVersion)return [];
    const quotes=(story.paragraphs||[]).flatMap(p=>typeof p==='string'?[...p.matchAll(/[“"]([^”"]+)[”"]\s+([^.!?]+?) said\./g)]:[]).filter(q=>q[1].length<=240);
    const q=quotes.find(q=>q[2].startsWith('head coach '))||quotes[0];if(!q)return [];
    const attribution=q[2].replace(/^head coach /,'');
    const response=/consisten/i.test(q[1])?"Consistency is the standard being set there. The next results will tell us whether that message is turning into something the team can deliver repeatedly.":/champion|title|finish the job/i.test(q[1])?"That's a championship reaction worth letting stand. There's time for the next question after the players and coaches have had their moment.":/responsib|not good enough|higher|better/i.test(q[1])?"There's a demand for improvement in that reaction. I'd judge the response by what changes on the floor, rather than treating the words as the solution.":null;
    return response?[turn(0,`${q[2].startsWith('head coach ')?'Coach ':''}${attribution} put it this way: “${q[1]}”`),turn(2,response)]:[];
  }
  function baseScript(story,context){
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
      turn(3,"We'll be following the next chapter."),
      turn(0,`For ${names[1]}, ${names[2]} and ${names[3]}, I'm ${names[0]}. Thanks for watching HoopWire TV. We'll see you next time!`)
    ];
  }
  return {script,episode,chunkDialogue,selectEvidence,selectAngle,supportingThreads,policy,awardScript,playoffScript,championshipScript,gameScript,genericScript,seasonScript,leadersScript};
});
