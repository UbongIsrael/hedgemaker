function httpsDestination(value: string | undefined): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function emailDestination(value: string | undefined): string | undefined {
  const email = value?.trim();
  if (!email || !/^[^\s@?&#%]+@[^\s@?&#%]+\.[^\s@?&#%]+$/.test(email)) return undefined;
  return `mailto:${email}?subject=${encodeURIComponent('HedgeMaker market-maker application')}`;
}

const applicationUrl = httpsDestination(import.meta.env.VITE_MARKET_MAKER_APPLICATION_URL);
const emailUrl = emailDestination(import.meta.env.VITE_MARKET_MAKER_CONTACT_EMAIL ?? 'sheikh@digitalsheikh.co');

// A real handoff, never an imitation submission or a success receipt.
export const marketMakerContact = applicationUrl
  ? {kind: 'application' as const, href: applicationUrl, label: 'Continue to application'}
  : emailUrl
    ? {kind: 'email' as const, href: emailUrl, label: 'Email your application'}
    : undefined;
