// HIDDEN: cookbook - This page now redirects to home
// Original implementation preserved in cookbook-client.tsx
import { redirect } from 'next/navigation';

export default function CookbookPage() {
  redirect('/');
}
