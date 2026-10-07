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
      return {image:canvas,data:canvas.toDataURL('image/png')};
    })().catch(()=>{logos.delete(url);return null;}));
    return logos.get(url);
  }
  async function render(background,team,savedData,{scale:resolution=1,league=null,leagueData=null}={}){
    const base=template(background),canvas=document.createElement('canvas');canvas.width=background.width*resolution;canvas.height=background.height*resolution;
    const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.drawImage(base.canvas,0,0,canvas.width,canvas.height);
    const [logo,leagueLogo]=await Promise.all([logoFor(team,savedData).catch(()=>null),logoFor(league,leagueData).catch(()=>null)]);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    function marks(image,slots,fraction){
      if(!image)return;
      for(const slot of slots){
        const scale=Math.min((slot.width-2)*resolution*fraction/image.width,(slot.height-2)*resolution*fraction/image.height),w=image.width*scale,h=image.height*scale;
        ctx.drawImage(image,Math.round(slot.x*resolution+(slot.width*resolution-w)/2),Math.round(slot.y*resolution+(slot.height*resolution-h)/2),Math.round(w),Math.round(h));
      }
    }
    marks(logo?.image,base.slots,1);
    marks(leagueLogo?.image,base.leagueSlots,.5);
    return {canvas,logoData:logo?.data||null,leagueLogoData:leagueLogo?.data||null,leagueStatus:leagueLogo?'loaded':league?.logoURL?'unavailable':'missing',status:logo?'loaded':team?.logoURL?'unavailable':'missing',slots:base.slots,leagueSlots:base.leagueSlots,tileWidth:background.width*2,tileHeight:background.height*2};
  }

  function paint(ctx,wall,camera){
    const [x,y,w,h]=camera;
    ctx.save();ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
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
