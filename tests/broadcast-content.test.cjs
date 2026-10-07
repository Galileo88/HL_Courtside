const test=require('node:test'),assert=require('node:assert/strict');
const B=require('../broadcast-content'),S=require('../season-coverage');
const text=s=>B.script(s).map(t=>t.text).join(' ');
const game={id:'example',headline:'Example game',gameSummary:{home:{name:'Stars',score:110},away:{name:'Moons',score:108}},playerName:'Alex Star',playerStats:{PTS:28,REB:10,AST:11,FGM:9,FGA:15,TPM:3,TPA:6,FTM:7,FTA:8}};
test('dialogue chunks rebalance short endings without dropping or rearranging words',()=>{
 for(const ending of ['tonight.','in this game.','and protect the ball.']){
  const original='basketball '.repeat(14)+ending,chunks=B.chunkDialogue(original);
  assert.equal(chunks.length,2);assert.equal(chunks.join(' '),original);
  assert.ok(chunks.every(c=>c.length<=160&&c.length>=40&&c.split(/\s+/).length>=5));
 }
 const long='Take care of the ball. '.repeat(40)+'Every night.';
 const chunks=B.chunkDialogue(long);assert.equal(chunks.join(' '),long);assert.ok(chunks.every(c=>c.length<=160));assert.ok(chunks.at(-1).split(/\s+/).length>=5);
 assert.deepEqual(B.chunkDialogue('  Welcome\n to the show!  '),['Welcome to the show!']);assert.deepEqual(B.chunkDialogue(''),[]);
 assert.deepEqual(B.chunkDialogue('Yes.'),['Yes.']);assert.deepEqual(B.chunkDialogue('x'.repeat(170)),['x'.repeat(170)]);
 for(const turn of B.episode(game)){
  const parts=B.chunkDialogue(turn.text);assert.equal(parts.join(' '),turn.text);
  if(parts.length>1)assert.ok(parts.every(c=>c.split(/\s+/).length>=5),turn.text);
 }
});
test('episodes welcome viewers, introduce all four hosts and close after the reporting',()=>{
 const turns=B.episode(game),intro=turns.slice(0,4).map(t=>t.text).join(' ');
 assert.match(intro,/Welcome to HoopWire TV/);for(const name of ['Maya Brooks','Jordan Price','Andre Cole','Nina Reyes'])assert.ok(intro.includes(name));
 assert.match(turns[4].text,/Stars.*Moons/);assert.match(turns.at(-1).text,/Thanks for watching HoopWire TV/);assert.deepEqual(B.episode(null),[]);
});
test('studio names the player, uses basketball terms and does not invent a deciding play',()=>{
 const s=text(game);assert.match(s,/Stars .* Moons, 110 to 108/);assert.match(s,/Alex Star finished with 28 points, 10 rebounds and 11 assists/);assert.match(s,/triple-double/);assert.match(s,/9 for 15 from the field/);assert.doesNotMatch(s,/created separation|context matters|buzzer|fourth quarter|game-winning/);
 assert.ok(B.script(game).every(t=>t.speaker>=0&&t.speaker<=3));
});
test('zero stats stay factual, missing shooting is omitted and steals/blocks count toward double-doubles',()=>{
 const s={...game,playerStats:{PTS:0,REB:0,AST:0}};assert.match(text(s),/0 points/);assert.doesNotMatch(text(s),/double|from the field/);
 s.playerStats={PTS:12,REB:1,AST:0,BLK:10};assert.match(text(s),/double-double/);assert.match(text(s),/10 blocks/);
 s.playerStats={PTS:12,REB:1,AST:0,FGM:8,FGA:4};assert.doesNotMatch(text(s),/8 for 4/);
});
test('season coverage uses per-game rates and correct award period without falling back to regular season',()=>{
 const s={type:'Award announcement',eventKey:'award-1-1',headline:'Alex wins Finals MVP',statsPeriod:'finals',seasonSnapshot:{rows:[['Finals MVP','Alex']],featuredPlayer:{name:'Alex',regularStats:{GP:82,PTS:2000,REB:800,AST:400},finalsStats:{GP:5,PTS:150,REB:50,AST:25,MIN:175}}}};
 assert.match(text(s),/30\.0 points and 5\.0 assists/);assert.match(text(s),/35\.0 minutes a game/);assert.doesNotMatch(text(s),/2000|150 points/);
 delete s.seasonSnapshot.featuredPlayer.finalsStats;assert.doesNotMatch(text(s),/averaged|24\.4/);
});
test('bracket comparisons keep ties and later rounds accurate',()=>{
 const s={type:'Playoff preview',eventKey:'playoff-round-2',relatedTeams:[{id:1,name:'Stars'},{id:2,name:'Moons'}],seasonSnapshot:{rows:[['Stars','Moons','Single elimination']],teamRecords:[{teamId:1,record:{seasonStats:{W:60,L:22}}},{teamId:2,record:{seasonStats:{W:60,L:22}}}]}};
 assert.match(text(s),/Round 2/);assert.match(text(s),/60-22/);assert.match(text(s),/same number of wins/);assert.match(text(s),/no Game 2/);assert.doesNotMatch(text(s),/regular season gives way/);
});
test('brief news uses actual reporting and does not manufacture a panel argument or a quote',()=>{
 const s={type:'Injury return',headline:'Alex returns',paragraphs:['Alex is available to play for Stars.','“I feel great,” Alex said.']};assert.match(text(s),/available to play/);assert.doesNotMatch(text(s),/missing minutes|I feel great|context|next decision/);assert.ok(B.script(s).length<=4);
});
test('native playing time converts total seconds once, across team stints',()=>{
 const player={stats:[{league:0,yr:1,season:[{GP:2,PTS:20,REB:4,AST:6,MIN:[1200,600,600,0,0,0]},{GP:1,PTS:10,REB:2,AST:3,MIN:[600,600,0,0,0,0]}]}]};
 assert.equal(S.stats(player,{leagueType:0},1).MIN,30);assert.equal(S.stats(player,{leagueType:0},1).GP,3);
 delete player.stats[0].season[1].MIN;assert.equal(S.stats(player,{leagueType:0},1).MIN,undefined);
});
test('a poor shooting night gets criticism and a strong shooting night gets specific praise',()=>{
 const poor={...game,playerStats:{PTS:20,REB:2,AST:1,FGM:5,FGA:20}};
 assert.match(text(poor),/5 for 20.*rough shooting night/);assert.doesNotMatch(text(poor),/efficient scoring/);
 const strong={...game,playerStats:{PTS:20,REB:2,AST:7,FGM:8,FGA:10}};
 assert.match(text(strong),/8 for 10.*efficient scoring/);assert.match(text(strong),/7 assists/);
 const legacy={...game,playerName:null,paragraphs:['Alex Star was named player of the game after finishing with 28 points.']};
 assert.match(text(legacy),/Alex Star finished/);
});
test('postgame follow-ups connect efficiency, ball security and per-game context',()=>{
 const story={...game,day:10,playerId:1,playerStats:{...game.playerStats,STL:2,BLK:1,TO:4},broadcastSnapshot:{day:10,playerId:1,period:'season',average:{GP:10,PTS:200}}};
 const turns=B.script(story),s=text(story);
 assert.ok(turns.length>=6&&turns.length<=14);assert.match(s,/4 turnovers.*11 assists/);
 const e=B.selectEvidence(story,require('../broadcast-context').buildContext(story));assert.equal(e.ppg,'20.0');assert.equal(B.supportingThreads(e,B.selectAngle(e)).length,2);
 assert.doesNotMatch(s,/next matchup|Where do the .*turnovers/);
 assert.doesNotMatch(s,/200 points|I (?:watched|rewatched|spoke|caught up)|second half|pregame|warmups/);
 assert.deepEqual(B.script(story),turns);
 const clean={...story,playerStats:{PTS:28,AST:1,TO:0}};assert.ok(B.supportingThreads(B.selectEvidence(clean),'routine').some(t=>/no turnovers/.test(t.detail)));assert.doesNotMatch(text(clean),/giveaways are too many/);
 const incomplete={...game,playerStats:{PTS:12}};assert.doesNotMatch(text(incomplete),/turnovers|field-goal attempts|from three|undefined|NaN/);
});
test('reporting segues preserve saved quotes and respond to their message',()=>{
 const quote='We have to be more consistent at both ends of the floor.';
 const story={...game,quotesEnabled:true,templateVersion:3,paragraphs:[`“${quote}” head coach Pat Courtside said.`]};
 const s=text(story);assert.ok(s.includes(`Coach Pat Courtside put it this way: “${quote}”`));assert.match(s,/Consistency/);
 assert.doesNotMatch(s,/before.*game|I spoke|I talked|pregame/);
 assert.ok(!text({...story,quotesEnabled:false}).includes(quote));
 const player={...story,paragraphs:['"We are champions. Everybody in that locker room had a part in this." Alex Star said.']};assert.match(text(player),/Alex Star put it this way/);assert.match(text(player),/championship reaction/);
});
test('playoff, award and season segments develop basketball questions with available facts',()=>{
 const teams={relatedTeams:[{id:1,name:'Stars'},{id:2,name:'Moons'}],seasonSnapshot:{rows:[['Stars','Moons','Best of 7']],teamRecords:[{teamId:1,record:{seasonStats:{GP:10,W:8,L:2,PTS:1100,OPP:1000}}},{teamId:2,record:{seasonStats:{GP:10,W:7,L:3,PTS:1050,OPP:1020}}}]}};
 const preview={...teams,type:'Playoff preview'};assert.match(text(preview),/Stars score 110\.0 points a game.*Moons allow 102\.0/);assert.ok(B.script(preview).length>=8);
 const season={...teams,type:'Regular-season review'};assert.match(text(season),/10\.0-point scoring margin/);assert.match(text(season),/Stars.*8-2/);
 const award={type:'Award announcement',headline:'Alex wins MVP',seasonSnapshot:{rows:[['MVP','Alex']],featuredPlayer:{name:'Alex',regularStats:{GP:10,PTS:200,AST:50}}}};assert.match(text(award),/10 games/);assert.match(text(award),/5\.0 assists.*a game/);assert.doesNotMatch(text(award),/undefined|NaN/);
 const noBox={...game,playerStats:null};assert.ok(B.script(noBox).length<=4);assert.doesNotMatch(text(noBox),/28 points|turnovers|rally|buzzer/);
});
test('league leaders rank per-game production rather than total points and TV displays rates',()=>{
 const league={leagueName:'Test',leagueType:0,season:{currentYear:1,totalGames:2,schedule:[]},teams:[
  {id:1,name:'Stars',season:[{yr:1,seasonStats:{GP:2,W:2,L:0}}],roster:[{id:1,tid:1,fn:'Alex',stats:[{league:0,yr:1,season:[{tid:1,GP:1,PTS:30,REB:10,AST:2}]}]}]},
  {id:2,name:'Moons',season:[{yr:1,seasonStats:{GP:2,W:0,L:2}}],roster:[{id:2,tid:2,fn:'Sam',stats:[{league:0,yr:1,season:[{tid:2,GP:2,PTS:50,REB:12,AST:2}]}]}]}
 ]};
 const s=S.candidates(league).find(x=>x.story.type==='Season leaders').story;
 assert.match(s.paragraphs[0],/Alex.*30\.0 points per game/);assert.doesNotMatch(s.paragraphs.join(' '),/total|50 points/);
 const facts=S.factsForStory(s);assert.deepEqual(facts.rows[0],['Points','Alex','30.0']);assert.ok(!facts.headers.includes('Total'));
});
