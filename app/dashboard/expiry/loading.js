import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function ExpiryLoading() {
  return (
    <TableSkeleton
      columns={8}
      rows={8}
      hasFilters={true}
      hasTabs={false}
      statCardsCount={3}
      actionCount={1}
    />
  );
}
