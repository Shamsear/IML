import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import LoginForm from './LoginForm';

export const metadata = {
  title: 'Login - IML Group Inventory Management Portal',
  description: 'Sign in to access your administrative dashboard.',
};

export default async function LoginPage() {
  const session = await getServerSession(authOptions);

  if (session) {
    redirect('/dashboard');
  }

  return <LoginForm />;
}
