"use client";

export default function AppError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <main className="module-page"><section className="panel module-empty" role="alert">
    <h1>页面暂时无法加载</h1>
    <p>请重新读取资料后核对，未完成的提交仍可通过原请求查询。</p>
    <button className="button button--primary" onClick={()=>retry()}>重新加载</button>
  </section></main>;
}
