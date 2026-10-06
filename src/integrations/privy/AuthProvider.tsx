import {PrivyProvider, usePrivy, useWallets} from '@privy-io/react-auth';
import {createContext, useContext, useMemo, useState, type ReactNode} from 'react';
import {privyConfig} from './config';

type AuthMode = 'privy' | 'local_preview';

interface AuthContextValue {
  mode: AuthMode;
  ready: boolean;
  authenticated: boolean;
  walletReady: boolean;
  walletAddress?: string;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const DEMO_WALLET = '0x7A31…9D42';

function LocalPreviewAuth({children}: {children: ReactNode}) {
  const [authenticated, setAuthenticated] = useState(false);
  const value = useMemo<AuthContextValue>(() => ({
    mode: 'local_preview',
    ready: true,
    authenticated,
    walletReady: authenticated,
    walletAddress: authenticated ? DEMO_WALLET : undefined,
    login: () => setAuthenticated(true),
    logout: () => setAuthenticated(false),
  }), [authenticated]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
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
    login: () => { void login(); },
    logout: () => { void logout(); },
  }), [authenticated, login, logout, ready, wallet, walletsReady]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function AuthProvider({children}: {children: ReactNode}) {
  const {appId, clientId, chain, isConfigured} = privyConfig;
  if (!isConfigured || !appId || !chain) {
    return <LocalPreviewAuth>{children}</LocalPreviewAuth>;
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
          accentColor: '#0B493A',
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
