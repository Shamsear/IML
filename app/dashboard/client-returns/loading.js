import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function ClientReturnsLoading() {
  return (
    <TableSkeleton
      columns={6}
      rows={8}
      hasFilters={true}
      hasTabs={true}
      tabsCount={2}
      statCardsCount={3}
      actionCount={3}
    />
  );
}
