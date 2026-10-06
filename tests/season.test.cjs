const test=require('node:test'),assert=require('node:assert/strict'),S=require('../season-coverage');
function fixture(){return {leagueName:'Test',leagueType:0,shortName:'T',season:{startingYear:1,currentYear:1,totalGames:2,schedule:[],playoffs:[]},awards:[{id:2,name:'MVP',enabled:true,phase:0}],teams:[1,2].map(id=>({id,name:`Team ${id}`,roster:[{id,tid:id,fn:'Player',ln:String(id),stats:[{league:0,yr:1,season:[{tid:id,GP:2,PTS:0,REB:0,AST:0,STL:0,BLK:0}]}],awards:id===1?[{id:2,league:0,yearsWon:[1]}]:[]}],season:[{yr:1,seasonStats:{GP:2,W:1,L:1},seed:id}]}))};}
test('regular wraps require every team completed; placeholders do not block finished records',()=>{let l=fixture();assert.ok(S.candidates(l).some(x=>x.story.eventKey==='regular-wrap'));l.teams[0].season[0].seasonStats.GP=1;assert.equal(S.candidates(l).length,0);});
test('awards require recorded winner, correct league/year and milestone; zero stats and ties survive',()=>{const l=fixture(),c=S.candidates(l);assert.equal(c.filter(x=>x.story.type==='Award announcement').length,1);assert.match(c.find(x=>x.story.type==='Award announcement').story.paragraphs[1],/0\.0 points, 0\.0 rebounds and 0\.0 assists/);assert.equal(c.find(x=>x.story.eventKey==='leaders').story.seasonSnapshot.rows.length,10);l.teams[0].roster[0].awards[0].league=1;assert.equal(S.candidates(l).filter(x=>x.story.type==='Award announcement').length,0);});
test('brackets exclude byes, produce active previews, and crown only confirmed winners',()=>{const l=fixture();l.season.playoffs=[{yr:1,rounds:[{series:[{topSeed:1,lowerSeed:2,firstTo:1,winner:0},{topSeed:1,lowerSeed:0,winner:1}]}]}];assert.equal(S.candidates(l).find(x=>x.story.type==='Playoff preview').story.seasonSnapshot.rows.length,1);l.season.playoffs[0].rounds[0].series.pop();l.season.playoffs[0].rounds[0].series[0].winner=1;assert.ok(S.candidates(l).some(x=>x.story.eventKey==='championship'));assert.ok(!S.candidates(l).some(x=>x.story.type==='Playoff preview'));});
test('season totals aggregate transfers but exclude another league/year and playoffs',()=>{const l=fixture(),p=l.teams[0].roster[0];p.stats[0].season.push({GP:1,PTS:10,REB:2,AST:1});p.stats[0].playoffs=[{GP:1,PTS:99,REB:99,AST:99}];p.stats.push({league:1,yr:1,season:[{GP:1,PTS:999,REB:999,AST:999}]});assert.deepEqual(S.stats(p,l,1),{GP:3,PTS:10,REB:2,AST:1});l.season.currentYear=2;assert.equal(S.candidates(l).length,0);});
test('later awards add independent events without changing existing milestone identities',()=>{const l=fixture(),before=S.candidates(l).map(x=>x.story.id);l.awards.push({id:6,name:'Most Improved',enabled:true,phase:0});assert.deepEqual(S.candidates(l).map(x=>x.story.id),before);l.teams[0].roster[0].awards.push({id:6,league:0,yearsWon:[1]});const after=S.candidates(l).map(x=>x.story.id);assert.equal(after.length,before.length+1);assert.ok(before.every(id=>after.includes(id)));});
test('postseason awards wait for a champion and use postseason stats',()=>{const l=fixture(),p=l.teams[0].roster[0];l.awards.push({id:1,name:'Finals MVP',enabled:true,phase:3});p.awards.push({id:1,league:0,yearsWon:[1]});p.stats[0].finals=[{GP:1,PTS:27,REB:0,AST:0}];assert.ok(!S.candidates(l).some(x=>x.story.eventKey==='award-1-1'));l.teams[0].championships={league:0,yearsWon:[1]};const story=S.candidates(l).find(x=>x.story.eventKey==='award-1-1').story;assert.match(story.paragraphs[1],/27\.0 points, 0\.0 rebounds and 0\.0 assists/);assert.equal(story.seasonSnapshot.featuredPlayer.finalsStats.PTS,27);});

test('team reviews use only that team’s save totals, including traded players',()=>{const l=fixture(),p=l.teams[0].roster[0];p.stats[0].season[0].PTS=10;p.stats[0].season.push({tid:2,GP:1,PTS:90,REB:3,AST:2});const story=S.candidates(l).find(x=>x.story.eventKey==='team-1-regular').story;const table=story.seasonSnapshot.tables.find(t=>t.label==='Regular-season player statistics');assert.equal(table.rows[0][2],'5.0');assert.equal(table.rows[0][10],10);assert.match(story.paragraphs.join(' '),/10 points/);assert.doesNotMatch(story.paragraphs.join(' '),/first to|across .*regular-season games|saved|recorded/);});

test('award tables include all league stints while team tables stay team-specific',()=>{const l=fixture(),p=l.teams[0].roster[0];p.stats[0].season[0].PTS=10;p.stats[0].season.push({tid:2,GP:1,PTS:90,REB:3,AST:2});const story=S.candidates(l).find(x=>x.story.eventKey==='award-2-1').story;const table=story.seasonSnapshot.tables.find(t=>t.label==='Regular-season player statistics');assert.equal(table.rows[0][10],100);assert.equal(table.rows[0][1],3);});
test('coach and player season quotes reflect winning records and championships',()=>{
 const coach={fn:'Adrian',ln:'Hunt'},player={fn:'Alex',ln:'Star'};
 for(const wins of [60,64,70]){const lines=S.quoteLines('same',{W:wins,L:82-wins},false,coach,player).join(' ');assert.match(lines,/great season|great|success|proud|earned/i);assert.doesNotMatch(lines,/tough|not good|not enough|fictional|disappoint/i);}
 assert.match(S.quoteLines('same',{W:11,L:71},false,coach,player).join(' '),/tough|not good enough/i);
 assert.match(S.quoteLines('same',{W:14,L:18},true,coach,player).join(' '),/champion|title/i);
 assert.equal(S.outcome({W:41,L:41}),'balanced');
});
test('playoff disappointment overrides regular-season success without confusing champions',()=>{
 const coach={fn:'Casey',ln:'Coach'},player={fn:'Alex',ln:'Star'};
 for(const result of ['missed','eliminated','runnerup','injury'])assert.match(S.quoteLines('test',{W:60,L:22},false,coach,player,result).join(' '),/disappoint|hurts|frustrat|bitter|hate|hard/i);
 const teams=new Map([[1,{}],[2,{}],[3,{}],[4,{}]]),bracket={rounds:[{series:[{topSeed:1,lowerSeed:2,winner:1},{topSeed:3,lowerSeed:0,winner:3}]},{series:[{topSeed:1,lowerSeed:3,winner:1}]}]};
 assert.equal(S.postseasonOutcome(1,bracket,1,teams),'champion');assert.equal(S.postseasonOutcome(3,bracket,1,teams),'runnerup');assert.equal(S.postseasonOutcome(2,bracket,1,teams),'eliminated');assert.equal(S.postseasonOutcome(4,bracket,1,teams),'missed');
});
test('individual awards show only the featured player and the relevant stat period',()=>{
 const l=fixture();const story=S.candidates(l).find(x=>x.story.eventKey==='award-2-1').story;
 const facts=S.factsForStory(story);assert.equal(facts.rows.length,1);assert.equal(facts.rows[0][0],'Player 1');assert.ok(!facts.headers.includes('Team'));assert.ok(!story.seasonSnapshot.tables.some(t=>t.label.includes('team statistics')));
 story.statsPeriod='finals';story.seasonSnapshot.featuredPlayer.finalsStats={GP:2,PTS:50,REB:4,AST:0};assert.equal(S.factsForStory(story).rows[0][2],'25.0');
});
test('62-20 and 64-18 teams still in the playoffs always receive proud season quotes',()=>{
 const l=fixture();l.season.totalGames=82;l.season.playoffs=[{yr:1,rounds:[{series:[{topSeed:1,lowerSeed:2,winner:0,firstTo:4}]}]}];
 for(const [i,wins] of [62,64].entries()){l.teams[i].season[0].seasonStats={GP:82,W:wins,L:82-wins};l.teams[i].frontOffice={staff:[{id:100+i,tid:l.teams[i].id,pos:1,fn:'Coach',ln:String(i)}]};}
 for(const story of S.candidates(l).filter(x=>x.story.eventKey.startsWith('team-')).map(x=>x.story)){
   const quotes=story.paragraphs.filter(p=>p.startsWith('“'));assert.equal(quotes.length,2);assert.ok(quotes.every(p=>/proud|outstanding|tremendous|earned/i.test(p)));assert.doesNotMatch(quotes.join(' '),/disappoint|tough|get back to work|fictional|do better|not good enough/i);
 }
 for(let i=0;i<50;i++)assert.doesNotMatch(S.quoteLines(String(i),{W:62,L:20},false,{fn:'Coach'},null).join(' '),/disappoint|fictional|do better/i);
});
