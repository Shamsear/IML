import TableSkeleton from '@/components/skeletons/TableSkeleton';

export default function TransactionsLoading() {
  return (
    <TableSkeleton
      columns={8}
      rows={8}
      hasFilters={true}
      hasTabs={false}
      actionCount={2}
    />
  );
}
