const fs = require('fs');
let t = fs.readFileSync('src/components/expedicao/expedicao-client.tsx', 'utf8');

// The replacement character in utf8 is "\uFFFD"
t = t.replace(/\uFFFD/g, '');

const replacements = {
  "Conferncia": "Conferência",
  "conferncia": "conferência",
  "Separaao": "Separação",
  "separaao": "separação",
  "Divergncias": "Divergências",
  "divergncias": "divergências",
  "Divergncia": "Divergência",
  "divergncia": "divergência",
  "pendncias": "pendências",
  "Pendncias": "Pendências",
  "OPERAAO": "OPERAÇÃO",
  "VALIDAAO": "VALIDAÇÃO",
  "PS-CONFERNCIA": "PÓS-CONFERÊNCIA",
  "expediao": "expedição",
  "Expediao": "Expedição",
  "Responsvel": "Responsável",
  "j ": "já ",
  "armazm": "armazém",
  "Integraao": "Integração",
  "Concluda": "Concluída",
  "concluda": "concluída",
  "Descriao": "Descrição",
  "descriao": "descrição",
  "Endereo": "Endereço",
  "endereo": "endereço",
  "n ": "nº ",
  "Comrcio": "Comércio",
  "Nao ": "Não ",
  "nao ": "não ",
  "mdia": "média",
  "Mdia": "Média",
  "disponvel": "disponível",
  "indisponvel": "indisponível",
  "Joao ": "João ",
  "ConferÃªncia": "Conferência",
  "SeparaÃ§Ã£o": "Separação",
  "OPERAÃ‡ÃƒO": "OPERAÇÃO",
  "VALIDAÃ‡ÃƒO": "VALIDAÇÃO",
  "PÃ“S-CONFERÃŠNCIA": "PÓS-CONFERÊNCIA",
  "expediÃ§Ã£o": "expedição",
  "ExpediÃ§Ã£o": "Expedição",
  "DivergÃªncias": "Divergências",
  "pendÃªncias": "pendências"
};

for (const [bad, good] of Object.entries(replacements)) {
  t = t.split(bad).join(good);
}

// Fix getCarrierStyle logic for Mercado Envios
const oldCarrier = 'if (n.includes("MERCADO LIVRE") || n.includes("MERCADOLIVRE") || n.includes("MELI")) return { color: "#CA8A04", bg: "rgba(253,224,71,0.25)", init: "ME" };';
const newCarrier = 'if (n.includes("MERCADO LIVRE") || n.includes("MERCADOLIVRE") || n.includes("MELI") || n.includes("MERCADO ENVIOS") || n.includes("MERCADOENVIOS")) return { color: "#CA8A04", bg: "rgba(253,224,71,0.25)", init: "ME" };';
t = t.split(oldCarrier).join(newCarrier);

// Also handle the B2W/AMERICANAS array logic in case it's broken
// Actually wait, let's just make it completely replace the getCarrierStyle function if needed, but doing splits is safe

fs.writeFileSync('src/components/expedicao/expedicao-client.tsx', t, 'utf8');
console.log("File fixed successfully!");
