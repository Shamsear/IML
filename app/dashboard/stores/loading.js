import CardsGridSkeleton from '@/components/skeletons/CardsGridSkeleton';

export default function StoresLoading() {
  return <CardsGridSkeleton count={6} cardType="store" actionCount={2} />;
}
