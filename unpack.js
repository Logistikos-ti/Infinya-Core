const fs = require('fs');
const zlib = require('zlib');
const html = fs.readFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Infinoos/Infinoos WMS/Configurações/infinoos-wms-usuarios.html', 'utf8');

const match = html.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
if (!match) {
  console.log("No manifest found");
  process.exit(1);
}

const manifest = JSON.parse(match[1].trim());

for (const uuid in manifest) {
  const entry = manifest[uuid];
  if (entry.mime === 'text/javascript' || entry.mime === 'text/babel' || entry.mime === 'text/html' || entry.mime === 'application/javascript') {
    const buf = Buffer.from(entry.data, 'base64');
    const decompressed = entry.compressed ? zlib.gunzipSync(buf) : buf;
    fs.writeFileSync('scratch_' + uuid + '.js', decompressed);
    console.log('Wrote', uuid);
  }
}
