'use client';

import { Card, Group, Text, Button } from '@mantine/core';

/**
 * ダッシュボード（親用トップページ）
 * - 親が最初にアクセスする入口ページ
 * - 「親が管理するタスク」と「子どもが実行するタスク」への導線を分けて提示
 * - 機能を詰め込みすぎず、次に何をするかを迷わせない構成
 */
export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* ページタイトル */}
      <Text size="xl" fw={700}>
        今日の親子TODO
      </Text>

      {/* メイン導線：親 / 子 の2択をカードで分かりやすく表示 */}
      <Group align="flex-start" grow>
        {/* 親タスク管理への導線 */}
        <Card shadow="sm" radius="md" withBorder>
          <Text fw={600} mb="xs">
            親のタスク
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            子どもに出すお手伝い、宿題チェックなどを管理します。
          </Text>
          {/* 今後は親タスク一覧ページへの遷移を想定 */}
          <Button variant="light">親タスクをみる</Button>
        </Card>

        {/* 子どもタスク確認への導線 */}
        <Card shadow="sm" radius="md" withBorder>
          <Text fw={600} mb="xs">
            子どものタスク
          </Text>
          <Text size="sm" c="dimmed" mb="md">
            子どもが自分で確認できるTODO一覧です。
          </Text>
          {/* 子ども向け画面であることを色味で区別 */}
          <Button variant="light" color="yellow">
            子どもタスクをみる
          </Button>
        </Card>
      </Group>
    </div>
  );
}
