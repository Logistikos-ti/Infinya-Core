require('dotenv').config({ path: '.env.local' });
const { listShippingOrdersFromDb } = require('./src/lib/shipping');
const { createSupabaseAdminClient } = require('./src/lib/supabase/admin');

// We have to mock the env or Next.js might complain, but since it's just a TS file, we can run it with ts-node!
