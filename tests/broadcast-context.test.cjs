const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../broadcast-context'),B=require('../broadcast-content');
const game=(gid,day,won,homeRecord,awayRecord)=>({gid,day,gameType:0,
  home:{id:1,name:'Stars',score:won?100:90},away:{id:2,name:'Moons',score:won?90:100},homeRecord,awayRecord});
const story=g=>({id:'league:1:game:'+g.gid,fingerprint:'league',season:1,day:g.day,gid:g.gid,gameSummary:{home:g.home,away:g.away},playerId:7,playerName:'Alex Star',playerStats:{PTS:22,REB:4,AST:6,FGM:8,FGA:15}});
function source(games){const days={};for(const g of games){days[g.day]||={};days[g.day][g.gid]=g;}return {id:'league',gameResults:{1:days}};}
const angle=(s,c)=>B.selectAngle(B.selectEvidence(s,c));

test('a proven consecutive record chain identifies a winning run and its end',()=>{
  const games=[game(1,1,false,[0,1],[1,0]),game(2,2,true,[1,1],[1,1]),game(3,3,true,[2,1],[1,2]),game(4,4,true,[3,1],[1,3])];
  const s=story(games[3]),context=C.buildContext(s,{league:source(games)});
  assert.equal(context.teams[1].streak.length,3);assert.equal(angle(s,context),'streak');
  assert.match(B.script(s,context)[0].text,/3 straight (?:wins|losses)/);
  games.push(game(5,5,false,[3,2],[2,3]));
  const ended=C.buildContext(story(games[4]),{league:source(games)});
  assert.deepEqual(ended.teams[1].streak.ended,{won:true,length:3});
  assert.match(B.script(story(games[4]),ended)[0].text,/3-game (?:winning|losing) streak is over/);
});
test('losing runs and a breakthrough win are distinct supported stories',()=>{
  const games=[game(1,1,true,[1,0],[0,1]),game(2,2,false,[1,1],[1,1]),game(3,3,false,[1,2],[2,1]),game(4,4,false,[1,3],[3,1]),game(5,5,true,[2,3],[3,2])];
  const lost=story(games[3]),ended=story(games[4]);
  assert.match(B.script(lost,C.buildContext(lost,{league:source(games)}))[0].text,/3 straight losses/);
  assert.match(B.script(ended,C.buildContext(ended,{league:source(games)}))[0].text,/3-game losing streak is over/);
});
test('missing history, unbounded archives and ambiguous same-day order suppress exact streaks',()=>{
  const games=[game(1,1,true,[5,2],[2,5]),game(2,2,true,[6,2],[2,6]),game(3,3,true,[7,2],[2,7])];
  const s=story(games[2]);assert.equal(C.buildContext(s,{league:source(games)}).teams[1].streak,null);
  games[0]=game(1,1,false,[0,1],[1,0]); // missing games between record counts
  assert.equal(C.buildContext(s,{league:source(games)}).teams[1].streak,null);
  games.push(game(4,3,true,[8,2],[2,8]));
  assert.equal(C.buildContext(s,{league:source(games)}).teams[1],null);
});
test('context excludes later days and other leagues and seasons without mutating sources',()=>{
  const g=game(1,1,true,[1,0],[0,1]),s=story(g),league=source([g,game(2,2,false,[1,1],[1,1])]);
  league.gameResults[2]={1:{99:game(99,1,false,[5,5],[8,2])}};
  const snapshot={fingerprint:'league',season:1,day:1,gid:1,pid:7,stats:{GP:1,PTS:22}};
  const snapshots=[snapshot,{...snapshot,day:2},{...snapshot,season:2},{...snapshot,fingerprint:'other'}];
  const before=JSON.stringify({s,league,snapshots}),context=C.buildContext(s,{league,snapshots});
  assert.equal(context.game.gid,1);assert.equal(context.snapshots.length,1);assert.equal(context.teams[1].streak.length,1);
  assert.equal(C.buildContext(s,{league:{...league,id:'other'}}).game,undefined);
  context.snapshots[0].stats.PTS=99;assert.equal(JSON.stringify({s,league,snapshots}),before);
});
test('result enrichment requires a matching score and preserves older verified fields',()=>{
  const g=game(1,1,true,[1,0],[0,1]),old={gid:1,home:g.home,away:g.away};
  const enriched=C.enrichResult(old,g);assert.deepEqual(enriched.homeRecord,[1,0]);assert.equal(enriched.gameType,0);
  assert.deepEqual(C.enrichResult(enriched,{...g,home:{...g.home,score:105}}),enriched);
  assert.deepEqual(C.enrichResult(enriched,{...old,homeRecord:[-1,0]}).homeRecord,[1,0]);
  assert.equal(old.homeRecord,undefined);
});
test('a verified upset outranks a blowout and a featured performance; small samples do not',()=>{
  const g=game(1,8,true,[3,5],[7,1]),s={...story(g),playerStats:{PTS:45,REB:10,AST:10}};
  const context=C.buildContext(s,{league:source([g])});assert.equal(angle(s,context),'upset');
  assert.match(B.script(s,context)[0].text,/surprise|records|better-record|stronger record/);
  assert.equal(angle(s,C.buildContext(s,{league:source([{...g,homeRecord:[1,0],awayRecord:[3,1]}])})),'performance');
});
test('dated averages establish exceptional production; later totals never enter the segment',()=>{
  const s=story(game(1,8,true,[4,4],[4,4]));s.playerStats={PTS:31};
  s.cumulativeStats={season:{GP:50,PTS:5000}};assert.equal(angle(s,C.buildContext(s)),'routine');
  s.broadcastSnapshot={fingerprint:s.fingerprint,season:s.season,day:s.day,playerId:7,period:'season',average:{GP:8,PTS:160}};
  const context=C.buildContext(s);assert.equal(angle(s,context),'performance');assert.match(B.script(s,context).map(t=>t.text).join(' '),/20.0 points a game/);
  s.broadcastSnapshot.day=9;assert.equal(C.buildContext(s).average,undefined);
  s.broadcastSnapshot.day=8;s.broadcastSnapshot.average.GP=4;assert.equal(angle(s,C.buildContext(s)),'routine');
});
test('explicit consequences outrank other angles, but unverified flags cannot create stakes',()=>{
  const s=story(game(1,1,true,[1,0],[0,1])),context={consequence:{verified:true,kind:'elimination'}};
  assert.equal(angle(s,context),'elimination');context.consequence.verified=false;assert.equal(angle(s,context),'routine');
});
test('a championship announcement must identify this game, winner and day',()=>{
  const g=game(1,5,true,[3,2],[2,3]),s=story(g),title={...s,id:'title',gameSummary:undefined,seasonSnapshot:{newsEvent:{type:13,date:4,gid:1,tid:1}}};
  const context=C.buildContext(s,{league:source([g]),stories:[title]});assert.equal(angle(s,context),'championship');
  for(const newsEvent of [{...title.seasonSnapshot.newsEvent,gid:2},{...title.seasonSnapshot.newsEvent,tid:2},{...title.seasonSnapshot.newsEvent,date:5}]){
    assert.equal(C.buildContext(s,{league:source([g]),stories:[{...title,seasonSnapshot:{newsEvent}}]}).consequence,undefined);
  }
});
test('all non-game families keep facts, vary framing and avoid duplicate turns',()=>{
  const teams={relatedTeams:[{id:1,name:'Stars'},{id:2,name:'Moons'}],seasonSnapshot:{teamRecords:[{teamId:1,record:{W:8,L:2,GP:10,PTS:1100,OPP:1000}},{teamId:2,record:{W:7,L:3,GP:10,PTS:1000,OPP:1100}}]}};
  const fixtures=[
    {...teams,type:'Team season review'},
    {...teams,type:'Playoff preview',eventKey:'playoff-round-2',seasonSnapshot:{...teams.seasonSnapshot,rows:[['Stars','Moons','Best of 7']]}},
    {...teams,type:'Championship review',seasonSnapshot:{...teams.seasonSnapshot,rows:[['Stars','Moons',1]]}},
    {type:'Season leaders',seasonSnapshot:{rows:[['PTS','Alex',200,10],['REB','Sam',100,10]]}},
    {type:'Award announcement',headline:'Alex wins MVP',seasonSnapshot:{rows:[['MVP','Alex']],featuredPlayer:{name:'Alex',regularStats:{GP:10,PTS:200,AST:50}}}},
    {type:'Signing',headline:'Alex signs with Stars',paragraphs:['Stars have signed Alex to a two-year deal.']},
    {type:'Injury',headline:'Alex sidelined',paragraphs:['Alex has an expected absence of three games.']},
    {type:'Retirement',headline:'Alex retires',paragraphs:['Alex has retired from basketball.']}
  ];
  for(const fixture of fixtures){
    const opens=new Set(),closes=new Set();
    for(let i=0;i<40;i++){
      const s={...fixture,id:'family-'+i},turns=B.script(s),text=turns.map(t=>t.text).join(' ');
      opens.add(turns[0].text);closes.add(turns.at(-1).text);
      assert.equal(turns[0].speaker,0);assert.equal(new Set(turns.map(t=>t.text)).size,turns.length);
      assert.doesNotMatch(text,/undefined|NaN|simulation|provided statistics|game engine|we (?:watched|interviewed)/i);
      assert.ok(turns.length<=14);
    }
    assert.ok(opens.size>=4,fixture.type);assert.ok(closes.size>=4,fixture.type);
  }
});
test('the writer limits supporting threads even when history and many stats are available',()=>{
  const s=story(game(1,10,true,[3,7],[8,2]));s.playerStats={PTS:40,REB:10,AST:10,FGM:15,FGA:20,TPM:5,TPA:7,TO:5};
  const context={game:game(1,10,true,[3,7],[8,2]),teams:{1:{streak:{won:true,length:3}}}};
  const e=B.selectEvidence(s,context),threads=B.supportingThreads(e,B.selectAngle(e));
  assert.equal(threads.length,2);assert.ok(threads.some(t=>t.key==='continuity'));
  assert.ok(B.script(s,context).length<=14);
});
test('angle thresholds match core policy and a close score cannot manufacture game flow',()=>{
  const s=story(game(1,1,true,[1,0],[0,1]));s.playerStats=null;
  for(const [margin,expected] of [[1,'close'],[3,'close'],[4,'routine'],[11,'routine'],[12,'blowout']]){
    s.gameSummary.home.score=s.gameSummary.away.score+margin;
    assert.equal(angle(s,{}),expected);assert.ok(B.script(s).length<=4);
    assert.doesNotMatch(B.script(s).map(t=>t.text).join(' '),/comeback|collapse|buzzer|fourth quarter|rallied|escaped/);
  }
});
test('stable variants provide distinct openings and endings for each game angle',()=>{
  const base=story(game(1,1,true,[1,0],[0,1]));base.playerStats=null;
  const contexts={routine:{},close:{},blowout:{},performance:{},upset:{game:game(1,1,true,[3,5],[7,1])},streak:{teams:{1:{streak:{won:true,length:3}}}},championship:{consequence:{kind:'championship',verified:true}},elimination:{consequence:{kind:'elimination',verified:true}}};
  for(const [expected,context] of Object.entries(contexts)){
    const openings=new Set(),closings=new Set();
    for(let i=0;i<80;i++){
      const s=structuredClone(base);s.id='variant-'+i;
      if(expected==='close')s.gameSummary.home.score=92;
      if(expected==='blowout')s.gameSummary.home.score=120;
      if(expected==='performance')s.playerStats={PTS:40};
      const turns=B.script(s,context);assert.equal(angle(s,context),expected);assert.deepEqual(turns,B.script(s,context));
      openings.add(turns[0].text);closings.add(turns.at(-1).text);
      assert.ok(turns.every(t=>Number.isInteger(t.speaker)&&t.speaker>=0&&t.speaker<4));
    }
    assert.ok(openings.size>=4,expected+' openings');assert.ok(closings.size>=4,expected+' closings');
  }
});
