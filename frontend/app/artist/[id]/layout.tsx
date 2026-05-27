import { Metadata } from 'next';
import { getInnertube } from '@/lib/innertube/session';
import { mapArtistDetails } from '@/lib/api/mappers';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const yt = await getInnertube();
    const artist = await yt.music.getArtist(id);
    const data = mapArtistDetails(artist);
    
    const title = `${data.name} on ഴ-zha`;
    const description = `Listen to ${data.name}'s music`;
    const imageUrl = data.header_thumbnail || data.thumbnail;
    const ogImage = imageUrl ? `/api/proxy/image?url=${encodeURIComponent(imageUrl)}` : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'profile',
        images: ogImage ? [{ url: ogImage }] : [],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
        images: ogImage ? [ogImage] : [],
      }
    };
  } catch (error) {
    return { title: 'Artist on ഴ-zha' };
  }
}

export default function ArtistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
