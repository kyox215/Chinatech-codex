export default function PageLoading() {
  return <main className="module-page" aria-label="正在加载页面" role="status">
    <div className="module-skeleton module-skeleton--heading" />
    <div className="module-skeleton module-skeleton--cards" />
    <p>正在读取资料…</p>
  </main>;
}
