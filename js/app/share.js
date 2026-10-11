/* Shares a story as one image: the picture on top, then the headline, the story and its stat
   sheets, signed with the HoopWire banner. Phones open the share sheet; computers download it. */
(() => {
  'use strict';
  const WIDTH = 600,
    SCALE = 1080 / WIDTH;
  let renderer = null;
  // The renderer loads the first time someone shares, so pages never wait on it.
  function library() {
    renderer ||= new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'js/vendor/html2canvas.min.js';
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => {
        renderer = null;
        reject(new Error('The share image could not be prepared.'));
      };
      document.head.append(script);
    });
    return renderer;
  }
  const site = () => (location.host + location.pathname).replace(/\/(index\.html)?$/, '');
  // A copy of the article laid out like a page: picture first, links as plain text, no buttons.
  function sheet(article) {
    const card = article.cloneNode(true);
    card.querySelectorAll('.article-share, .article-back, .replay-button, .replay-canvas').forEach(n => n.remove());
    card.querySelectorAll('a').forEach(a => {
      const span = document.createElement('span');
      span.className = a.className.replace(/\b(entity-link|board-link)\b/g, '').trim();
      span.append(...a.childNodes);
      a.replaceWith(span);
    });
    const figure = card.querySelector('.article-image');
    if (figure) {
      figure.querySelector('figcaption')?.remove();
      card.prepend(figure);
    }
    const footer = document.createElement('footer');
    footer.className = 'share-footer';
    const banner = document.createElement('img');
    banner.src = 'assets/brand/hoopwire_banner.png';
    banner.alt = 'HoopWire';
    const address = document.createElement('span');
    address.textContent = site();
    footer.append(banner, address);
    card.append(footer);
    const page = document.createElement('div');
    page.className = 'share-sheet';
    page.style.width = WIDTH + 'px';
    page.append(card);
    return page;
  }
  const loaded = img =>
    img.complete ? Promise.resolve() : new Promise(resolve => img.addEventListener('load', resolve, { once: true }));
  async function image(article) {
    const html2canvas = await library(),
      page = sheet(article);
    document.body.append(page);
    try {
      await Promise.all([...page.querySelectorAll('img')].map(loaded));
      const canvas = await html2canvas(page, {
        scale: SCALE,
        width: WIDTH,
        windowWidth: WIDTH,
        backgroundColor: getComputedStyle(page).backgroundColor,
        useCORS: true,
        logging: false,
      });
      return await new Promise((resolve, reject) =>
        canvas.toBlob(b => (b ? resolve(b) : reject(new Error('The share image could not be made.'))), 'image/png')
      );
    } finally {
      page.remove();
    }
  }
  const fileName = headline =>
    'hoopwire-' +
    (headline
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'story') +
    '.png';
  function download(file) {
    const url = URL.createObjectURL(file),
      link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  const ready = new WeakMap();
  // Hands a file over: the share sheet on a touch screen, a download on a computer. A phone refuses a
  // share that comes too long after the tap, so the file stays ready and the next tap shares it at once.
  async function deliver(button, make, title, label) {
    if (button.getAttribute('aria-busy') === 'true') return;
    const touch = matchMedia('(pointer: coarse)').matches;
    let file = ready.get(button);
    if (!file) {
      button.setAttribute('aria-busy', 'true');
      try {
        file = await make();
      } finally {
        button.removeAttribute('aria-busy');
      }
    }
    if (!touch || !navigator.canShare?.({ files: [file] })) {
      ready.delete(button);
      download(file);
      return;
    }
    try {
      await navigator.share({ files: [file], title });
      ready.delete(button);
    } catch (error) {
      if (error.name === 'NotAllowedError') {
        ready.set(button, file);
        button.classList.add('is-ready');
        button.setAttribute('aria-label', 'Ready. Tap to share.');
        return;
      }
      ready.delete(button);
      if (error.name !== 'AbortError') download(file);
    }
    button.classList.remove('is-ready');
    button.setAttribute('aria-label', label);
  }
  const share = (button, article, headline) =>
    deliver(
      button,
      async () => new File([await image(article)], fileName(headline), { type: 'image/png' }),
      headline,
      'Share story'
    );
  function button(article, headline) {
    const node = document.createElement('button');
    node.type = 'button';
    node.className = 'article-share';
    node.title = 'Share';
    node.setAttribute('aria-label', 'Share story');
    node.innerHTML =
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 0L7.5 7.5M12 3l4.5 4.5M8 10H6a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1h-2"/></svg>';
    node.addEventListener('click', () =>
      share(node, article, headline).catch(error => {
        node.removeAttribute('aria-busy');
        node.title = error.message;
      })
    );
    return node;
  }
  window.HoopWireShare = { button, image, deliver };
})();
