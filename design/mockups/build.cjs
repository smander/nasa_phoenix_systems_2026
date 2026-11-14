// Builds the Polar Window design mockups from src/template.html + data/mockdata.json.
// Outputs:
//   polar-window-mockups.html     page body (for publishing as an Artifact; the host adds the document skeleton)
//   index.html                    standalone document for opening locally in a browser
const fs = require('fs');
const path = require('path');
const here = __dirname;
const tpl = fs.readFileSync(path.join(here, 'src/template.html'), 'utf8');
const data = fs.readFileSync(path.join(here, 'data/mockdata.json'), 'utf8').replace(/<\//g, '<\\/');
const body = tpl.replace('__MOCKDATA__', () => data);
fs.writeFileSync(path.join(here, 'polar-window-mockups.html'), body);
const standalone = '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
fs.writeFileSync(path.join(here, 'index.html'), standalone);
console.log('built', (Buffer.byteLength(body) / 1024).toFixed(0) + ' KB');
