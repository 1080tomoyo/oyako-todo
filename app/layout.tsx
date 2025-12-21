// app/layout.tsx
// ==============================
// アプリ全体のルートレイアウト
// ==============================
//
// ・Next.js App Router の Root Layout
// ・全ページ共通のスタイル / Provider / メタデータをここで定義する
// ・Server Component として扱うため "use client" は付けない
//   （＝初期表示を軽くし、不要なクライアントJSを増やさない）
//
// ※ MantineProvider / NotificationsProvider などの
//   クライアント依存の Provider は AppProviders 側でまとめて管理する

import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./theme.css";

import AppProviders from "../AppProviders";

// ------------------------------
// メタデータ（SEO / タイトル）
// ------------------------------
// App Router では metadata export により
// <head> を宣言的に管理できる
export const metadata = {
  title: "OYAKO TODO",
  description: "親子で使うTODOアプリ",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    // lang を明示してアクセシビリティ & SEO を担保
    <html lang="ja">
      <body>
        {/* 
          AppProviders
          - MantineProvider
          - Notifications
          - その他 client 専用 Provider
          
          を 1 箇所に集約し、
          Layout 自体は Server Component のまま保つ
        */}
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
