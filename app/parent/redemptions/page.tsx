"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import {
  Card,
  Group,
  Text,
  Button,
  Stack,
  Container,
  Badge,
  Loader,
  Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { supabase } from "@/lib/supabaseClient";
import ChildSwitcher from "@/app/(components)/ChildSwitcher";

type Redemption = {
  id: number;
  status: string;
  requested_at: string;
  child_id: string;
  children: { name: string } | null;
  rewards: { title: string; required_points: number } | null;
};

/**
 * 親用：ご褒美申請の承認ページ
 * - 子どもが申請した「ご褒美交換」を親が承認/却下する
 * - 一覧は pending のみ表示し、子ども切替（全員/個別）で絞り込める
 * - 承認/却下は RPC で処理し、サーバ側で整合性（減算・ステータス更新）を担保する
 */
export default function ParentRedemptionsPage() {
  // 初期取得中の表示制御
  const [loading, setLoading] = useState(true);

  // pending の申請一覧
  const [items, setItems] = useState<Redemption[]>([]);

  /**
   * 親は「全員(all)」選択が可能
   * - ChildSwitcher の includeAll=true と合わせて、UI/状態の整合を取る
   */
  const [selectedChildId, setSelectedChildId] = useState<string>("all");

  /**
   * 申請一覧を取得する共通関数
   * - reward_redemptions を起点に children / rewards をJOINして表示用データを1回で揃える
   * - status=pending のみ取得し、申請順に並べる（親が古い申請から処理できる）
   */
  const fetchRows = useCallback(async () => {
    const { data, error } = await supabase
      .from("reward_redemptions")
      .select(
        `
        id,
        status,
        requested_at,
        child_id,
        children:children!reward_redemptions_child_id_fkey ( name ),
        rewards:rewards!reward_redemptions_reward_id_fkey ( title, required_points )
      `
      )
      .eq("status", "pending")
      .order("requested_at", { ascending: true });

    if (error) throw error;

    return (data ?? []) as unknown as Redemption[];
  }, []);

  useEffect(() => {
    // 非同期処理中にアンマウントされた場合の setState を防ぐ
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        const rows = await fetchRows();
        if (!alive) return;
        setItems(rows);
      } catch (e) {
        if (!alive) return;
        alert(JSON.stringify(e, null, 2));
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [fetchRows]);

  /**
   * 承認/却下後に最新状態を取得するための再読み込み
   * - 同じ fetchRows を使って取得ロジックを一元化
   */
  const reload = async () => {
    setLoading(true);
    try {
      const rows = await fetchRows();
      setItems(rows);
    } catch (e) {
      alert(JSON.stringify(e, null, 2));
    } finally {
      setLoading(false);
    }
  };

  /**
   * 子ども切替に応じた表示対象
   * - "all" の場合は pending 全件
   * - それ以外は child_id で絞り込み
   */
  const visibleItems = useMemo(() => {
    if (selectedChildId === "all") return items;
    return items.filter((r) => r.child_id === selectedChildId);
  }, [items, selectedChildId]);

  /**
   * 承認処理
   * - RPC で「ステータス更新 + ポイント減算」等の一連処理をサーバ側で実行
   * - 成功後は一覧を再取得して画面を最新状態にする
   */
  const approve = async (id: number) => {
    const { error } = await supabase.rpc("approve_reward_redemption", {
      p_redemption_id: id,
    });

    if (error) {
      alert(JSON.stringify(error, null, 2));
      return;
    }

    notifications.show({
      title: "承認しました",
      message: "ポイントを減算しました",
      color: "green",
    });

    void reload();
  };

  /**
   * 却下処理
   * - RPC でステータスを更新（却下）し、表示対象から外す
   * - 成功後は一覧を再取得して画面を最新状態にする
   */
  const reject = async (id: number) => {
    const { error } = await supabase.rpc("reject_reward_redemption", {
      p_redemption_id: id,
    });

    if (error) {
      alert(JSON.stringify(error, null, 2));
      return;
    }

    notifications.show({
      title: "却下しました",
      message: "申請を却下しました",
      color: "gray",
    });

    void reload();
  };

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={800} mb="xs">
        📩 ご褒美承認
      </Text>

      {/* 子ども切替（親は「全員」選択も可能） */}
      <Center mt="md">
        <ChildSwitcher
          storageKey="parent_selected_child_id"
          includeAll={true}
          onChange={(v) => setSelectedChildId(v)}
        />
      </Center>

      {loading ? (
        // 取得中
        <Group justify="center" mt="md">
          <Loader />
        </Group>
      ) : visibleItems.length === 0 ? (
        // 空状態
        <Text c="dimmed" mt="md">
          申請はありません
        </Text>
      ) : (
        // 申請一覧
        <Stack mt="md">
          {visibleItems.map((r) => (
            <Card key={r.id} withBorder shadow="sm">
              <Group justify="space-between" align="flex-start">
                <div>
                  <Text fw={700}>{r.rewards?.title ?? "-"}</Text>

                  <Group gap="xs" mt={6}>
                    <Badge size="sm" variant="light">
                      {r.rewards?.required_points ?? 0}pt
                    </Badge>
                    <Badge size="sm" variant="light">
                      {r.children?.name ?? "-"}
                    </Badge>
                  </Group>

                  <Text size="xs" c="dimmed" mt={6}>
                    申請日時:{" "}
                    {new Date(r.requested_at).toLocaleString("ja-JP")}
                  </Text>
                </div>

                {/* 親の判断操作：承認 / 却下 */}
                <Group>
                  <Button size="xs" color="green" onClick={() => approve(r.id)}>
                    承認
                  </Button>
                  <Button
                    size="xs"
                    variant="light"
                    color="gray"
                    onClick={() => reject(r.id)}
                  >
                    却下
                  </Button>
                </Group>
              </Group>
            </Card>
          ))}
        </Stack>
      )}
    </Container>
  );
}
