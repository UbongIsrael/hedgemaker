/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PRIVY_APP_ID?: string;
  readonly VITE_PRIVY_CLIENT_ID?: string;
  readonly VITE_MONAD_CHAIN_ID?: string;
  readonly VITE_MONAD_CHAIN_NAME?: string;
  readonly VITE_MONAD_RPC_URL?: string;
  readonly VITE_MONAD_EXPLORER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
