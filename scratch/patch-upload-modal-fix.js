const fs = require('fs');
const path = require('path');
const p = path.join('src', 'components', 'expedicao', 'expedicao-client.tsx');
let c = fs.readFileSync(p, 'utf8');

const targetStr1 = `O pedido <strong>{sel?.code}</strong>`;
const replaceStr1 = `O pedido <strong>{selectedOrder?.code}</strong>`;

const targetStr2 = `{sel?.raw?.id && sel?.raw?.depositanteId ? (`;
const replaceStr2 = `{selectedOrder?.raw?.id && selectedOrder?.raw?.depositanteId ? (`;

const targetStr3 = `depositanteId={sel.raw.depositanteId}`;
const replaceStr3 = `depositanteId={selectedOrder.raw.depositanteId}`;

const targetStr4 = `pedidoExpedicaoId={sel.raw.id}`;
const replaceStr4 = `pedidoExpedicaoId={selectedOrder.raw.id}`;

c = c.replace(targetStr1, replaceStr1);
c = c.replace(targetStr2, replaceStr2);
c = c.replace(targetStr3, replaceStr3);
c = c.replace(targetStr4, replaceStr4);

fs.writeFileSync(p, c);
console.log('Fixed ReferenceError in expedicao-client.tsx');
