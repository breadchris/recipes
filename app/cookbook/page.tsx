import type { Metadata } from 'next';
import CookbookClient from './cookbook-client';

export const metadata: Metadata = {
  title: 'My Cookbook | Recipe Videos',
  description: 'Your saved recipe videos and notes',
};

export default function CookbookPage() {
  return <CookbookClient />;
}
