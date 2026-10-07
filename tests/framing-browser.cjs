const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const root=path.resolve(__dirname,'..'),save=JSON.parse(fs.readFileSync(path.join(root,'sample_save'),'utf8'));
const server=http.createServer((req,res)=>{const f=path.resolve(root,'.'+new URL(req.url,'http://localhost').pathname.replace(/^\/$/,'/index.html'));if(!f.startsWith(root+path.sep)||!fs.existsSync(f)){res.writeHead(404);return res.end();}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'})[path.extname(f)]||'application/octet-stream');fs.createReadStream(f).pipe(res);});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;try{
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 const url=`http://127.0.0.1:${server.address().port}`;await page.goto(url);const ready=()=>page.waitForFunction(()=>!document.getElementById('saveFile').disabled);await ready();
 await page.locator('#saveFile').setInputFiles({name:'league.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(save))});await ready();
 const previews=await page.evaluate(async()=>{
  const a=await new HoopWireArchive().open();const stories=await a.all('stories');a.db.close();
  const interview=stories.find(s=>s.sceneInputs.kind==='interview'),action=stories.find(s=>s.sceneInputs.kind==='action');
  const variants=[...HoopWireScenes.interviewVariants.map(v=>['interview',v]),...['drive-tight','shot-close-up','pass-tight','dunk-tight'].map(v=>['action',v])],results=[];
  for(const [kind,variant] of variants){
   const scene=structuredClone((kind==='interview'?interview:action).sceneInputs);scene.kind=kind;
   if(kind==='interview')scene.interview=HoopWireScenes.interviewDesign(scene.seed,variant);
   else {scene.action=HoopWireScenes.actionDesign(scene.seed,variant,'right');scene.pose=scene.action.pose;}
   const result=await HoopWireScenes.render(scene),base64=await new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.readAsDataURL(result.imageBlob);});
   results.push({variant,caption:result.imageCaption,base64});
  }
  return results;
 });
 assert.equal(new Set(previews.map(p=>p.base64)).size,8);
 const deskMatches=await page.evaluate(async previews=>{
  async function load(base64){const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();return image;}
  const group=await load(previews.find(p=>p.variant==='group').base64),close=await load(previews.find(p=>p.variant==='player-close-up').base64);
  const expected=document.createElement('canvas'),actual=document.createElement('canvas');expected.width=actual.width=768;expected.height=actual.height=432;
  const e=expected.getContext('2d'),a=actual.getContext('2d');e.imageSmoothingEnabled=a.imageSmoothingEnabled=false;
  e.drawImage(group,...HoopWireScenes.interviewDesign('', 'player-close-up').camera,0,0,768,432);a.drawImage(close,0,0);
  const ep=e.getImageData(0,400,768,32).data,ap=a.getImageData(0,400,768,32).data;
  return ep.every((value,i)=>value===ap[i]);
 },previews);assert.equal(deskMatches,true,'The interview close-up must enlarge the desk with the same camera crop as the player');

 for(const preview of previews)fs.writeFileSync(path.join(root,'artifacts',preview.variant+'.png'),Buffer.from(preview.base64,'base64'));
 const sheet=await page.evaluate(async previews=>{
  const c=document.createElement('canvas');c.width=1536;c.height=512;const ctx=c.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.fillStyle='#092033';ctx.fillRect(0,0,c.width,c.height);
  for(let i=0;i<previews.length;i++){const x=(i%4)*384,y=Math.floor(i/4)*256,img=new Image();img.src='data:image/png;base64,'+previews[i].base64;await img.decode();ctx.drawImage(img,x,y+30,384,216);ctx.fillStyle='#fff';ctx.font='16px Arial';ctx.fillText(previews[i].variant,x+12,y+22);}
  return c.toDataURL().split(',')[1];
 },previews);fs.writeFileSync(path.join(root,'artifacts/framing-preview.png'),Buffer.from(sheet,'base64'));
 const before=await page.evaluate(async()=>{const a=await new HoopWireArchive().open();try{const rows=await a.all('stories'),chosen=['interview','action'].map(kind=>rows.find(s=>s.sceneInputs.kind===kind));await a.write({stories:chosen.map(s=>({...s,sceneInputs:{...s.sceneInputs,version:6,interview:undefined}}))});return chosen.map(s=>({id:s.id,paragraphs:s.paragraphs,stats:s.playerStats,createdAt:s.createdAt}));}finally{a.db.close();}});
 await page.reload();await ready();
 const after=await page.evaluate(async ids=>{const a=await new HoopWireArchive().open();try{return await Promise.all(ids.map(id=>a.get('stories',id)));}finally{a.db.close();}},before.map(s=>s.id));
 for(let i=0;i<before.length;i++){assert.equal(after[i].sceneInputs.version,10);assert.deepEqual(after[i].paragraphs,before[i].paragraphs);assert.deepEqual(after[i].playerStats,before[i].stats);assert.equal(after[i].createdAt,before[i].createdAt);}
 assert.deepEqual(errors,[]);console.log('Framing checks passed: four interview views, four player action close-ups, distinct images and archived image upgrades preserving stories and stats.');
}finally{if(browser)await browser.close();await new Promise(r=>server.close(r));}})().catch(e=>{console.error(e.stack);process.exitCode=1;});
