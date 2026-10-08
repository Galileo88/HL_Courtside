const test=require('node:test'),assert=require('node:assert/strict'),N=require('../news-coverage');
function fixture(){return {leagueName:'Test League',shortName:'TL',leagueType:0,season:{currentYear:8,startingYear:1,currentDay:4,phase:9,schedule:[],news:[]},teams:[{id:1,name:'Stars',roster:[{id:11,tid:1,fn:'Alex',ln:'Star',stats:[{yr:8,league:0,season:[{tid:1,GP:10,PTS:100,REB:50,AST:30}]}]}],frontOffice:{staff:[{id:91,tid:1,pos:1,fn:'Casey',ln:'Coach'}]}},{id:2,name:'Moons',roster:[]}],coaches:[{id:92,tid:0,fn:'Pat',ln:'Retired'}],awards:[{id:2,name:'MVP'}]};}
function event(type,patch={}){return {league:0,date:4,phase:9,type,tid:1,pid:11,gid:0,data:{},...patch};}
test('retirement announcement, retirement, Hall of Fame and retired jersey are distinct events',()=>{const l=fixture();l.season.news=[event(16),event(17),event(22),event(25,{data:{retiredNumber:{pid:11,num:0,yr:8}}})];const rows=N.candidates(l).map(x=>x.story);assert.equal(rows.length,4);assert.match(rows[0].headline,/plans to retire/);assert.match(rows[1].headline,/calls it a career/);assert.match(rows[2].headline,/Hall of Fame/);assert.match(rows[3].headline,/No. 0/);assert.ok(rows.every(s=>s.paragraphs.join(' ').includes('10.0 points')));assert.equal(new Set(rows.map(s=>s.id)).size,4);});
test('coach hires, releases, firings and retirements resolve staff and never use player career stats',()=>{const l=fixture();l.season.news=[26,27,28,29].map(type=>event(type,{pid:91}));l.season.news.push(event(29,{pid:92,tid:0}));const rows=N.candidates(l);assert.equal(rows.length,5);assert.match(rows[2].story.paragraphs[0],/fired coach Casey Coach/);assert.match(rows[4].story.headline,/Pat Retired retires/);assert.ok(rows.every(x=>!x.story.paragraphs.join(' ').includes('career spans')));});
test('trade direction follows the outgoing side and destination, including picks',()=>{const l=fixture();l.season.news=[event(7,{data:{trade:{status:1,teams:[{tid:1,assets:[{pid:11,tid:2}]},{tid:2,assets:[{pid:0,tid:1,draftPick:{yr:9,rd:1}}]}]}}})];const s=N.candidates(l)[0].story;assert.deepEqual(s.seasonSnapshot.rows[0],['Stars','Alex Star','Moons']);assert.deepEqual(s.seasonSnapshot.rows[1],['Moons','a 9 first-round pick','Stars']);assert.match(s.headline,/Moons acquire Alex Star from Stars/);assert.match(s.paragraphs[0],/^The Stars acquired a 9 first-round pick from the Moons in exchange for Alex Star\./);l.season.news[0].data.trade.status=0;assert.equal(N.candidates(l).length,0);});
test('source evidence is retained; read flags and field order do not create duplicates',()=>{const l=fixture();l.season.news=[event(3,{data:{contract:{yrs:3,pid:11}}})];const s=N.candidates(l)[0].story;l.season.news[0].read=true;l.season.news[0].data.contract={pid:11,yrs:3};assert.equal(N.candidates(l)[0].story.id,s.id);assert.equal(s.seasonSnapshot.newsEvent.data.contract.yrs,3);l.season.news.push(structuredClone(l.season.news[0]));assert.equal(N.candidates(l).length,1);});
test('unknown types, wrong leagues, future announcements and missing identities are not guessed',()=>{const l=fixture();l.season.news=[event(999),event(17,{league:1}),event(17,{date:5}),event(17,{pid:999}),event(17,{phase:8})];assert.equal(N.candidates(l).length,0);});
test('award and championship events share existing milestone identities; game recap events are not duplicated',()=>{const l=fixture();l.season.news=[event(12,{data:{awardId:2}}),event(13),event(9)];const rows=N.candidates(l).map(x=>x.story);assert.equal(rows.length,2);assert.equal(rows[0].eventKey,'award-2-11');assert.equal(rows[1].eventKey,'championship');});
test('injury disappointment overrides a winning season for coach and injured player',()=>{const l=fixture();l.teams[0].season=[{yr:8,seasonStats:{W:60,L:22}}];l.season.news=[event(10,{data:{injury:{gamesOut:5}}})];const text=N.candidates(l)[0].story.paragraphs.join(' ');assert.match(text,/head coach Casey Coach said/);assert.match(text,/Alex Star said/);assert.match(text,/disappoint|frustrat|hate/);assert.doesNotMatch(text,/fictional interview|great season/);});
test('a finished college season keeps its beat on the pro calendar with save-backed offseason features',()=>{
 const save=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'..','sample_save'),'utf8')),[pro,college]=save.seasonLeagues;
 const champ=college.teams[0].id,full=college.season.schedule,end=day=>{college.season.schedule=full.slice(0,day+1);college.season.news=[...college.season.news.filter(n=>n.type!==13),{league:1,date:day,phase:college.season.phase,type:13,tid:champ,pid:0,gid:0,data:{}}];};
 assert.equal(N.offseason(pro,save.seasonLeagues).length,0);
 end(10);const cal=N.calendar(college,save.seasonLeagues);assert.equal(cal.over,true);assert.equal(cal.day,33);assert.equal(cal.own,11);
 const rows=N.offseason(college,save.seasonLeagues).map(x=>x.story);
 // Before the offseason nobody has declared, so only the board and the seniors run.
 assert.deepEqual(rows.map(s=>s.eventKey),['offseason-draft-watch','offseason-seniors']);
 assert.ok(rows.every(s=>s.day===33&&s.seasonSnapshot.board.rows.length>=3));
 assert.ok(rows[1].seasonSnapshot.roundup.items.every(x=>x.year==='Sr.'));
 assert.doesNotMatch(rows.flatMap(s=>s.paragraphs).join(' '),/projected|counted as gone|returning next season/);
 assert.ok(N.candidates(college,save.seasonLeagues).every(x=>x.story.day>=11&&x.story.day<=33));
 college.season.news.push({league:1,date:20,phase:college.season.phase,type:17,tid:college.teams[0].id,pid:college.teams[0].roster[0].id,gid:0,data:{}},{league:1,date:10,phase:college.season.phase,type:17,tid:college.teams[0].id,pid:college.teams[0].roster[1].id,gid:0,data:{}});
 const dated=N.candidates(college,save.seasonLeagues).filter(x=>x.story.type==='Retirement').map(x=>x.story.day).sort((a,b)=>a-b);assert.deepEqual(dated,[11,21]);
 // The features run a week apart on the pro calendar.
 end(28);assert.deepEqual(N.offseason(college,save.seasonLeagues).map(x=>x.story.eventKey),['offseason-draft-watch']);
 // No pro league, or a college season still in progress: nothing new.
 assert.equal(N.offseason(college,[college]).length,0);
});
test('the college offseason reports the real draft class, who is back and the official preseason poll',()=>{
 const save=JSON.parse(require('fs').readFileSync(require('path').join(__dirname,'..','sample_save'),'utf8')),[pro,college]=save.seasonLeagues;
 const last=college.season.currentYear,next=last+1;college.season.currentYear=next;college.season.schedule=[];
 const players=college.teams.flatMap(t=>t.roster);
 for(const p of players)p.yrs=Math.max(1,p.yrs|0);
 // Five players leave for the draft: off the rosters and into the pro draft class.
 const gone=college.teams.slice(0,5).map(t=>t.roster.shift());pro.draftClass=gone;
 college.teams.forEach((t,i)=>{t.season=[...(t.season||[]),{yr:next,poll:i+1,seed:0,seasonStats:{GP:0,W:0,L:0}}];});
 const rows=N.offseason(college,save.seasonLeagues).map(x=>x.story),key=k=>rows.find(s=>s.eventKey===k);
 assert.deepEqual(rows.map(s=>s.eventKey),['offseason-draft-class','offseason-returning','offseason-preseason-poll']);
 assert.match(key('offseason-draft-class').headline,new RegExp(`five college players into the ${next} draft`));
 const leaving=new Set(gone.map(p=>`${p.fn} ${p.ln}`));assert.ok(key('offseason-returning').seasonSnapshot.roundup.items.every(x=>!leaving.has(x.name)));
 const poll=key('offseason-preseason-poll');assert.match(poll.paragraphs[0],new RegExp(`${next} .* preseason poll is out`));assert.equal(poll.seasonSnapshot.board.rows[0][0],college.teams[0].city+' '+college.teams[0].name);
 assert.ok(rows.every(s=>s.day===1));
});
