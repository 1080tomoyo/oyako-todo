"use client";

import { useState } from "react";
import {
  MantineProvider,
  AppShell,
  Burger,
  Group,
  Text,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * AppProviders（Client Component）
 *
 * 役割：
 * - MantineProvider / Notifications など「クライアント必須の Provider」を集約
 * - AppShell（ヘッダー / ナビ / メイン）をアプリ全体で共通化
 * - ルートに置くことで、各ページは「画面固有の責務」だけに集中できる
 *
 * 設計意図：
 * - app/layout.tsx は Server Component のまま保ちたい
 * - ただし MantineProvider / usePathname などは client が必要
 *   → そのため Provider 群は AppProviders に切り出す
 */
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  // モバイル用ナビ開閉
  const [opened, setOpened] = useState(false);

  // 現在のパス（表示分岐 / active判定に使用）
  const pathname = usePathname();

  /**
   * 認証ページ判定
   * - /signin, /signup ではナビを表示しない（UIをシンプルに保つ）
   */
  const isAuthPage = pathname === "/signin" || pathname === "/signup";

  /**
   * 子ビュー判定
   * - /child 配下では「子ども向けナビ」に切り替える
   * - 親 / 子で情報設計（導線）を分けるための分岐
   */
  const isChildView = pathname.startsWith("/child");

  /* =========================
    ナビゲーション定義
    - 親 / 子で表示メニューを切り替える
  ========================= */

  // 親ナビ（管理・作成・承認など）
  const parentNavItems = [
    { icon: "🏠", label: "ダッシュボード", href: "/" },
    { icon: "👨‍👩‍👦", label: "マイページ", href: "/mypage" },
    { icon: "📝", label: "タスク一覧", href: "/tasks" },
    { icon: "🎁", label: "ご褒美カタログ", href: "/parent/rewards" },
    { icon: "📩", label: "ご褒美承認", href: "/parent/redemptions" },
    { icon: "👦", label: "こどもページ", href: "/child" },
    { icon: "🚪", label: "ログアウト", href: "/signout" },
  ];

  // 子ナビ（確認・交換など、行動が少ないUI）
  const childNavItems = [
    { icon: "🏠", label: "きょうのタスク", href: "/child" },
    { icon: "🎁", label: "ごほうび", href: "/child/rewards" },
    { icon: "🔙", label: "おやのページへ", href: "/" },
  ];

  // 表示対象のナビを決定
  const navItems = isChildView ? childNavItems : parentNavItems;

  /* =========================
     Active 判定（UX品質に直結）
     - /child と /child/rewards が
       両方 active にならないように制御する
  ========================= */

  /**
   * ナビの active 判定
   * - "/" は完全一致のみ
   * - "/child" も完全一致のみ（配下で二重activeを防ぐ）
   * - それ以外は「自身 or 配下」を active とする
   */
  const isActive = (href: string) => {
    // ルートは完全一致のみ
    if (href === "/") return pathname === "/";

    // 子どもトップも完全一致のみ（/child/rewards で二重active防止）
    if (href === "/child") return pathname === "/child";

    // それ以外は配下OK
    return pathname === href || pathname.startsWith(`${href}/`);
  };

  /* =========================
     レイアウト / テーマ
     - MantineProvider でテーマを統一
     - AppShell でヘッダー / ナビ / メインを共通化
  ========================= */

  return (
    <MantineProvider
      defaultColorScheme="light"
      theme={{
        // プロダクト用のカスタムカラー（oyako）
        primaryColor: "oyako",
        colors: {
          oyako: [
            "#FFF9E6",
            "#FDE8B2",
            "#FCD68A",
            "#FBC45E",
            "#FDB714",
            "#D69912",
            "#A87310",
            "#7A550C",
            "#4D3708",
            "#261B04",
          ],
        },
        // 丸ゴ系を中心に「親子向けのやわらかさ」を出す
        fontFamily:
          "'Noto Sans JP', 'Hiragino Maru Gothic Pro', 'Rounded Mplus 1c', sans-serif",
      }}
    >
      {/* グローバルで link の下線を消す（ナビをボタン風に見せる） */}
      <style>{`
        a {
          text-decoration: none !important;
        }
      `}</style>

      {/* トースト通知（全画面共通で利用） */}
      <Notifications position="top-center" zIndex={9999} />

      <AppShell
        header={{ height: 60, offset: true }}
        // 認証ページでは navbar を出さない（集中してログインできる）
        navbar={
          isAuthPage
            ? undefined
            : {
                width: 220,
                breakpoint: "sm",
                collapsed: { mobile: !opened },
              }
        }
        padding="md"
        styles={{
          main: {
            background: "var(--oyako-bg)",
            color: "var(--oyako-text)",
            fontFamily:
              "'Noto Sans JP', 'Hiragino Maru Gothic Pro', 'Rounded Mplus 1c', sans-serif",
          },
        }}
      >
        {/* ===== Header ===== */}
        <AppShell.Header>
          <Group h="100%" px="md" justify="space-between">
            <Group gap="xs">
              {/* 認証ページではメニュー不要 */}
              {!isAuthPage && (
                <Burger
                  opened={opened}
                  onClick={() => setOpened(!opened)}
                  hiddenFrom="sm"
                  size="sm"
                />
              )}
              <Text size="lg" fw={700}>
                OYAKO TODO
              </Text>
            </Group>
          </Group>
        </AppShell.Header>

        {/* ===== Navbar ===== */}
        {!isAuthPage && (
          <AppShell.Navbar p="md">
            <nav style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {navItems.map((item) => {
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      borderRadius: 9999,
                      background: active
                        ? "var(--oyako-accent-light)"
                        : "transparent",
                      color: "var(--oyako-text)",
                      fontWeight: active ? 700 : 500,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </AppShell.Navbar>
        )}

        {/* ===== Main ===== */}
        <AppShell.Main>{children}</AppShell.Main>
      </AppShell>
    </MantineProvider>
  );
}
