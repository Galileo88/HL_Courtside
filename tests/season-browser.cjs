const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../core'),S=require('../season-coverage');
const save=JSON.parse(fs.readFileSync(process.argv[2]||path.join(root,'sample_save'),'utf8'));
if(process.env.HOOPWIRE_TEST_NEWS){
 const l=save.seasonLeagues[0],p=l.teams[0].roster[0];l.coaches||=[];l.coaches.push({id:900000,fn:'Test',ln:'Coach',tid:l.teams[0].id});
 l.season.news.push(...[16,17,22,25,26,28,29].map(type=>({league:l.leagueType,phase:l.season.phase,date:l.season.currentDay,type,tid:l.teams[0].id,pid:type>=26?900000:p.id,gid:0,data:{retiredNumber:{pid:p.id,num:54,yr:l.season.currentYear}}})));
}

const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':decodeURIComponent(req.url.split('?')[0])));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png'})[path.extname(file)]||'application/octet-stream');fs.createReadStream(file).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1100,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}`);const ready=()=>page.waitForFunction(()=>!document.getElementById('saveFile').disabled,{},{timeout:180000});await ready();
async function upload(){await page.locator('#saveFile').setInputFiles({name:'playoff-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await ready();assert.match(await page.locator('#status').textContent(),/^Save loaded/);}
await upload();const expected=save.seasonLeagues.reduce((n,l)=>n+new Set([...S.candidates(l),...require('../records-coverage').candidates(l),...require('../news-coverage').candidates(l)].map(x=>x.story.id)).size+C.candidates(l,C.buildFingerprint(l),new Map(C.captureSnapshots(l).map(s=>[s.id,s])),'full').length,0);
const backup=()=>page.evaluate(async()=>{const a=await new HoopWireArchive().open();try{return await a.exportData();}finally{a.db.close();}});
let original=await backup();if(process.env.HOOPWIRE_TEST_NEWS){for(const type of ['Retirement announcement','Retirement','Hall of Fame','Jersey retirement','Coach retirement','Coaching change'])assert.ok(original.stories.some(s=>s.type===type&&s.seasonSnapshot.newsEvent));}assert.equal(original.stories.length,expected);assert.ok(original.stories.filter(s=>s.kind==='season').every(s=>s.imageData&&s.seasonSnapshot&&s.relatedTeams.length));
await upload();assert.deepEqual(await backup(),original);
assert.ok(original.stories.filter(s=>s.kind==='season').every(s=>!s.paragraphs.join(' ').includes('fictional interview')));
await page.evaluate(async()=>{const a=await new HoopWireArchive().open();try{const s=(await a.all('stories')).find(s=>s.kind==='season');s.templateVersion=5;s.paragraphs=['Previously archived wording.'];await a.write({stories:[s]});}finally{a.db.close();}});
original=await backup();await page.reload();await ready();await upload();assert.deepEqual(await backup(),original);

assert.equal(await page.locator('.article-body table').count(),0);
await page.locator('.nav a[href="#tv"]').click();assert.ok(await page.locator('#tvSegment .tv-story-kicker').count()>0);assert.notEqual(await page.locator('#tvSegment h2').textContent(),'Season facts');assert.ok(await page.locator('#tvSegment .tv-board,#tvSegment .tv-matchup-grid,#tvSegment .tv-callout').count()>0);await page.screenshot({path:path.join(root,'artifacts/season-tv.png'),fullPage:true});
await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(root,'artifacts/season-tv-mobile.png'),fullPage:true});
assert.ok(await page.locator('#tvSegment,.box-table-scroll').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)));
await page.locator('.nav a[href="#newsroom"]').click();await page.locator('.wire-lead').click();await page.locator('.article-body p').first().evaluate(p=>p.append(' '+ 'LongPlayerName'.repeat(12)));
assert.ok(await page.locator('.article-card').evaluateAll(nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)));
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);

await page.evaluate(async data=>{const a=await new HoopWireArchive().open();try{for(const l of data.leagues)await a.reset(l.id);await a.importData(data);}finally{a.db.close();}},original);assert.deepEqual(await backup(),original);assert.deepEqual(errors,[]);
console.log(`Season browser checks passed: ${expected} stories, frozen images, season TV, mobile, export/import.`);
}finally{await browser?.close();server.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
