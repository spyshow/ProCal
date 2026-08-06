import { getSessionUser } from '@/lib/auth';
import { UserProvider } from '@/context/UserContext';
import { AppLayoutContainer } from '@/components/AppLayoutContainer';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSessionUser();
  return (
    <UserProvider user={user}>
      <AppLayoutContainer>{children}</AppLayoutContainer>
    </UserProvider>
  );
}
