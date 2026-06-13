'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useSearchStore } from '@/lib/stores/searchStore';

interface SearchBarProps {
  isLoading?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({ isLoading = false }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [isFocused, setIsFocused] = useState(false);
  const [showSpinner, setShowSpinner] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  const { recentSearches, addSearch, clearHistory, removeSearch } = useSearchStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync local state when URL query changes (e.g. browser back/forward)
  const urlQuery = searchParams.get('q') || '';
  useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  // Submit search — only called on Enter or explicit action
  const submitSearch = useCallback((searchQuery: string) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;
    
    addSearch(trimmed);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
    setIsFocused(false);
    inputRef.current?.blur();
  }, [router, addSearch]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      submitSearch(query);
    }
    if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  const handleClear = () => {
    setQuery('');
    inputRef.current?.focus();
    // If we're on the search page with a query, navigate to clean search page
    if (pathname === '/search' && urlQuery) {
      router.push('/search');
    }
  };

  const handleRecentClick = (q: string) => {
    setQuery(q);
    setIsFocused(false);
    submitSearch(q);
  };

  // Debounced autocomplete suggestions while typing
  useEffect(() => {
    const trimmed = query.trim();
    if (!isFocused || !trimmed) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search/suggestions?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = await res.json();
        setSuggestions(Array.isArray(data) ? data : []);
      } catch {
        // Ignore aborts and network errors — suggestions are non-critical
      }
    }, 200);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query, isFocused]);

  // Spinner logic: Show only if loading for > 2s
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isLoading) {
      timer = setTimeout(() => setShowSpinner(true), 2000);
    } else {
      setShowSpinner(false);
    }
    return () => clearTimeout(timer);
  }, [isLoading]);

  // Handle clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl">
      <div className={`flex items-center bg-zinc-800/50 hover:bg-zinc-800 border ${isFocused ? 'border-zinc-500 bg-zinc-800' : 'border-transparent'} rounded-full px-4 py-2 transition-all`}>
        {showSpinner ? (
          <div className="mr-2 animate-spin h-5 w-5 text-zinc-400">
            <svg className="h-full w-full" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : (
          <button 
            type="button"
            onClick={() => submitSearch(query)}
            className="mr-2 text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          placeholder="Search for songs, artists, albums..."
          className="bg-transparent border-none focus:outline-none w-full text-zinc-100 placeholder:text-zinc-500 text-sm"
        />
        {query && (
          <button type="button" onClick={handleClear} className="text-zinc-400 hover:text-zinc-100 p-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {isFocused && query.trim() && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <ul className="max-h-[60vh] overflow-y-auto">
            {suggestions.map((s, i) => (
              <li key={i} className="hover:bg-zinc-800">
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => handleRecentClick(s)}
                  className="w-full text-left px-4 py-3 text-sm text-zinc-300 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span className="truncate">{s}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isFocused && !query && recentSearches.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs font-semibold text-zinc-500 uppercase">Recent Searches</span>
            <button onClick={clearHistory} className="text-xs text-blue-400 hover:text-blue-300">Clear</button>
          </div>
          <ul className="max-h-[60vh] overflow-y-auto">
            {recentSearches.map((s, i) => (
              <li key={i} className="flex items-center justify-between hover:bg-zinc-800 group">
                <button
                  onClick={() => handleRecentClick(s)}
                  className="flex-1 text-left px-4 py-3 text-sm text-zinc-300 flex items-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-zinc-500 mr-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {s}
                </button>
                <button
                  onClick={() => removeSearch(s)}
                  className="px-4 py-3 opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-zinc-300 transition-opacity"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
