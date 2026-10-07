/* Team marks follow the white placement guides in the press-wall tile. */
(() => {
  "use strict";
  const logos=new Map(),templates=new WeakMap();
  const nativeNames=new Set(["atlanta", "boston", "brooklyn", "charlotte", "chicago", "cleveland", "dallas", "denver", "detroit", "houston", "indiana", "los_angeles", "memphis", "miami", "milwaukee", "minnesota", "new_orleans", "new_york", "oklahoma_city", "orlando", "philadelphia", "phoenix", "portland", "sacramento", "san_antonio", "san_diego", "san_francisco", "toronto", "utah", "washington"]);
  function template(image){
    if(templates.has(image))return templates.get(image);
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
    const white=i=>data[i]>245&&data[i+1]>245&&data[i+2]>245&&data[i+3]>200;
    const mask=new Uint8Array(canvas.width*canvas.height),slots=[];
    let blue=[15,77,163];
    for(let n=0;n<mask.length;n++){mask[n]=white(n*4)?1:0;if(!mask[n]&&data[n*4+3]>200)blue=[...data.slice(n*4,n*4+3)];}
    for(let n=0;n<mask.length;n++)if(mask[n]){
      const queue=[n];mask[n]=0;let minX=canvas.width,minY=canvas.height,maxX=0,maxY=0;
      for(let j=0;j<queue.length;j++){
        const pos=queue[j],x=pos%canvas.width,y=Math.floor(pos/canvas.width);
        minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
        for(const next of [x>0?pos-1:-1,x<canvas.width-1?pos+1:-1,y>0?pos-canvas.width:-1,y<canvas.height-1?pos+canvas.width:-1])if(next>=0&&mask[next]){mask[next]=0;queue.push(next);}
      }
      if(maxX-minX>=8&&maxY-minY>=8)slots.push({x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1});
    }
    for(let i=0;i<data.length;i+=4)if(white(i)){data[i]=blue[0];data[i+1]=blue[1];data[i+2]=blue[2];}
    ctx.putImageData(pixels,0,0);
    const leagueSlots=slots.map(slot=>({...slot,x:(slot.x+slot.width)%canvas.width}));
    const result={canvas,slots,leagueSlots};templates.set(image,result);return result;
  }
  async function logoFor(team,savedData){
    const requested=savedData||team?.logoURL,native=nativeNames.has(requested);
    const url=native?'team-logos/'+requested+'.png':requested;
    if(!native&&!window.HoopWireCourt.validURL(url))return null;
    if(!logos.has(url))logos.set(url,(async()=>{
      const source=await window.HoopWireCourt.loadImage(url,!native);
      const canvas=document.createElement('canvas'),scale=Math.min(1,512/Math.max(source.width,source.height));
      canvas.width=Math.max(1,Math.round(source.width*scale));canvas.height=Math.max(1,Math.round(source.height*scale));
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(source,0,0,canvas.width,canvas.height);
      // Hoop Land logos are small pixel art; anything that size is drawn on
      // whole-pixel multiples instead of being smoothed into a blur.
      return {image:canvas,data:canvas.toDataURL('image/png'),pixel:Math.max(source.width,source.height)<=128};
    })().catch(()=>{logos.delete(url);return null;}));
    return logos.get(url);
  }
  // Hoop Land draws a varsity letter for a team without a logo. The letter
  // sheet's tones are palette slots (red 20 fill, 10 inner line, 5 outer
  // line) that take the team's primary, secondary and tertiary colors.
  const sheet=new Image();sheet.src='player-assets/team-letters.png';
  const defaultLeague=new Image();defaultLeague.src='scene-assets/hoop-land-logo.png';
  const ready=image=>image.complete&&image.naturalWidth?Promise.resolve(image):image.decode().then(()=>image);
  const color=(hex,fallback)=>{const v=/^#?[\da-f]{6}$/i.test(String(hex||''))?String(hex).replace('#',''):fallback;return [0,2,4].map(i=>parseInt(v.slice(i,i+2),16));};
  async function varsityLetter(team){
    const letter=String(team?.city||team?.name||'').match(/[A-Za-z]/)?.[0]?.toUpperCase();
    if(!letter)return null;
    await ready(sheet);
    const index=letter.charCodeAt(0)-65,canvas=document.createElement('canvas');canvas.width=canvas.height=32;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(sheet,index%8*32,Math.floor(index/8)*32,32,32,0,0,32,32);
    const tones={20:color(team?.teamColors?.[0],'1d428a'),10:color(team?.teamColors?.[1],'ffffff'),5:color(team?.teamColors?.[2]||team?.teamColors?.[0],'1d428a')};
    const pixels=ctx.getImageData(0,0,32,32),data=pixels.data;
    for(let i=0;i<data.length;i+=4){const tone=tones[data[i]];if(data[i+3]&&tone){data[i]=tone[0];data[i+1]=tone[1];data[i+2]=tone[2];}}
    ctx.putImageData(pixels,0,0);
    return {image:canvas,pixel:true};
  }
  // The mark sits inside a transparent margin; trim it so the slot fits the
  // mark itself and it can be shown at a clean half size.
  let trimmed=null;
  async function hoopLand(){
    if(trimmed)return trimmed;
    await ready(defaultLeague);
    const w=defaultLeague.naturalWidth,h=defaultLeague.naturalHeight,full=document.createElement('canvas');full.width=w;full.height=h;
    const fctx=full.getContext('2d',{willReadFrequently:true});fctx.drawImage(defaultLeague,0,0);
    const data=fctx.getImageData(0,0,w,h).data;let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let i=3;i<data.length;i+=4)if(data[i]){const n=(i-3)/4,x=n%w,y=Math.floor(n/w);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
    if(maxX<0)return trimmed={image:full,pixel:true};
    const canvas=document.createElement('canvas');canvas.width=maxX-minX+1;canvas.height=maxY-minY+1;
    canvas.getContext('2d').drawImage(full,minX,minY,canvas.width,canvas.height,0,0,canvas.width,canvas.height);
    return trimmed={image:canvas,pixel:true};
  }
  async function render(background,team,savedData,{scale:resolution=1,league=null,leagueData=null}={}){
    const base=template(background),canvas=document.createElement('canvas');canvas.width=Math.round(background.width*resolution);canvas.height=Math.round(background.height*resolution);
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(base.canvas,0,0,canvas.width,canvas.height);
    const [loaded,leagueLoaded]=await Promise.all([logoFor(team,savedData).catch(()=>null),logoFor(league,leagueData).catch(()=>null)]);
    // Fall back the way the game does: a varsity letter, then the Hoop Land mark.
    const logo=loaded||await varsityLetter(team).catch(()=>null),leagueLogo=leagueLoaded||await hoopLand().catch(()=>null);
    ctx.imageSmoothingQuality='high';
    function marks(mark,slots,fraction){
      const image=mark?.image;if(!image)return;
      // Large photographs and vector logos are smoothed once, straight to
      // their final size.
      for(const slot of slots){
        const fit=Math.min((slot.width-2)*resolution*fraction/image.width,(slot.height-2)*resolution*fraction/image.height);
        // Pixel art grows without smoothing, like the wall and the players,
        // in whole-pixel steps from 2x so lettering stays even. Smoothing
        // would blur it when it shrinks, so it shrinks only to three quarters,
        // which drops every fourth line and still reads cleanly. A slot too
        // small even for that gets the smoothed fit.
        const room=Math.min((slot.width-2)*resolution/image.width,(slot.height-2)*resolution/image.height);
        const scale=mark.pixel?(fit>=2?Math.floor(fit):fit>=1?fit:room>=.75?.75:fit):fit,w=image.width*scale,h=image.height*scale;
        ctx.imageSmoothingEnabled=!mark.pixel||scale<.75;
        ctx.drawImage(image,Math.round(slot.x*resolution+(slot.width*resolution-w)/2),Math.round(slot.y*resolution+(slot.height*resolution-h)/2),Math.round(w),Math.round(h));
      }
    }
    marks(logo,base.slots,1);
    marks(leagueLogo,base.leagueSlots,.5);
    return {canvas,logoData:loaded?.data||null,leagueLogoData:leagueLoaded?.data||null,
      leagueStatus:leagueLoaded?'loaded':leagueLogo?'default':league?.logoURL?'unavailable':'missing',
      status:loaded?'loaded':logo?'letter':team?.logoURL?'unavailable':'missing',slots:base.slots,leagueSlots:base.leagueSlots,tileWidth:background.width*2,tileHeight:background.height*2};
  }

  function paint(ctx,wall,camera){
    const [x,y,w,h]=camera;
    // The wall is rendered at the camera's resolution, so this is close to
    // 1:1 and nearest-neighbor keeps every mark sharp.
    ctx.save();ctx.imageSmoothingEnabled=false;
    ctx.scale(ctx.canvas.width/w,ctx.canvas.height/h);ctx.translate(-x,-y);
    for(let top=Math.floor(y/wall.tileHeight)*wall.tileHeight;top<y+h;top+=wall.tileHeight){
      for(let left=Math.floor(x/wall.tileWidth)*wall.tileWidth;left<x+w;left+=wall.tileWidth){
        ctx.drawImage(wall.canvas,left,top,wall.tileWidth,wall.tileHeight);
      }
    }
    ctx.restore();
  }
  window.HoopWirePressBackdrop={render,paint};
})();
