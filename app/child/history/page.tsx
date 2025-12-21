"use client";

import { useEffect, useState } from "react";
import {
  Container,
  Card,
  Group,
  Text,
  Stack,
  Loader,
  Badge,
} from "@mantine/core";
import { supabase } from "@/lib/supabaseClient";

/**
 * ポイント履歴 1件分
 * - delta は増減値（例: +10 / -5）
 * - reason は発生理由（例: タスク完了 / ご褒美交換）
 */
type PointTransaction = {
  id: string;
  parent_id: string;
  child_id: string;
  delta: number;
  reason: string;
  created_at: string;
};

/**
 * 子どもユーザー用 ポイント履歴ページ
 * - ログイン中ユーザー（child_id）に紐づくポイント履歴を取得して表示
 * - ローディング / 空状態 / 一覧表示を明確に分岐
 */
export default function PointHistoryPage() {
  // データ取得中の表示制御
  const [loading, setLoading] = useState(true);

  // 取得したポイント履歴一覧
  const [rows, setRows] = useState<PointTransaction[]>([]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 現在ログインしているユーザー（子ども）を取得
      const {
        data: { user },
      } = await supabase.auth.getUser();

      // 未ログインの場合は何も表示せず終了
      if (!user) {
        setLoading(false);
        return;
      }

      // 対象の子ども（child_id）に紐づくポイント履歴を新しい順で取得
      const { data, error } = await supabase
        .from("point_transactions")
        .select(
          `
          id,
          parent_id,
          child_id,
          delta,
          reason,
          created_at
        `
        )
        .eq("child_id", user.id)
        .order("created_at", { ascending: false });

      // エラー時は安全側に倒し、空配列扱いとする
      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      setRows((data ?? []) as PointTransaction[]);
      setLoading(false);
    };

    // 初回マウント時のみ取得（履歴は自動再取得しない想定）
    load();
  }, []);

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={700} mb="lg" c="var(--oyako-text)">
        📊 ポイント履歴
      </Text>

      {loading ? (
        // データ取得中は中央に Loader を表示
        <Group justify="center">
          <Loader />
        </Group>
      ) : rows.length === 0 ? (
        // 履歴が存在しない場合の空状態
        <Text c="dimmed">ポイント履歴はまだありません。</Text>
      ) : (
        // ポイント履歴一覧
        <Stack>
          {rows.map((r) => (
            <Card
              key={r.id}
              withBorder
              shadow="sm"
              p="md"
              style={{
                background: "var(--oyako-card)",
                borderColor: "var(--oyako-border)",
              }}
            >
              <Group justify="space-between" align="center">
                <div>
                  <Text fw={600} c="var(--oyako-text)">
                    {r.reason}
                  </Text>
                  <Text size="xs" c="dimmed">
                    {new Date(r.created_at).toLocaleString("ja-JP")}
                  </Text>
                </div>

                {/* 増減値は符号に応じて色分けして視認性を高める */}
                <Badge
                  size="lg"
                  color={r.delta >= 0 ? "green" : "red"}
                  variant="light"
                >
                  {r.delta >= 0 ? `+${r.delta}` : r.delta} pt
                </Badge>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
