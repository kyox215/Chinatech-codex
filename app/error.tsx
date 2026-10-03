"use client";

export default function PageError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="module-page"><section className="panel module-empty" role="alert">
    <h1>资料暂时无法加载</h1>
    <p>请稍后重新读取。</p>
    <button className="button button--primary" onClick={()=>retry()}>重新加载</button>
  </section></main>;
}
