import ScanCompanionClient from './ScanCompanionClient';

export default async function ScanCompanionPage(props) {
  const searchParams = await props.searchParams;
  const session = searchParams?.session || '';
  return <ScanCompanionClient session={session} />;
}
