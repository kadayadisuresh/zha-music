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
    if (!yt) {
      return NextResponse.json([]);
    }
    const suggestions = await yt.music.getSearchSuggestions(query);

    // Each section's contents are SearchSuggestion / HistorySuggestion nodes,
    // whose `suggestion` is a Text object exposing the string on `.text`.
    const flatSuggestions = suggestions
      .flatMap(section =>
        section.contents.map(item => {
          const node = item as any;
          return node?.suggestion?.text ?? (typeof node?.text === 'string' ? node.text : node?.text?.text);
        })
      )
      .filter((s: unknown): s is string => typeof s === 'string' && s.length > 0);

    // De-duplicate while preserving order
    return NextResponse.json([...new Set(flatSuggestions)]);
  } catch (error) {
    console.error('[Suggestions API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch suggestions' }, { status: 500 });
  }
}
