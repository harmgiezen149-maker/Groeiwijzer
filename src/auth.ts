import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import Resend from 'next-auth/providers/resend';
import Credentials from 'next-auth/providers/credentials';
import { UpstashRedisAdapter } from '@auth/upstash-redis-adapter';
import { Redis } from '@upstash/redis';
import { ensureGardenForUser, getUser, upsertUser } from '@/lib/garden';
import { usingUpstash } from '@/lib/redis';

/** Inloggen zonder externe sleutels: alleen buiten productie, voor lokale bouw. */
export const devLoginEnabled =
  process.env.NODE_ENV !== 'production' || process.env.ALLOW_DEV_LOGIN === '1';

const providers: NextAuthConfig['providers'] = [];

/* Bijhouden welke methodes er zijn terwijl we ze toevoegen. Het achteraf
   uit de providerobjecten aflezen is onbetrouwbaar: een provider kan ook
   een functie zijn, en dan is er geen `id` om naar te kijken. */
export const availableProviders = { google: false, resend: false, dev: false };

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
    ? UpstashRedisAdapter(
        new Redis({
          url: process.env.UPSTASH_REDIS_REST_URL!,
          token: process.env.UPSTASH_REDIS_REST_TOKEN!,
        }),
        { baseKeyPrefix: 'auth:' },
      )
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
      'UPSTASH_REDIS_REST_URL en UPSTASH_REDIS_REST_TOKEN ontbreken; gegevens blijven niet bewaard.',
    );
  }
  if (providers.length === 0) {
    problemen.push(
      'Er is geen inlogmethode: zet AUTH_GOOGLE_ID en AUTH_GOOGLE_SECRET, of AUTH_RESEND_KEY en RESEND_FROM.',
    );
  } else if (!availableProviders.resend && (resendKey || process.env.RESEND_FROM)) {
    problemen.push(
      'De inloglink per e-mail staat uit: die vraagt AUTH_RESEND_KEY, RESEND_FROM én Upstash.',
    );
  }
  return problemen;
}
