"use client";

import { useEffect } from "react";
import { useUserStore } from "@/lib/stores/userStore";
import { HomeFeed } from "@/components/browse/HomeFeed";

export default function LandingPage() {
  const { checkSession } = useUserStore();

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  return <HomeFeed />;
}
