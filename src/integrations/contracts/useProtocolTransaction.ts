import {useCallback, useState} from 'react';
import {
  createPublicClient,
  createWalletClient,
  custom,
  getAddress,
  http,
  type Hash,
  type TransactionReceipt,
} from 'viem';
import {useAuth} from '@/integrations/privy/AuthProvider';
import {protocolReadConfig} from './config';
import type {UnsignedTransaction} from './transactionBuilders';

export type ProtocolTransactionStatus =
  | 'idle'
  | 'awaiting_signature'
  | 'confirming'
  | 'confirmed'
  | 'failed';

function transactionErrorMessage(error: unknown) {
  if (error instanceof Error) {
    const text = error.message.toLowerCase();
    if (text.includes('user rejected') || text.includes('user denied')) {
      return 'The transaction was cancelled in your wallet.';
    }
    if (text.includes('insufficient funds')) {
      return 'The wallet does not have enough MON to pay the network fee.';
    }
  }
  return 'The transaction was not confirmed. Refresh the chain state before trying again.';
}

export function useProtocolTransaction() {
  const auth = useAuth();
  const [status, setStatus] = useState<ProtocolTransactionStatus>('idle');
  const [hash, setHash] = useState<Hash>();
  const [error, setError] = useState<string>();

  const submit = useCallback(async (transaction: UnsignedTransaction): Promise<TransactionReceipt> => {
    const {chain, chainId, rpcUrl} = protocolReadConfig;
    if (!auth.wallet || !auth.walletAddress || !auth.walletReady) {
      throw new Error('A connected Privy wallet is required.');
    }
    if (!chain || !chainId || !rpcUrl || transaction.chainId !== chainId) {
      throw new Error('The transaction does not match the configured Monad deployment.');
    }

    setError(undefined);
    setHash(undefined);
    setStatus('awaiting_signature');
    try {
      await auth.wallet.switchChain(chainId);
      const provider = await auth.wallet.getEthereumProvider();
      const account = getAddress(auth.walletAddress);
      const walletClient = createWalletClient({
        account,
        chain,
        transport: custom(provider),
      });
      const nextHash = await walletClient.sendTransaction({
        account,
        chain,
        to: transaction.to,
        data: transaction.data,
        value: BigInt(transaction.value),
      });
      setHash(nextHash);
      setStatus('confirming');
      const publicClient = createPublicClient({chain, transport: http(rpcUrl, {timeout: 15_000})});
      const receipt = await publicClient.waitForTransactionReceipt({hash: nextHash, confirmations: 1});
      if (receipt.status !== 'success') throw new Error('Transaction reverted.');
      setStatus('confirmed');
      return receipt;
    } catch (transactionError) {
      setStatus('failed');
      setError(transactionErrorMessage(transactionError));
      throw transactionError;
    }
  }, [auth.wallet, auth.walletAddress, auth.walletReady]);

  const reset = useCallback(() => {
    setStatus('idle');
    setHash(undefined);
    setError(undefined);
  }, []);

  return {status, hash, error, submit, reset};
}
