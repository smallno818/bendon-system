export default function MaintenanceView() {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
      <div className="text-6xl mb-4">🛠️</div>
      <h1 className="text-2xl font-bold text-slate-800 mb-2">網頁維護測試中</h1>
      <p className="text-slate-600">
        我們正在進行資料庫權限升級，請稍後再回來。<br />
        造成不便敬請見諒！
      </p>
    </div>
  );
}