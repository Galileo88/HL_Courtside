/* In-world advertisements built from local game sprites and HoopWire branding. */
(() => {
  'use strict';
  const artCache = new Map();
  function node(tag, cls, text) {
    const e = document.createElement(tag);
    e.className = cls;
    if (text) e.textContent = text;
    return e;
  }
  function brandArt(file, colors) {
    const key = JSON.stringify([file, colors]);
    if (!artCache.has(key))
      artCache.set(
        key,
        HoopWireCourt.loadImage('assets/scene/' + file).then(source => {
          const canvas = document.createElement('canvas');
          canvas.width = source.width;
          canvas.height = source.height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(source, 0, 0);
          ctx.globalCompositeOperation = 'source-in';
          const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
          colors.forEach((color, i) => gradient.addColorStop(i / (colors.length - 1), color));
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          return canvas.toDataURL('image/png');
        })
      );
    return artCache.get(key);
  }
  function suitArt(hosts) {
    const key = JSON.stringify(hosts.slice(0, 3));
    if (!artCache.has(key))
      artCache.set(
        key,
        window.HoopWirePlayer.ready().then(() => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 180;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          const gradient = ctx.createLinearGradient(0, 0, 300, 180);
          gradient.addColorStop(0, '#35352e');
          gradient.addColorStop(1, '#11171c');
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 300, 180);
          ctx.strokeStyle = '#b8a371';
          ctx.lineWidth = 1;
          ctx.strokeRect(12, 12, 276, 156);
          hosts.slice(0, 3).forEach((host, i) => {
            const person = {
              ...host,
              wearsSuit: true,
              suits: [
                {
                  jacketC: ['252A32', 'DDD2BA', '5A292E'][i],
                  shirtC: 'FFFFFF',
                  tieC: i ? '5A292E' : 'B8A371',
                  pantC: ['252A32', 'DDD2BA', '5A292E'][i],
                  shoeC: '141020',
                  headAcc: '0000',
                },
              ],
            };
            const sprite = document.createElement('canvas');
            sprite.width = 32;
            sprite.height = 42;
            window.HoopWirePlayer.draw(sprite, person, null, 0, 0, 'suit-standing', i === 2 ? 'right' : 'left');
            const pixels = sprite.getContext('2d').getImageData(0, 0, 32, 42).data;
            let top = 42,
              bottom = 0;
            for (let y = 0; y < 42; y++)
              for (let x = 0; x < 32; x++)
                if (pixels[(y * 32 + x) * 4 + 3]) {
                  top = Math.min(top, y);
                  bottom = Math.max(bottom, y + 1);
                }
            const width = 96,
              height = (bottom - top) * 3,
              x = 12 + i * 90,
              y = (canvas.height - height) / 2;
            ctx.fillStyle = 'rgba(0,0,0,.35)';
            ctx.beginPath();
            ctx.ellipse(x + width / 2, y + height - 2, 21, 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(sprite, 0, top, 32, bottom - top, x, y, width, height);
          });
          return canvas.toDataURL('image/png');
        })
      );
    return artCache.get(key);
  }
  function drinkArt() {
    if (!artCache.has('drink'))
      artCache.set(
        'drink',
        Promise.resolve().then(() => {
          const canvas = document.createElement('canvas');
          canvas.width = 300;
          canvas.height = 156;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          const glow = ctx.createRadialGradient(150, 70, 6, 150, 70, 170);
          glow.addColorStop(0, '#16788c');
          glow.addColorStop(1, '#0b3245');
          ctx.fillStyle = glow;
          ctx.fillRect(0, 0, 300, 156);
          // Rising bubbles, kept clear of the edges.
          ctx.fillStyle = 'rgba(121,255,244,.16)';
          for (const [x, y, r] of [
            [36, 40, 5],
            [62, 92, 3],
            [118, 28, 4],
            [186, 58, 3],
            [238, 34, 5],
            [266, 96, 3],
          ]) {
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
          }
          const flavors = [
            ['#2cc5ef', '#8be6ff', '#1987b0'],
            ['#ff9d2c', '#ffd08a', '#c96a0f'],
            ['#a1d83a', '#d6f58d', '#6d9a1d'],
          ];
          flavors.forEach((body, i) => {
            const art = HoopWireAdArt.bottle(HoopWireAdArt.SPORT_BOTTLE, {
              outline: '#062433',
              cap: ['#f4fbff', '#ffffff', '#b9cdd8'],
              body,
              label: ['#f4fbff', '#ffffff', '#c9dbe5'],
              stripe: ['#0b3245', '#0b3245', '#0b3245'],
            });
            const scale = i === 1 ? 4 : 3.6,
              w = art.width * scale,
              h = art.height * scale,
              x = 64 + i * 86 - w / 2;
            ctx.fillStyle = '#062433';
            ctx.beginPath();
            ctx.ellipse(64 + i * 86, 142, 30, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.drawImage(art, x, 142 - h, w, h);
          });
          HoopWireAdArt.blend(ctx, 300, 156, '#0b3245', 16);
          return canvas.toDataURL('image/png');
        })
      );
    return artCache.get('drink');
  }
  // Every campaign gets its turn: they share one slot (sized to the tallest,
  // or to the rail on desktop) and the next one fades in every 15 seconds.
  // Hovering or focusing an ad holds it, and a hidden tab doesn't rotate.
  const rotateMs = 15000;
  function rotation(products, seed, creativeFor) {
    const slot = node('div', 'wire-ad-rotator'),
      start = seed % products.length;
    const ads = products.map((_, i) => creativeFor(products[(start + i) % products.length]));
    let current = 0,
      held = false,
      shown = false;
    const activate = index =>
      ads.forEach((ad, i) => {
        const on = i === index;
        ad.classList.toggle('is-active', on);
        ad.inert = !on;
        on ? ad.removeAttribute('aria-hidden') : ad.setAttribute('aria-hidden', 'true');
      });
    activate(0);
    slot.append(...ads);
    slot.addEventListener('pointerenter', () => {
      held = true;
    });
    slot.addEventListener('pointerleave', () => {
      held = false;
    });
    slot.addEventListener('focusin', () => {
      held = true;
    });
    slot.addEventListener('focusout', () => {
      held = false;
    });
    const timer = setInterval(() => {
      if (!slot.isConnected) {
        if (shown) clearInterval(timer);
        return;
      }
      shown = true;
      if (held || document.hidden) return;
      current = (current + 1) % ads.length;
      activate(current);
    }, rotateMs);
    return slot;
  }
  const catalog = {
    suit: {
      bg: '#171d20',
      title: 'Hartley',
      logo: 'brand7.png',
      subtitle: 'THE TAILORED COLLECTION',
      tagline: 'Dress for the moment.',
      alt: 'Three tailored suits illustrated with Hoop Land character sprites',
      cls: 'wire-suit-ad',
    },
    drink: {
      bg: '#0b3245',
      title: 'Zero-G',
      logo: 'brand.png',
      colors: ['#79fff4', '#26c6e8'],
      subtitle: 'FUEL YOUR NEXT QUARTER',
      tagline: 'Stay in the game.',
      alt: 'Blue, citrus and lime bottles made from the Hoop Land bottle sprite',
      cls: 'wire-drink-ad',
    },
    'movie-drama': {
      bg: '#221422',
      title: 'LAST POSSESSION',
      subtitle: 'A HOOPWIRE PICTURES FILM',
      tagline: 'One shot. Everything on the line.',
      alt: 'Sprite actors on a floodlit basketball court in the fictional Last Possession movie poster',
      cls: 'wire-movie-ad wire-movie-drama',
    },
    'movie-thriller': {
      bg: '#080f22',
      title: 'MIDNIGHT TRANSFER',
      subtitle: 'A HOOPWIRE PICTURES FILM',
      tagline: 'Every deal has a dark side.',
      alt: 'Suited sprite actors against a city skyline in the fictional Midnight Transfer movie poster',
      cls: 'wire-movie-ad wire-movie-thriller',
    },
    shoes: {
      bg: '#0a1823',
      title: 'Stride',
      logo: 'brand3.png',
      colors: ['#7fd9ff', '#f7fbff'],
      subtitle: 'COURT 01 · BASKETBALL FOOTWEAR',
      tagline: 'Own your next step.',
      alt: 'Supplied blue shoe artwork centered on a spotlighted display platform',
      cls: 'wire-shoe-ad',
    },
    airways: {
      bg: '#17314b',
      title: 'Horizon Airways',
      logo: 'brand2.png',
      subtitle: 'THE AWAY GAME COLLECTION',
      tagline: 'Your next destination awaits.',
      alt: 'Suited sprite traveler against a sunset skyline',
      cls: 'wire-airways-ad',
    },
    streaming: {
      bg: '#091423',
      title: 'LifeStream',
      logo: 'brand4.png',
      subtitle: 'YOUR WORLD. ON SCREEN.',
      tagline: 'Every story deserves a stage.',
      alt: 'Sprite presenters framed inside a broadcast studio screen',
      cls: 'wire-streaming-ad',
    },
    food: {
      bg: '#70252a',
      title: 'Monarch’s',
      logo: 'brand5.png',
      subtitle: 'THE POSTGAME STOP',
      tagline: 'Bring a royal appetite.',
      alt: 'Sprite basketball players gathering after the final buzzer',
      cls: 'wire-food-ad',
    },
    apparel: {
      bg: '#101a17',
      title: 'Trufit',
      logo: 'brand6.png',
      colors: ['#ceff69', '#79db86'],
      subtitle: 'BUILT FOR YOUR GAME',
      tagline: 'Work in. Stand out.',
      alt: 'Sprite basketball player shooting in athletic apparel',
      cls: 'wire-apparel-ad',
    },
    automotive: {
      bg: '#08101d',
      title: 'Kiyota',
      logo: 'brand8.png',
      colors: ['#dce5ee', '#a6b6c5'],
      subtitle: 'BUILT FOR WHAT COMES NEXT',
      tagline: 'Take the long way home.',
      alt: 'Kiyota pickup truck on a night road under arena lights',
      cls: 'wire-auto-ad',
    },
    beer: {
      bg: '#291811',
      title: 'American Heritage',
      logo: 'brand9.png',
      subtitle: 'A CLASSIC FINISH',
      tagline: 'Here’s to the final buzzer.',
      alt: 'Amber bottles composed from the supplied bottle sprite on a warm copper background',
      cls: 'wire-beer-ad',
    },
  };
  const artFor = (selected, hosts) =>
    selected === 'drink' ? drinkArt() : selected === 'suit' ? suitArt(hosts) : HoopWireAdArt.render(selected, hosts);
  const hostsFor = studio => studio?.inputs?.announcers || window.HoopWireTV.inputs({ teams: [] }).announcers;
  // An in-feed sponsor tile, shaped like a story card, for grids whose last
  // row would otherwise have an empty cell.
  function feedCard({ studio, index = 0 } = {}) {
    const products = Object.keys(catalog),
      selected = products[(index * 5 + 3) % products.length],
      creative = catalog[selected];
    const tile = node('aside', 'wire-feed-ad');
    tile.dataset.ad = selected;
    tile.setAttribute('aria-label', creative.title + ' advertisement');
    const frame = node('div', 'wire-feed-art');
    frame.style.background = creative.bg;
    const art = node('img', '');
    art.alt = creative.alt;
    art.width = 300;
    art.height = selected === 'drink' ? 156 : selected === 'automotive' ? 285 : 180;
    artFor(selected, hostsFor(studio))
      .then(src => {
        art.src = src;
        art.dataset.ready = 'true';
      })
      .catch(() => art.remove());
    frame.append(art);
    const body = node('div', 'wire-feed-body');
    body.append(
      node('span', 'wire-feed-label', 'Sponsored · ' + creative.title),
      node('h3', '', creative.tagline),
      node('span', 'wire-feed-sub', creative.subtitle)
    );
    tile.append(frame, body);
    return tile;
  }
  function render({ studio, story, onWatch, product }) {
    const promos = node('section', 'wire-promos');
    promos.setAttribute('aria-label', 'In-world advertisements');
    const seed = Array.from(story?.id || 'hoopwire').reduce((sum, c) => sum + c.charCodeAt(0), 0);
    const hosts = hostsFor(studio);
    function creativeFor(selected) {
      const creative = catalog[selected];
      const ad = node('section', creative.cls);
      ad.dataset.ad = selected;
      ad.setAttribute('aria-label', creative.title + ' advertisement');
      const brand = node('h2', 'wire-ad-brand');
      if (creative.logo) {
        const logo = node('img', 'wire-ad-logo');
        logo.alt = creative.title;
        if (creative.colors)
          brandArt(creative.logo, creative.colors)
            .then(src => {
              logo.src = src;
            })
            .catch(() => {
              logo.src = 'assets/scene/' + creative.logo;
            });
        else logo.src = 'assets/scene/' + creative.logo;
        logo.addEventListener(
          'error',
          () => {
            brand.textContent = creative.title;
          },
          { once: true }
        );
        brand.append(logo);
      } else brand.textContent = creative.title;
      // The body takes whatever height the slot gives every campaign alike.
      const body = node('div', 'wire-ad-body');
      body.append(brand, node('span', 'wire-suit-collection', creative.subtitle));
      const art = node('img', 'wire-product-art');
      art.width = 300;
      art.height = selected === 'drink' ? 156 : selected === 'automotive' ? 285 : 180;
      art.alt = creative.alt;
      const artwork = artFor(selected, hosts);
      artwork
        .then(src => {
          art.src = src;
          art.dataset.ready = 'true';
        })
        .catch(() => art.remove());
      body.append(art, node('p', 'wire-suit-tagline', creative.tagline));
      if (selected === 'beer') body.append(node('span', 'wire-ad-responsibility', 'Drink responsibly.'));
      if (selected.startsWith('movie-')) body.append(node('span', 'wire-movie-release', 'NOW SHOWING'));
      ad.append(node('span', 'wire-ad-label', 'Advertisement'), body);
      return ad;
    }
    if (Object.hasOwn(catalog, product)) promos.append(creativeFor(product));
    else promos.append(rotation(Object.keys(catalog), seed, creativeFor));
    if (story) {
      const tv = node('section', 'wire-tv-ad');
      tv.setAttribute('aria-label', 'HoopWire TV advertisement');
      const logo = node('img', '');
      logo.src = 'assets/brand/hoopwire_logo.png';
      logo.alt = 'HoopWire TV';
      logo.width = 1336;
      logo.height = 366;
      const watch = node('button', 'primary', 'Watch Now!');
      watch.addEventListener('click', () => onWatch(story));
      tv.append(
        node('span', 'wire-ad-label', 'Advertisement'),
        node('span', 'wire-tv-ad-show', 'THE DAILY DESK'),
        logo,
        node('strong', 'wire-tv-ad-time', 'NIGHTLY · 10 PM'),
        watch
      );
      promos.append(tv);
    }
    return promos;
  }
  window.HoopWireNewsroomPromos = { render, feedCard };
})();
