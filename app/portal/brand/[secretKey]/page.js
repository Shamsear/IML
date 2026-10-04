import { getBrandPortalDetails } from '@/app/actions/brands';
import { AlertCircle } from 'lucide-react';
import BrandPortalClient from './BrandPortalClient';

export async function generateMetadata({ params }) {
  const { secretKey } = await params;
  const brand = await getBrandPortalDetails(secretKey);

  if (!brand) {
    return {
      title: 'Portal Access Denied | IML Warehouse',
      description: 'The requested brand portal link is invalid or access has been revoked.',
    };
  }

  const title = `${brand.name} | Partner Portal`;
  const description = brand.description || `Live inventory status, stock levels, and product catalog for ${brand.name}.`;
  const logoUrl = brand.imageUrl || undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName: 'IML Warehouse Partner Portal',
      images: logoUrl
        ? [
            {
              url: logoUrl,
              alt: `${brand.name} Logo`,
            },
          ]
        : [],
      type: 'website',
    },
    twitter: {
      card: 'summary',
      title,
      description,
      images: logoUrl ? [logoUrl] : [],
    },
    icons: logoUrl
      ? {
          icon: logoUrl,
          apple: logoUrl,
          shortcut: logoUrl,
        }
      : undefined,
  };
}

export default async function BrandPortalPage({ params }) {
  const { secretKey } = await params;

  const brand = await getBrandPortalDetails(secretKey);

  if (!brand) {
    return (
      <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 text-center font-sans">
        <div className="w-16 h-16 rounded-full bg-danger/10 text-danger flex items-center justify-center mb-4">
          <AlertCircle size={32} />
        </div>
        <h1 className="text-xl font-display font-extrabold text-text-primary mb-2">Portal Access Denied</h1>
        <p className="text-sm text-text-secondary max-w-sm leading-relaxed">
          The link you followed is invalid or the secret key was changed. Please contact the warehouse administrator to request a new partner access link.
        </p>
      </div>
    );
  }

  return (
    <BrandPortalClient brand={brand} />
  );
}
