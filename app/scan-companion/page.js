import ScanCompanionClient from './ScanCompanionClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;


export default async function ScanCompanionPage(props) {
  const searchParams = await props.searchParams;
  const session = searchParams?.session || '';
  return <ScanCompanionClient session={session} />;
}
