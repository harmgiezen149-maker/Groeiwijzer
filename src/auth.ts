import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import Credentials from 'next-auth/providers/credentials';
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
import { Redis } from '@upstash/redis';
import { ensureGardenForUser, getPasswordHash, getUser, getUserByEmail, upsertUser } from '@/lib/garden';
import { verifyPassword } from '@/lib/password';
import { assertWithinLimit } from '@/lib/ratelimit';
import { upstashConfig, usingUpstash } from '@/lib/redis';

/** Inloggen zonder externe sleutels: alleen buiten productie, voor lokale bouw. */
export const devLoginEnabled =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1';

const providers: NextAuthConfig['providers'] = [];

/* Bijhouden welke methodes er zijn terwijl we ze toevoegen. Het achteraf
   uit de providerobjecten aflezen is onbetrouwbaar: een provider kan ook
   een functie zijn, en dan is er geen `id` om naar te kijken. */
export const availableProviders = { google: false, resend: false, wachtwoord: true, dev: false };

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  availableProviders.google = true;
  providers.push(
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

const resendKey = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
if (resendKey && process.env.RESEND_FROM && usingUpstash) {
  availableProviders.resend = true;
  providers.push(
    Resend({
      apiKey: resendKey,
      from: process.env.RESEND_FROM,
      name: 'E-mail',
    }),
  );
}

/**
 * Inloggen met een zelfgekozen wachtwoord. Aanmelden kan alleen via een
 * uitnodiging (§3), dus dit is geen open registratie: hier wordt alleen
 * gecontroleerd wie er al een wachtwoord heeft gezet.
 */
providers.push(
  Credentials({
    id: 'wachtwoord',
    name: 'E-mail en wachtwoord',
    credentials: {
      email: { label: 'E-mail', type: 'email' },
      password: { label: 'Wachtwoord', type: 'password' },
    },
    authorize: async (credentials) => {
      const email = String(credentials?.email ?? '')
        .trim()
        .toLowerCase();
      const wachtwoord = String(credentials?.password ?? '');
      if (!email || !wachtwoord) return null;
      // Raden afremmen: een reeks pogingen op hetzelfde adres loopt vast.
      await assertWithinLimit(`login:${email}`, 'wachtwoord');

      const user = await getUserByEmail(email);
      if (!user) return null;
      const hash = await getPasswordHash(user.id);
      if (!hash) return null;
      if (!(await verifyPassword(wachtwoord, hash))) return null;
      return { id: user.id, email: user.email, name: user.name ?? user.email };
    },
  }),
);

if (devLoginEnabled) {
  availableProviders.dev = true;
  providers.push(
    Credentials({
      id: 'dev',
      name: 'Ontwikkelaarslogin',
      credentials: { email: { label: 'E-mail', type: 'email' } },
      authorize: async (credentials) => {
        const email = String(credentials?.email ?? '')
          .trim()
          .toLowerCase();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return null;
        const user = await upsertUser({ email });
        return { id: user.id, email: user.email, name: user.name ?? email };
      },
    }),
  );
}

export const authConfig: NextAuthConfig = {
  adapter: usingUpstash
    ? UpstashRedisAdapter(new Redis(upstashConfig()!), { baseKeyPrefix: 'auth:' })
    : undefined,
  providers,
  session: { strategy: 'jwt' },
  trustHost: true,
  pages: { signIn: '/login', error: '/login', verifyRequest: '/login?check=1' },
  callbacks: {
    async jwt({ token, user }) {
      const email = (user?.email ?? token.email ?? '').toString().trim().toLowerCase();
      if (!token.uid && email) {
        const profile = await upsertUser({
          email,
          name: user?.name ?? undefined,
          image: user?.image ?? undefined,
        });
        // Elke nieuwe gebruiker start met een eigen tuin en vier standaardlocaties.
        await ensureGardenForUser(profile);
        token.uid = profile.id;
        token.email = profile.email;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user.id = String(token.uid);
        const profile = await getUser(String(token.uid));
        if (profile) {
          session.user.email = profile.email;
          session.user.name = profile.name ?? session.user.name;
          session.user.image = profile.image ?? session.user.image;
        }
      }
      return session;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

/**
 * Wat er ontbreekt om te kunnen inloggen. Wordt op /login getoond, zodat een
 * verse deploy zonder omgevingsvariabelen uitlegt wat er moet gebeuren in
 * plaats van stil te blijven staan.
 */
export function configuratieProblemen(): string[] {
  const problemen: string[] = [];
  if (!process.env.AUTH_SECRET && process.env.NODE_ENV === 'production') {
    problemen.push('AUTH_SECRET ontbreekt.');
  }
  if (!usingUpstash) {
    problemen.push(
      'Er is geen Redis-database gekoppeld (UPSTASH_REDIS_REST_URL en ' +
        'UPSTASH_REDIS_REST_TOKEN, of KV_REST_API_URL en KV_REST_API_TOKEN); ' +
        'gegevens blijven niet bewaard.',
    );
  }
  if (!availableProviders.google && !availableProviders.resend && !availableProviders.dev) {
    problemen.push(
      'Er is nog geen manier om het eerste account te maken: zet AUTH_GOOGLE_ID en ' +
        'AUTH_GOOGLE_SECRET, of AUTH_RESEND_KEY en RESEND_FROM. Daarna kan iedereen die je ' +
        'uitnodigt een eigen wachtwoord kiezen.',
    );
  } else if (!availableProviders.resend && (resendKey || process.env.RESEND_FROM)) {
    const mist = [
      !resendKey ? 'AUTH_RESEND_KEY' : null,
      !process.env.RESEND_FROM ? 'RESEND_FROM' : null,
      !usingUpstash ? 'een Redis-database' : null,
    ].filter(Boolean);
    problemen.push(`De inloglink per e-mail staat uit; er ontbreekt nog ${mist.join(' en ')}.`);
  }
  return problemen;
}
