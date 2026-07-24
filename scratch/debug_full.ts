import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { listShippingPickingOrdersByIdsFromDb } from '../src/lib/shipping-picking';
import { createSupabaseAdminClient } from '../src/lib/supabase';

async function main() {
  const user = { papel: 'ADMIN' };
  // The wave contains: 405, 399, 397. Their UUIDs from earlier:
  const ids = [
    'f0a0ffa5-6518-4c8b-8bf1-b910aacd41cc', // 405
    '86d2bc3a-a7cc-4fb6-b3a2-b662d94ec255', // 399
    '7a81c1cd-2b5c-4314-8d0d-1bf417ea9746'  // 397
  ];

  const orders = await listShippingPickingOrdersByIdsFromDb(user as any, ids, {
    includeRouteData: true,
  });

  const caldoOrder = orders.find(o => o.orderNumber === '399' || o.id === '86d2bc3a-a7cc-4fb6-b3a2-b662d94ec255');
  console.log('Caldo Item RouteLines length:', caldoOrder?.items[0]?.routeLines.length);

  // Let's directly intercept loadPickingStockRows output!
  const supabase = createSupabaseAdminClient();
  const rawOrders = (await supabase.from('pedidos_expedicao').select('*, itens:pedidos_expedicao_itens(*)').in('id', ids)).data;
  const { loadCommercialKitRulesByDepositante, loadPickingStockRows } = require('../src/lib/shipping-picking');
  
  const rules = await loadCommercialKitRulesByDepositante(supabase, rawOrders);
  const stocks = await loadPickingStockRows(supabase, rawOrders, rules);
  
  console.log('Stock Rows Length:', stocks.length);
  const caldoStock = stocks.find(s => s.produto_id === '1391f062-3e9b-4f9d-a364-d480b7499eaf');
  console.log('Caldo Stock:', caldoStock);
}

main().catch(console.error);
