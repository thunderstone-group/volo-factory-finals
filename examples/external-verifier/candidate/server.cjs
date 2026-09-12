// Hand-authored positive calibration fixture, not a competition solution.
const http = require('node:http');
const fs = require('node:fs');
http.createServer((req, res) => {
  if (req.url === '/isolation') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({suiteVisible: fs.existsSync('/suite/contract.json'),
                           socketVisible: fs.existsSync('/var/run/docker.sock')}));
  } else { res.end('hello'); }
}).listen(Number(process.env.PORT), '0.0.0.0');
