import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

const htmlPath = 'C:\\Users\\admin\\OneDrive\\Desktop\\Claude\\Infinoos\\Infinoos WMS\\Configurações\\infinoos-wms-depositantes.html';
const destHtmlPath = 'C:\\Users\\admin\\Downloads\\infinoos-wms-depositantes.html';

// Copy to Downloads if not exists
try {
  fs.copyFileSync(htmlPath, destHtmlPath);
  console.log(`Copied HTML to ${destHtmlPath}`);
} catch (e) {
  console.log(`Error copying: ${e.message}`);
}

const content = fs.readFileSync(htmlPath, 'utf8');

// Find template
const templateMatch = content.match(/<script type="__bundler\/template">([\s\S]*?)<\/script>/);
// Find manifest
const manifestMatch = content.match(/<script type="__bundler\/manifest">([\s\S]*?)<\/script>/);
// Find ext_resources
const extResMatch = content.match(/<script type="__bundler\/ext_resources">([\s\S]*?)<\/script>/);

if (templateMatch && manifestMatch) {
  const template = JSON.parse(templateMatch[1]);
  const manifest = JSON.parse(manifestMatch[1]);

  console.log(`Template length: ${template.length}`);
  console.log(`Manifest keys: ${Object.keys(manifest).length}`);

  const outDir = 'C:\\Users\\admin\\OneDrive\\Desktop\\Claude\\Projects & Softwares\\Our WMS\\wms-evolveg\\scratch\\extracted-config';
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(path.join(outDir, 'template.html'), template, 'utf8');

  // Decompress assets in manifest
  for (const [uuid, entry] of Object.entries(manifest)) {
    let finalBytes;
    if (entry.compressed) {
      const buffer = Buffer.from(entry.data, 'base64');
      try {
        finalBytes = zlib.gunzipSync(buffer);
      } catch (err) {
        console.error(`Error gunzipping ${uuid}:`, err);
        continue;
      }
    } else {
      finalBytes = Buffer.from(entry.data, 'base64');
    }

    const ext = entry.mime.includes('javascript') ? '.js' : entry.mime.includes('html') ? '.html' : entry.mime.includes('css') ? '.css' : '.bin';
    fs.writeFileSync(path.join(outDir, `${uuid}${ext}`), finalBytes);
    console.log(`Extracted ${uuid}${ext} (${entry.mime}, ${finalBytes.length} bytes)`);
  }
} else {
  console.log('Template or manifest script tags not found!');
}

