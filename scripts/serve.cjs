/* Dependency-free local preview. Use the same address to retain the browser archive. */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'..');
const port = Number(process.env.HOOPWIRE_PORT || 8123);
http.createServer((req,res) => {
  let file;
  try { file = path.resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname === '/' ? '/index.html' : new URL(req.url,'http://localhost').pathname)); }
  catch { res.writeHead(400); res.end(); return; }
  if (!file.startsWith(root+path.sep) || path.relative(root,file).split(path.sep).some(p=>p.startsWith('.')) ||
      !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end('File unavailable'); return; }
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.wav':'audio/wav','.mp3':'audio/mpeg','.json':'application/json'})[path.extname(file)] || 'text/plain');
  fs.createReadStream(file).pipe(res);
}).on('error',error => { console.error(error.message); process.exitCode=1; })
  .listen(port,'127.0.0.1',()=>console.log(`HoopWire ready at http://127.0.0.1:${port}`));
