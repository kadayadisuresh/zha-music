import { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Playlist ${id} on ഴ-zha`,
    openGraph: {
      title: `Playlist on ഴ-zha`,
      type: 'website',
    }
  };
}

export default function PlaylistLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
