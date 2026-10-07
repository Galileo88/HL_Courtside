/* In-world advertisements built from local game sprites and HoopWire branding. */
(() => {
  "use strict";
  const artCache=new Map();
  function node(tag,cls,text){const e=document.createElement(tag);e.className=cls;if(text)e.textContent=text;return e;}
  function suitArt(hosts){
    const key=JSON.stringify(hosts.slice(0,3));
    if(!artCache.has(key))artCache.set(key,window.HoopWirePlayer.ready().then(()=>{
      const canvas=document.createElement('canvas');canvas.width=300;canvas.height=180;
      const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      const gradient=ctx.createLinearGradient(0,0,300,180);gradient.addColorStop(0,'#35352e');gradient.addColorStop(1,'#11171c');ctx.fillStyle=gradient;ctx.fillRect(0,0,300,180);
      ctx.strokeStyle='#b8a371';ctx.lineWidth=1;ctx.strokeRect(12,12,276,156);
      hosts.slice(0,3).forEach((host,i)=>{
        const person={...host,wearsSuit:true,suits:[{jacketC:['252A32','DDD2BA','5A292E'][i],shirtC:'FFFFFF',tieC:i?'5A292E':'B8A371',pantC:['252A32','DDD2BA','5A292E'][i],shoeC:'141020',headAcc:'0000'}]};
        const sprite=document.createElement('canvas');sprite.width=32;sprite.height=42;
        window.HoopWirePlayer.draw(sprite,person,null,0,0,'suit-standing',i===2?'right':'left');
        const pixels=sprite.getContext('2d').getImageData(0,0,32,42).data;
        let top=42,bottom=0;
        for(let y=0;y<42;y++)for(let x=0;x<32;x++)if(pixels[(y*32+x)*4+3]){top=Math.min(top,y);bottom=Math.max(bottom,y+1);}
        const width=96,height=(bottom-top)*3,x=12+i*90,y=(canvas.height-height)/2;
        ctx.fillStyle='rgba(0,0,0,.35)';ctx.beginPath();ctx.ellipse(x+width/2,y+height-2,21,4,0,0,Math.PI*2);ctx.fill();
        ctx.drawImage(sprite,0,top,32,bottom-top,x,y,width,height);
      });
      return canvas.toDataURL('image/png');
    }));
    return artCache.get(key);
  }
  function drinkArt(){
    if(!artCache.has('drink'))artCache.set('drink',window.HoopWireCourt.loadImage('scene-assets/bottle.png').then(source=>{
      const canvas=document.createElement('canvas');canvas.width=300;canvas.height=156;const ctx=canvas.getContext('2d');ctx.imageSmoothingEnabled=false;
      ctx.fillStyle='#0b3245';ctx.fillRect(0,0,300,156);
      const colors=[[44,197,239],[255,157,44],[161,216,58]];
      colors.forEach((color,i)=>{
        const tile=document.createElement('canvas');tile.width=source.width;tile.height=source.height;const t=tile.getContext('2d');t.drawImage(source,0,0);
        const pixels=t.getImageData(0,0,tile.width,tile.height);
        // Leave the cap white and retain the bottle's light/shadow values.
        for(let y=1;y<tile.height;y++)for(let x=0;x<tile.width;x++){
          const offset=(y*tile.width+x)*4;if(!pixels.data[offset+3])continue;
          const shade=(pixels.data[offset]+pixels.data[offset+1]+pixels.data[offset+2])/765;
          color.forEach((channel,k)=>pixels.data[offset+k]=Math.round(channel*shade));
        }
        t.putImageData(pixels,0,0);ctx.fillStyle='#062433';ctx.beginPath();ctx.ellipse(64+i*86,139,31,7,0,0,Math.PI*2);ctx.fill();
        ctx.drawImage(tile,37+i*86,i===1?15:27,54,108);
      });
      return canvas.toDataURL('image/png');
    }));return artCache.get('drink');
  }
  function render({studio,story,onWatch,product}){
    const promos=node('section','wire-promos');promos.setAttribute('aria-label','In-world advertisements');
    const seed=Array.from(story?.id||'hoopwire').reduce((sum,c)=>sum+c.charCodeAt(0),0);
    const drink=(product|| (seed%2?'drink':'suit'))==='drink';
    const ad=node('section',drink?'wire-drink-ad':'wire-suit-ad');ad.setAttribute('aria-label',drink?'Overtime sports drink advertisement':'Courtside luxury suit advertisement');
    ad.append(node('span','wire-ad-label','Advertisement'),node('h2',drink?'wire-drink-brand':'wire-suit-brand',drink?'OVERTIME':'COURTSIDE'),node('span','wire-suit-collection',drink?'SPORTS DRINK':'THE TAILORED COLLECTION'));
    const art=node('img','wire-product-art');art.width=300;art.height=drink?156:180;art.alt=drink?'Blue, citrus and lime bottles made from the Hoop Land bottle sprite':'Three tailored suits illustrated with Hoop Land character sprites';
    const hosts=studio?.inputs?.announcers||window.HoopWireTV.inputs({teams:[]}).announcers;
    (drink?drinkArt():suitArt(hosts)).then(src=>{art.src=src;art.dataset.ready='true';}).catch(()=>art.remove());
    ad.append(art,node('p','wire-suit-tagline',drink?'Stay in the game.':'Dress for the moment.'));promos.append(ad);
    if(story){
      const tv=node('section','wire-tv-ad');tv.setAttribute('aria-label','HoopWire TV advertisement');
      const logo=node('img','');logo.src='assets/hoopwire_logo.png';logo.alt='HoopWire TV';logo.width=1336;logo.height=366;
      const watch=node('button','primary','Watch Now!');watch.addEventListener('click',()=>onWatch(story));
      tv.append(node('span','wire-ad-label','Advertisement'),node('span','wire-tv-ad-show','THE DAILY DESK'),logo,node('strong','wire-tv-ad-time','NIGHTLY · 10 PM'),watch);promos.append(tv);
    }
    return promos;
  }
  window.HoopWireNewsroomPromos={render};
})();
