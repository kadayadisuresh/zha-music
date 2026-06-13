"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PlaylistCollabProvider } from "./PlaylistCollabContext";

export function PlaylistCollabBoundary({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const id = params?.id ? String(params.id) : "";
  if (!id) return <>{children}</>;
  // Connect for any playlist the user can view; collaborative UI is gated in the page.
  return (
    <PlaylistCollabProvider playlistId={id} enabled={true}>
      {children}
    </PlaylistCollabProvider>
  );
}
