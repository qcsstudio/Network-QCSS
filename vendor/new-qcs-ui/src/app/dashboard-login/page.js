import LoginPageClient from '@/components/auth/LoginPageClient';

export const metadata = {
  title: 'Dashboard Login | QuantumCrafters',
  description: 'Secure dashboard login for QuantumCrafters.',
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

const DashboardLoginPage = () => <LoginPageClient useTailwind />;

export default DashboardLoginPage;
