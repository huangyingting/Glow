import { MapPinOff } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="system-page">
      <MapPinOff aria-hidden="true" />
      <p>404 · OUT OF MAP</p>
      <h1>没有找到这个页面</h1>
      <span>链接可能已失效，摄影天气工作区仍可正常使用。</span>
      <Link href="/">返回摄影工作区</Link>
    </main>
  );
}
