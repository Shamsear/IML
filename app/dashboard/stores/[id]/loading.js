import DetailSkeleton from '@/components/skeletons/DetailSkeleton';

export default function StoreDetailLoading() {
  return <DetailSkeleton hasTabs={false} statCardsCount={0} hasTable={true} />;
}
