/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_PRIVY_CLIENT_ID?: string;
  readonly VITE_MONAD_CHAIN_ID?: string;
  readonly VITE_MONAD_CHAIN_NAME?: string;
  readonly VITE_MONAD_RPC_URL?: string;
  readonly VITE_MONAD_EXPLORER_URL?: string;
  readonly VITE_DEPLOYMENT_ID?: string;
  readonly VITE_DEPLOYMENT_BLOCK?: string;
  readonly VITE_ACCESS_MANAGER_ADDRESS?: string;
  readonly VITE_SETTLEMENT_TOKEN_ADDRESS?: string;
  readonly VITE_VAULT_ADDRESS?: string;
  readonly VITE_MARKET_CONFIG_ADDRESS?: string;
  readonly VITE_RATE_ORACLE_ADDRESS?: string;
  readonly VITE_POSITION_MANAGER_ADDRESS?: string;
  readonly VITE_ORDER_BOOK_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
