const http = require('http');
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '../../build');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json','.ico':'image/x-icon'};
http.createServer((req,res)=>{
  let file = path.resolve(root, '.' + decodeURIComponent(req.url.split('?')[0]));
  if (!file.startsWith(root + path.sep) && file !== root) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) file = path.join(root, 'index.html');
  res.writeHead(200, {'Content-Type':mime[path.extname(file)] || 'application/octet-stream'});
  fs.createReadStream(file).pipe(res);
}).listen(8765,'0.0.0.0',()=>console.log('Test build on port 8765 (mock database only when Playwright is running)'));
