'use client';

import { AppShell, Burger, Group, Text } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import Link from 'next/link';

/**
 * 親ダッシュボード用レイアウト
 * - Mantine AppShell で「ヘッダー + サイドナビ + メイン領域」を共通化
 * - SP ではナビを折りたたみ、Burger で開閉できるようにする（レスポンシブ対応）
 * - 各ページの children を Main に差し込むことで、画面ごとの実装をシンプルに保つ
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  /**
   * SP 用ナビ開閉状態
   * - useDisclosure を使うことで opened / toggle を簡潔に管理
   */
  const [opened, { toggle }] = useDisclosure();

  return (
    <AppShell
      // ヘッダー高さは固定（全ページで共通）
      header={{ height: 60 }}
      navbar={{
        width: 260,
        breakpoint: 'sm',
        /**
         * SP（sm 未満）のみ navbar を折りたたむ
         * - PC では常時表示、SP では Burger 操作で表示
         */
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      {/* ヘッダー：アプリ名 +（将来的に）ログイン状態等を表示 */}
      <AppShell.Header className="border-b border-gray-200 bg-white">
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            {/* SP のみ表示するメニュー開閉ボタン */}
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
            />
            <Text fw={700} size="lg">
              oyako-todo
            </Text>
          </Group>

          {/* 右側の表示枠：役割やユーザー情報を出す想定 */}
          <Group gap="md">
            <Text size="sm" className="text-gray-500">
              ログイン中：親
            </Text>
          </Group>
        </Group>
      </AppShell.Header>

      {/* サイドナビ：画面遷移の導線を集約（ホバー時に強調） */}
      <AppShell.Navbar p="md" className="bg-white border-r border-gray-200">
        <nav className="flex flex-col gap-2 text-sm">
          <Link href="/dashboard" className="hover:text-yellow-600">
            ダッシュボード
          </Link>
          <Link href="/parent" className="hover:text-yellow-600">
            親ビュー
          </Link>
          <Link href="/child" className="hover:text-yellow-600">
            子ビュー
          </Link>
          <Link href="/settings" className="hover:text-yellow-600">
            設定
          </Link>
        </nav>
      </AppShell.Navbar>

      {/* メイン領域：各ページの内容（children）を表示 */}
      <AppShell.Main className="bg-gray-50">
        {/* 中央寄せ & 最大幅固定で読みやすさを担保 */}
        <div className="mx-auto max-w-5xl py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </div>
      </AppShell.Main>
    </AppShell>
  );
}
