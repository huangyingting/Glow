"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Application route failed", error);
  }, [error]);

  return (
    <main className="system-page">
      <AlertTriangle aria-hidden="true" />
      <p>JIGUANG · RECOVERY</p>
      <h1>工作区遇到意外问题</h1>
      <span>当前页面没有完成加载。可以安全重试；观测点需要重新确认。</span>
      <button type="button" onClick={reset}><RefreshCw size={16} />重新加载工作区</button>
    </main>
  );
}
