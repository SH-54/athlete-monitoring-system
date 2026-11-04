export default function ConnectionRequired() {
  return (
    <main className="login">
      <section className="panel login-card">
        <div className="brand">
          <span className="brand-icon">A</span> ATHLOS
        </div>
        <h1>接続設定が必要です</h1>
        <p className="muted">
          チームの記録を保存するデータベースが設定されていません。管理者が本番接続を設定すると、このURLから選手とスタッフがログインできます。
        </p>
        <p className="setup-note">
          管理者向け：公開先に NEXT_PUBLIC_SUPABASE_URL と
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          を設定してください。サービスロールキーは使用しません。
        </p>
      </section>
    </main>
  );
}
