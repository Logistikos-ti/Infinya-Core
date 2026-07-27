const fs = require('fs');
const zlib = require('zlib');

const html = fs.readFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Infinoos/Infinoos WMS/infinoos-wms-coletor-operador.html', 'utf8');
const match = html.match(/<script type=\"__bundler\/manifest\">\s*(.*?)\s*<\/script>/s);

if (match) {
  const manifest = JSON.parse(match[1]);
  for (const key in manifest) {
    if (manifest[key].mime === 'text/jsx' || manifest[key].mime === 'text/javascript') {
      const data = Buffer.from(manifest[key].data, 'base64');
      
      if (manifest[key].compressed) {
        zlib.gunzip(data, (err, decompressed) => {
          if (!err) {
            fs.writeFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Projects & Softwares/Our WMS/wms-evolveg/scratch/unpacked_' + key + '.jsx', decompressed);
            console.log('Unpacked compressed', key);
          } else {
             console.error(err);
          }
        });
      } else {
        fs.writeFileSync('C:/Users/admin/OneDrive/Desktop/Claude/Projects & Softwares/Our WMS/wms-evolveg/scratch/unpacked_' + key + '.jsx', data);
        console.log('Unpacked', key);
      }
    }
  }
}
