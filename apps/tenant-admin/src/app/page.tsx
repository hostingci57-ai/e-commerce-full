import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default function RootPage() {
  // Client will resolve auth; the (dashboard) layout guards further.
  redirect('/dashboard');
}
