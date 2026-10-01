import DetailSkeleton from '@/components/skeletons/DetailSkeleton';

export default function ProductDetailLoading() {
  return <DetailSkeleton hasTabs={true} tabsCount={3} statCardsCount={4} />;
}
