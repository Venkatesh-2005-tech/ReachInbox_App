import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { prisma } from './prisma';
import { env } from './env';

passport.serializeUser((user: Express.User, done) => {
  done(null, (user as { id: string }).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) {
            return done(new Error('No email returned from Google'), undefined);
          }

          const user = await prisma.user.upsert({
            where: { googleId: profile.id },
            update: {
              name: profile.displayName,
              avatar: profile.photos?.[0]?.value ?? null,
            },
            create: {
              googleId: profile.id,
              name: profile.displayName,
              email,
              avatar: profile.photos?.[0]?.value ?? null,
            },
          });

          return done(null, user);
        } catch (err) {
          return done(err as Error, undefined);
        }
      },
    ),
  );
} else {
  console.warn('⚠️  Google OAuth credentials not configured. /auth/google will be unavailable.');
}

export default passport;
