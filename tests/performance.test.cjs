const test=require('node:test'),assert=require('node:assert/strict');
const P=require('../performance-coverage'),B=require('../broadcast-content'),S=require('../season-coverage');
function fixture(){
 const box=(PTS,REB,AST,STL,TO)=>({GP:1,PTS,REB,AST,STL,TO,MIN:[600,600,0,0,0,0]});
 const player=(id,tid,name,gameStats)=>({id,tid,fn:name,gameStats,stats:[{yr:8,league:0,season:[{tid,GP:11,PTS:200+gameStats.PTS,REB:40+gameStats.REB,AST:40+gameStats.AST,STL:20+gameStats.STL,TO:20+gameStats.TO}]}]});
 return {leagueName:'Test',leagueType:0,season:{startingYear:1,currentYear:8,currentDay:0,schedule:[{results:[{gId:1,gameType:0,tRound:0,homeTeam:1,awayTeam:2,homeScore:30,awayScore:10,winner:1,potg:11,homeRecord:[8,3],awayRecord:[3,8]}]}]},
  teams:[{id:1,name:'Stars',roster:[player(11,1,'Alex',box(30,6,2,3,1))]},{id:2,name:'Moons',roster:[player(22,2,'Sam',box(10,2,6,1,3))]}]};
}
test('exact fifty-percent changes trigger all five categories in both directions',()=>{
 const baseline={GP:10,PTS:200,REB:40,AST:40,STL:20,TO:20};
 const high=P.compare({PTS:30,REB:6,AST:6,STL:3,TO:3},baseline);
 const low=P.compare({PTS:10,REB:2,AST:2,STL:1,TO:1},baseline);
 assert.ok(high.every(c=>c.qualifies&&c.change===.5));assert.ok(low.every(c=>c.qualifies&&c.change===-.5));
 assert.ok(high.filter(c=>c.key!=='TO').every(c=>c.favorable));assert.equal(high.at(-1).favorable,false);assert.equal(low.at(-1).favorable,true);
 assert.equal(P.compare({PTS:29},{GP:10,PTS:200})[0].qualifies,false);
 assert.equal(P.compare({PTS:11},{GP:10,PTS:200})[0].qualifies,false);
});
test('zero averages and absent or invalid categories never manufacture a comparison',()=>{
 assert.deepEqual(P.compare({PTS:10},{GP:10,PTS:0}),[]);
 assert.deepEqual(P.compare({PTS:10},{GP:0,PTS:10}),[]);
 assert.deepEqual(P.compare({PTS:-1,REB:NaN,AST:2},{GP:10,PTS:10,REB:10}),[]);
 assert.equal(P.average(1/30),'0.033');
});
test('one story per player includes both teams, pregame averages, mixed results and no percentages in reporting',()=>{
 const l=fixture(),before=JSON.stringify(l),rows=P.candidates(l);assert.equal(rows.length,2);
 assert.equal(JSON.stringify(l),before);
 for(const {story,context} of rows){
  assert.equal(story.type,'Mixed performance');assert.equal(story.performanceSnapshot.baseline.GP,10);
  assert.equal(story.performanceSnapshot.baseline.PTS,200);assert.equal(story.performanceSnapshot.comparisons.length,5);
  assert.equal(context.potg.id,story.playerId);assert.equal(context.potgSnapshot.pid,story.playerId);
  const prose=[story.headline,...story.paragraphs,...B.script(story).map(t=>t.text)].join(' ');
  assert.doesNotMatch(prose,/%|percent|50%|player of the game/i);assert.match(prose,/20\.0/);
  assert.equal(story.performanceSnapshot.comparisons[0].key,'PTS');
 }
 assert.match(rows.find(x=>x.story.playerId===11).story.headline,/big scoring night/);
 assert.match(rows.find(x=>x.story.playerId===22).story.headline,/quiet scoring night/);
 assert.deepEqual(P.candidates(l).map(x=>x.story.id),rows.map(x=>x.story.id));
});
test('turnovers alone can lead positive or negative coverage',()=>{
 const l=fixture();for(const t of l.teams){const p=t.roster[0];Object.assign(p.stats[0].season[0],{PTS:p.gameStats.PTS*11,REB:p.gameStats.REB*11,AST:p.gameStats.AST*11,STL:p.gameStats.STL*11});}
 const stories=P.candidates(l).map(x=>x.story);
 assert.equal(stories.length,2);assert.ok(stories.every(s=>s.performanceSnapshot.comparisons.filter(c=>c.qualifies)[0].key==='TO'));
 assert.equal(stories.find(s=>s.playerId===11).type,'Above expectations');assert.equal(stories.find(s=>s.playerId===22).type,'Below expectations');
});
test('first appearances, DNPs, ambiguous games and unverified box scores do not create stories',()=>{
 for(const change of [l=>l.teams.forEach(t=>t.roster[0].stats[0].season[0].GP=1),
  l=>l.teams.forEach(t=>t.roster[0].gameStats.MIN[0]=0),l=>l.teams.forEach(t=>t.roster[0].gameStats.DNP=1),
  l=>l.season.schedule[0].results.push({...l.season.schedule[0].results[0],gId:2}),
  l=>l.teams.forEach(t=>t.roster[0].gameStats.PTS++)]){
   const l=fixture();change(l);assert.equal(P.candidates(l).length,0);
 }
});
test('playoff games compare against the regular season without subtracting playoff totals',()=>{
 const l=fixture();l.season.schedule[0].results[0].tRound=1;
 l.teams.forEach(t=>Object.assign(t.roster[0].stats[0].season[0],{GP:10,PTS:200,REB:40,AST:40,STL:20,TO:20}));
 const rows=P.candidates(l);assert.equal(rows.length,2);assert.equal(rows[0].story.performanceSnapshot.baseline.PTS,200);
 assert.match(rows[0].story.paragraphs.at(-1),/before the playoffs/);
});
test('baselines combine team stints and stay fixed when later saves are loaded',()=>{
 const l=fixture(),p=l.teams[0].roster[0],total=p.stats[0].season[0];
 p.stats[0].season=[{...total,GP:6,PTS:130,REB:26,AST:22,STL:13,TO:11},{tid:99,GP:5,PTS:100,REB:20,AST:20,STL:10,TO:10}];
 const story=P.candidates(l).find(x=>x.story.playerId===11).story;
 assert.equal(story.performanceSnapshot.baseline.PTS,200);
 p.stats[0].season[0].PTS+=100;
 const live=S.refreshTVStory(story,l);assert.deepEqual(live.performanceSnapshot,story.performanceSnapshot);
 assert.deepEqual(B.script(live),B.script(story));
});
test('daily coverage skips older team games and matches league and year',()=>{
 const l=fixture();l.teams[0].roster[0].stats.push({yr:7,league:0,season:[{GP:10,PTS:9999,REB:9999,AST:9999}]});
 l.teams[0].roster[0].stats.push({yr:8,league:1,season:[{GP:10,PTS:9999,REB:9999,AST:9999}]});
 assert.equal(P.candidates(l)[0].story.performanceSnapshot.baseline.PTS,200);
 const g=l.season.schedule[0].results[0];l.season.schedule.push({results:[{...g,gId:2}]});
 assert.ok(P.candidates(l).every(x=>x.story.gid===2&&x.story.day===2));
});
module.exports={fixture};
