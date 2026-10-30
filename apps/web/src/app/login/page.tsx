import { AuthForm } from '@/components/auth-form';
export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ passwordChanged?: string }>;
}) {
  return <AuthForm passwordChanged={(await searchParams).passwordChanged === '1'} />;
}
