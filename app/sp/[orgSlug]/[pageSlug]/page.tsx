import type { Metadata } from 'next'
import Script from 'next/script'
import { notFound } from 'next/navigation'
import { getCachedPublicSalesPageByPath } from '@/modules/sales/lib/sales-page.server'
import SalesPagePublicView from './SalesPagePublicView'

type PublicSalesPageProps = {
  params: Promise<{ orgSlug: string; pageSlug: string }>
}

export async function generateMetadata({ params }: PublicSalesPageProps): Promise<Metadata> {
  const { orgSlug, pageSlug } = await params
  const result = await getCachedPublicSalesPageByPath(orgSlug, pageSlug)

  if (!result) {
    return {
      title: 'Sales Page Tidak Ditemukan',
      description: 'Halaman yang Anda cari tidak tersedia.',
    }
  }

  const { page, org } = result

  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || page.description,
    openGraph: {
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.description,
      siteName: org.name,
      type: 'website',
      images: page.heroImageUrl ? [{ url: page.heroImageUrl, alt: page.heroImageAlt || page.title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: page.metaTitle || page.title,
      description: page.metaDescription || page.description,
      images: page.heroImageUrl ? [page.heroImageUrl] : undefined,
    },
  }
}

export default async function PublicSalesPage({ params }: PublicSalesPageProps) {
  const { orgSlug, pageSlug } = await params
  const result = await getCachedPublicSalesPageByPath(orgSlug, pageSlug)

  if (!result) notFound()

  const { page } = result

  return (
    <>
      {page.metaPixelId && (
        <>
          <Script id={`meta-pixel-${page.id}`} strategy="afterInteractive">
            {`
              !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
              n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}
              (window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${page.metaPixelId}');
              fbq('track', 'PageView');
            `}
          </Script>
          <noscript>
            <img
              height="1"
              width="1"
              style={{ display: 'none' }}
              alt=""
              src={`https://www.facebook.com/tr?id=${page.metaPixelId}&ev=PageView&noscript=1`}
            />
          </noscript>
        </>
      )}

      <SalesPagePublicView org={result.org} page={page} />
    </>
  )
}
