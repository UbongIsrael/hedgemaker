import {PrivyProvider, usePrivy, useWallets, type ConnectedWallet} from '@privy-io/react-auth';
import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {privyConfig} from './config';

type AuthMode = 'privy' | 'unconfigured';

interface AuthContextValue {
  mode: AuthMode;
  ready: boolean;
  authenticated: boolean;
  walletReady: boolean;
  walletAddress?: string;
  wallet?: ConnectedWallet;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function UnconfiguredAuth({children}: {children: ReactNode}) {
  const [noticeVisible, setNoticeVisible] = useState(false);
  const value = useMemo<AuthContextValue>(() => ({
    mode: 'unconfigured',
    ready: true,
    authenticated: false,
    walletReady: false,
    login: () => setNoticeVisible(true),
    logout: () => undefined,
  }), []);

  return (
    <AuthContext.Provider value={value}>
      {noticeVisible && (
        <div className="preview-notice" role="alert">
          Privy sign-in is not configured. Add a Privy app ID, Monad RPC URL, and chain ID.
        </div>
      )}
      {children}
    </AuthContext.Provider>
  );
}

function PrivyAuthBridge({children}: {children: ReactNode}) {
  const {ready, authenticated, login, logout} = usePrivy();
  const {ready: walletsReady, wallets} = useWallets();
  const wallet = wallets[0];
  const value = useMemo<AuthContextValue>(() => ({
    mode: 'privy',
    ready,
    authenticated,
    walletReady: walletsReady && Boolean(wallet),
    walletAddress: wallet?.address,
    wallet,
    login: () => { void login(); },
    logout: () => { void logout(); },
  }), [authenticated, login, logout, ready, wallet, walletsReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({children}: {children: ReactNode}) {
  const {appId, clientId, chain, isConfigured} = privyConfig;
  if (!isConfigured || !appId || !chain) {
    return <UnconfiguredAuth>{children}</UnconfiguredAuth>;
  }

  return (
    <PrivyProvider
      appId={appId}
      clientId={clientId}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: {ethereum: {createOnLogin: 'users-without-wallets'}},
        defaultChain: chain,
        supportedChains: [chain],
        appearance: {
          theme: 'light',
          accentColor: '#086b4c',
        },
      }}
    >
      <PrivyAuthBridge>{children}</PrivyAuthBridge>
    </PrivyProvider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider.');
  return context;
}
