import NewBrandClient from './NewBrandClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export const metadata = {
  title: 'Register Brand - Inventory System',
  description: 'Register one or more new brand owners in the inventory system',
};

export default async function NewBrandPage() {
  return <NewBrandClient />;
}
