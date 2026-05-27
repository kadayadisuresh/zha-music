import { Metadata } from 'next';
import { getInnertube } from '@/lib/innertube/session';
import ClientPlayerRedirect from './ClientPlayerRedirect';

export async function generateMetadata({ params }: { params: Promise<{ videoId: string }> }): Promise<Metadata> {
  const { videoId } = await params;
  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);
    const title = `${info.basic_info.title} by ${info.basic_info.author}`;
    const description = "Listen on ഴ-zha";
    const imageUrl = info.basic_info.thumbnail?.find((t: any) => t.url)?.url;
    const ogImage = imageUrl ? `/api/proxy/image?url=${encodeURIComponent(imageUrl)}` : undefined;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: 'music.song',
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
    return { title: 'Song on ഴ-zha' };
  }
}

export default async function SongPage({ params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;
  let trackData = null;
  let errorMsg = undefined;

  try {
    const yt = await getInnertube();
    const info = await yt.getBasicInfo(videoId);
    
    // map to Track
    trackData = {
      id: info.basic_info.id,
      title: info.basic_info.title,
      artists: [{ id: info.basic_info.channel_id, name: info.basic_info.author }],
      duration: info.basic_info.duration,
      thumbnail: info.basic_info.thumbnail?.[0]?.url,
    };
  } catch (error) {
    console.error('[SongPage] Error:', error);
    errorMsg = "Couldn't load shared song";
  }

  return <ClientPlayerRedirect videoId={videoId} trackData={trackData} error={errorMsg} />;
}
