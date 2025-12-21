"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Text,
  Card,
  Group,
  Button,
  Loader,
  Stack,
  Badge,
  Container,
  Center,
} from "@mantine/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ChildSwitcher from "@/app/(components)/ChildSwitcher";

/**
 * 子ども情報
 * - ダッシュボードではポイント合計や表示切り替えに使用
 */
type Child = {
  id: string;
  name: string;
  points: number;
};

/**
 * タスク情報（一覧・進捗集計用）
 */
type Task = {
  id: string;
  child_id: string;
  title: string;
  category: string;
  point: number;
  is_done: boolean;
};

/**
 * ご褒美申請（pending 件数集計用）
 */
type RedemptionRow = {
  id: number;
  child_id: string;
  status: string;
};

/**
 * 親用ダッシュボードページ
 *
 * - 子ども別 / 全体の切り替え
 * - ポイント合計の可視化
 * - タスク進捗（完了 / 未完了）
 * - ご褒美申請（承認待ち件数）
 *
 * を一画面に集約するトップページ
 */
export default function DashboardPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  // 表示対象の子ども（"all" or 特定の child_id）
  const [selectedChildId, setSelectedChildId] = useState<string>("all");

  const [children, setChildren] = useState<Child[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [pendingRedemptions, setPendingRedemptions] =
    useState<RedemptionRow[]>([]);

  // 表示用ラベル / カラー定義（UI責務）
  const categoryLabel: Record<string, string> = {
    study: "学習",
    chore: "お手伝い",
    life: "生活",
  };

  const categoryColor: Record<string, string> = {
    study: "var(--oyako-study)",
    chore: "var(--oyako-chore)",
    life: "var(--oyako-life)",
  };

  /**
   * 初期データ取得
   * - 未ログインの場合はサインイン画面へリダイレクト
   * - children / tasks / reward_redemptions を一括取得
   *
   * alive フラグにより、アンマウント後の setState を防止
   */
  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push("/signin");
          return;
        }

        // --- 子ども一覧 ---
        const { data: childrenData, error: childErr } = await supabase
          .from("children")
          .select("id, name, points")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (!alive) return;

        if (childErr) {
          alert("children 取得失敗\n" + childErr.message);
          return;
        }
        setChildren((childrenData ?? []) as Child[]);

        // --- タスク一覧 ---
        const { data: tasksData, error: tasksErr } = await supabase
          .from("tasks")
          .select("id, child_id, title, category, point, is_done")
          .eq("user_id", user.id)
          .order("created_at", { ascending: true });

        if (!alive) return;

        if (tasksErr) {
          alert("tasks 取得失敗\n" + tasksErr.message);
          return;
        }
        setTasks((tasksData ?? []) as Task[]);

        // --- ご褒美申請（承認待ち） ---
        const { data: redData, error: redErr } = await supabase
          .from("reward_redemptions")
          .select("id, child_id, status")
          .eq("status", "pending");

        if (!alive) return;

        if (redErr) {
          alert("reward_redemptions 取得失敗\n" + redErr.message);
          return;
        }
        setPendingRedemptions((redData ?? []) as RedemptionRow[]);
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [router]);

  // ===== 表示用集計 =====

  /**
   * 表示対象の子ども（all or 単体）
   */
  const visibleChildren = useMemo(() => {
    if (selectedChildId === "all") return children;
    return children.filter((c) => c.id === selectedChildId);
  }, [children, selectedChildId]);

  /**
   * ポイント合計（子ども単位 or 全体）
   */
  const pointsSum = useMemo(() => {
    return visibleChildren.reduce((sum, c) => sum + (c.points ?? 0), 0);
  }, [visibleChildren]);

  /**
   * 表示対象タスク（子どもで絞り込み）
   */
  const activeTasks = useMemo(() => {
    if (selectedChildId === "all") return tasks;
    return tasks.filter((t) => t.child_id === selectedChildId);
  }, [tasks, selectedChildId]);

  /**
   * タスク進捗集計
   */
  const doneCount = useMemo(
    () => activeTasks.filter((t) => t.is_done).length,
    [activeTasks]
  );
  const totalCount = useMemo(() => activeTasks.length, [activeTasks]);
  const remainingCount = useMemo(
    () => activeTasks.filter((t) => !t.is_done).length,
    [activeTasks]
  );

  /**
   * ダッシュボードに表示する未完了タスクのみ
   */
  const todoTasks = useMemo(() => {
    return activeTasks.filter((t) => !t.is_done);
  }, [activeTasks]);

  /**
   * 承認待ちご褒美申請数（子どもで絞り込み）
   */
  const pendingCount = useMemo(() => {
    if (selectedChildId === "all") return pendingRedemptions.length;
    return pendingRedemptions.filter((r) => r.child_id === selectedChildId)
      .length;
  }, [pendingRedemptions, selectedChildId]);

  return (
    <Container size="sm" py={24}>
      {/* ヘッダー */}
      <Group justify="space-between" mb="xs">
        <Text size="xl" fw={800} c="var(--oyako-text)">
          🏠 ダッシュボード
        </Text>

        <Button
          component={Link}
          href="/tasks/create"
          size="sm"
          style={{ background: "var(--oyako-accent)" }}
        >
          ＋ タスク追加
        </Button>
      </Group>

      {/* 子ども切り替え */}
      <Center mt="md" mb="lg">
        <ChildSwitcher
          storageKey="parent_selected_child_id"
          includeAll={true}
          onChange={(v) => setSelectedChildId(v)}
        />
      </Center>

      {loading ? (
        <Group justify="center" mt="md">
          <Loader />
        </Group>
      ) : children.length === 0 ? (
        <Text>まずは「マイページ」で子どもを登録してください。</Text>
      ) : (
        <Stack>
          {/* ポイント表示 */}
          <Card withBorder shadow="sm" p="md">
            <Group justify="space-between">
              <div>
                <Text fw={800} c="var(--oyako-text)">
                  💰 いまのポイント
                </Text>
                <Text size="xl" fw={900} c="var(--oyako-text)" mt={4}>
                  {pointsSum} pt
                </Text>
              </div>

              <Button component={Link} href="/mypage" variant="light" size="xs">
                マイページ
              </Button>
            </Group>
          </Card>

          {/* タスク進捗 */}
          <Card withBorder shadow="sm" p="md">
            <Group justify="space-between" mb="sm">
              <Text fw={800} c="var(--oyako-text)">
                📝 残っているタスク（最大3件まで表示）
              </Text>
              <Button component={Link} href="/tasks" variant="light" size="xs">
                タスク一覧
              </Button>
            </Group>

            <Group gap="xs" mb="md">
              <Badge color="green" variant="light">
                完了：{doneCount}
              </Badge>
              <Badge color="gray" variant="light">
                のこり：{remainingCount}
              </Badge>
              <Badge variant="light">合計：{totalCount}</Badge>
            </Group>

            {todoTasks.length === 0 ? (
              <Card withBorder p="sm" shadow="xs">
                <Text c="dimmed">未完了のタスクはありません</Text>
              </Card>
            ) : (
              todoTasks.slice(0, 3).map((t) => (
                <Card key={t.id} withBorder p="sm" shadow="xs" mb={8}>
                  <Text fw={700} c="var(--oyako-text)">
                    {t.title}
                  </Text>
                  <Group gap="xs" mt={6}>
                    <Badge
                      size="sm"
                      style={{
                        background: categoryColor[t.category] ?? "#999",
                        color: "#fff",
                      }}
                    >
                      {categoryLabel[t.category] ?? t.category}
                    </Badge>
                    <Badge size="sm" variant="light">
                      {t.point}pt
                    </Badge>
                  </Group>
                </Card>
              ))
            )}
          </Card>

          {/* ご褒美申請 */}
          <Card withBorder shadow="sm" p="md">
            <Group justify="space-between">
              <div>
                <Text fw={800} c="var(--oyako-text)">
                  📩 ごほうび申請
                </Text>
                <Text size="xl" fw={900} c="var(--oyako-text)" mt={4}>
                  {pendingCount} 件
                </Text>
              </div>

              <Button
                component={Link}
                href="/parent/redemptions"
                variant="light"
                size="xs"
              >
                申請一覧
              </Button>
            </Group>
          </Card>
        </Stack>
      )}
    </Container>
  );
}
