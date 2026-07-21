const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const replacements = {
  "conferAncia": "conferência",
  "conferÃªncia": "conferência",
  "separaA Ao": "separação",
  "separaA§A£o": "separação",
  "observaA Aes": "observações",
  "previsAo": "previsão",
  "divergAncia": "divergência",
  "Area": "Área",
  "inventArio": "inventário",
  "NAo": "Não",
  "possA-vel": "possível",
  "possAvel": "possível",
  "descriA Ao": "descrição",
  "endereA o": "endereço",
  "transferAncia": "transferência",
  "Areas": "Áreas",
  "estatAsticas": "estatísticas",
  "saA-da": "saída",
  "SaA-da": "Saída",
  "referAncia": "referência",
  "ReferAncia": "Referência"
};

let filesFixed = 0;

walkDir('./src', function(filePath) {
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
    let content = fs.readFileSync(filePath, 'utf8');
    let original = content;
    
    for (const [bad, good] of Object.entries(replacements)) {
      content = content.split(bad).join(good);
    }
    
    if (content !== original) {
      fs.writeFileSync(filePath, content, 'utf8');
      filesFixed++;
    }
  }
});

console.log(`Fixed ${filesFixed} files.`);
