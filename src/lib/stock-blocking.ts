// Reason stamped on an estoque row that was auto-blocked because it landed
// on the shared/triagem address instead of the product's own registered
// address (endereco_padrao_id) during receiving. It's a *system* hold, not a
// manual quality/operational hold — transferStockBalance() recognizes this
// exact reason to allow moving the stock out (unlike a real manual block,
// which stays hard-blocked until someone explicitly releases it) and clears
// the hold automatically once it lands at its real destination.
export const PENDING_ADDRESSING_BLOCK_REASON =
  "Aguardando endereçamento: recebido no endereço de triagem, ainda não movido para o endereço definitivo do produto.";
