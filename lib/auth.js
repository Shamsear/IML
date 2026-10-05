import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './prisma';
import { verifyPassword } from './password';

// In-memory rate limiter to protect against credential stuffing and brute force
const loginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function isRateLimited(username) {
  const record = loginAttempts.get(username);
  if (!record) return false;
  if (record.lockUntil && Date.now() < record.lockUntil) {
    return true;
  }
  if (record.lockUntil && Date.now() >= record.lockUntil) {
    loginAttempts.delete(username);
    return false;
  }
  return false;
}

function recordFailedAttempt(username) {
  const record = loginAttempts.get(username) || { count: 0, lockUntil: null };
  record.count += 1;
  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.lockUntil = Date.now() + LOCKOUT_DURATION_MS;
  }
  loginAttempts.set(username, record);
}

function clearFailedAttempts(username) {
  loginAttempts.delete(username);
}

export const authOptions = {
  providers: [
    CredentialsProvider({
      name: 'Admin Login',
      credentials: {
        username: { label: "Username", type: "text", placeholder: "admin" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        // Early return for missing credentials
        if (!credentials?.username || !credentials?.password) {
          return null;
        }

        const usernameKey = credentials.username.toLowerCase().trim();

        // Check rate limiting / lockout
        if (isRateLimited(usernameKey)) {
          console.warn(`[Security] Too many failed login attempts for: ${usernameKey}`);
          throw new Error('Too many failed login attempts. Please try again in 15 minutes.');
        }

        try {
          // Find user in database
          const user = await prisma.user.findUnique({
            where: { username: credentials.username }
          });

          // User not found or inactive
          if (!user || !user.isActive) {
            recordFailedAttempt(usernameKey);
            return null;
          }

          // Verify password
          const isValidPassword = await verifyPassword(
            credentials.password, 
            user.password
          );

          if (!isValidPassword) {
            recordFailedAttempt(usernameKey);
            return null;
          }

          // Successful authentication resets attempt counters
          clearFailedAttempts(usernameKey);

          // Return user data (exclude password)
          return {
            id: user.id,
            name: user.name,
            email: user.email,
            username: user.username,
            role: user.role
          };
        } catch (error) {
          console.error('Auth error:', error);
          return null;
        }
      }
    })
  ],
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours
  },
  jwt: {
    maxAge: 8 * 60 * 60, // 8 hours
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.username = token.username;
        session.user.role = token.role;
      }
      return session;
    }
  },
  // Performance optimizations
  secret: process.env.NEXTAUTH_SECRET,
  debug: false, // Disable debug mode in production
};

