import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function ClientReturnsBalancesLoading() {
  return (
    <TableSkeleton
      columns={6}
      rows={8}
      hasFilters={true}
      hasTabs={false}
      statCardsCount={4}
      actionCount={2}
    />
  );
}
