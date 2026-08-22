import CredentialsProvider from 'next-auth/providers/credentials';
import prisma from './prisma';
import { verifyPassword } from './password';

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

        try {
          // Find user in database
          const user = await prisma.user.findUnique({
            where: { username: credentials.username }
          });

          // User not found or inactive
          if (!user || !user.isActive) {
            return null;
          }

          // Verify password
          const isValidPassword = await verifyPassword(
            credentials.password, 
            user.password
          );

          if (!isValidPassword) {
            return null;
          }

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

