/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server';
import { getInnertube } from '@/lib/innertube/session';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    const yt = await getInnertube();
    const suggestions = await yt.music.getSearchSuggestions(query);
    
    // Flatten suggestions from all sections
    const flatSuggestions = suggestions.flatMap(section => 
      section.contents.map(item => (typeof item.text === 'string' ? item.text : (item as any).text?.text))
    ).filter(Boolean);

    return NextResponse.json(flatSuggestions);
  } catch (error) {
    console.error('[Suggestions API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
