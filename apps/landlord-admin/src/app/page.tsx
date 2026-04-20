import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RootPage(): never {
  // Route gate: always route through /tenants, guard will redirect unauth users to /login.
  redirect('/tenants');
}
