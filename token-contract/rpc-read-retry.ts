import type { NetworkHooks } from "hardhat/types/hooks";

// Public Sepolia endpoints occasionally reset connections.
// Retry reads only; transaction submission remains under Ignition's control.
const reads = new Set([
  "eth_chainId", "eth_blockNumber", "eth_getTransactionByHash",
  "eth_getTransactionReceipt", "eth_getTransactionCount", "eth_getBlockByNumber",
  "eth_getBlockByHash", "eth_getCode", "eth_getBalance", "eth_call",
  "eth_estimateGas", "eth_gasPrice", "eth_maxPriorityFeePerGas", "eth_feeHistory",
  "eth_getLogs",
]);
function connectionError(error: unknown): boolean {
  let current = error;
  for (let depth = 0; depth < 8 && current && typeof current === "object"; depth++) {
    const item = current as { code?: string; cause?: unknown };
    if (["ECONNRESET", "ETIMEDOUT", "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_SOCKET"].includes(item.code ?? "")) return true;
    current = item.cause;
  }
  return false;
}
export default async (): Promise<Partial<NetworkHooks>> => ({
  async onRequest(context, connection, request, next) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await next(context, connection, request);
      } catch (error) {
        if (connection.networkName !== "sepolia" || !reads.has(request.method) || !connectionError(error) || attempt >= 5) throw error;
        console.warn(`[Sepolia RPC] ${request.method}: connection interrupted; retry ${attempt + 1}/5`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  },
});
