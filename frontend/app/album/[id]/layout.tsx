import { Metadata } from 'next';
import { getInnertube } from '@/lib/innertube/session';
import { mapAlbumDetails } from '@/lib/api/mappers';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  try {
    const yt = await getInnertube();
    const album = await yt.music.getAlbum(id);
    const data = mapAlbumDetails(album);
    
    const artistName = data.artists.map((a: any) => a.name).join(', ') || 'Unknown Artist';
    const title = `${data.title} by ${artistName}`;
    const description = `${data.tracks?.length || 0} songs · ${data.year || 'Unknown Year'}`;
    const imageUrl = data.thumbnail;
    const ogImage = imageUrl ? `/api/proxy/image?url=${encodeURIComponent(imageUrl)}` : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'music.album',
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
    return { title: 'Album on ഴ-zha' };
  }
}

export default function AlbumLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
