import LoginPageClient from '@/components/auth/LoginPageClient';

export const metadata = {
  title: 'Login | QuantumCrafters',
  description: 'Secure login portal for QuantumCrafters dashboards.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const LoginPage = () => <LoginPageClient />;

export default LoginPage;
