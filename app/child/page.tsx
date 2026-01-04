"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Button,
  Card,
  Container,
  Group,
  Loader,
  Stack,
  Text,
  Center,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { supabase } from "@/lib/supabaseClient";
import ChildSwitcher from "@/app/(components)/ChildSwitcher";

/**
 * 子ども 1人分（表示に必要な最小項目）
 */
type Child = {
  id: string;
  name: string;
  points: number;
};

/**
 * タスク 1件分（子ども表示に必要な項目）
 * - category は DB 値（study/chore/life）を想定
 * - point は達成時に加算されるポイント
 */
type Task = {
  id: string; // uuid
  user_id: string;
  child_id: string;
  title: string;
  category: string;
  point: number;
  is_done: boolean;
};

/**
 * 子ども用 タスク一覧ページ
 * - 子どもを切り替えながら「今日のやること」を確認・完了できる
 * - 完了/やりなおしに応じてポイントを加算/減算し、履歴（point_transactions）も残す
 * - ローディング / 空状態 / 一覧表示を明確に分岐
 */
export default function ChildPage() {
  // 初期データ取得中の表示制御
  const [loading, setLoading] = useState(true);

  // ログイン中の親に紐づく子ども一覧
  const [children, setChildren] = useState<Child[]>([]);

  // 現在選択されている子どもID（未選択の場合は ""）
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  // 取得したタスク一覧（親配下の全タスク）
  const [tasks, setTasks] = useState<Task[]>([]);

  // 子どもID -> 現在ポイント（表示用に即参照できるよう map 化）
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});

  /**
   * カテゴリ表示は子どもが読む前提のため「ひらがな」で統一
   * - DBのカテゴリ値（study/chore/life）を表示ラベルに変換
   */
  const categoryLabel: Record<string, string> = {
    study: "べんきょう",
    chore: "おてつだい",
    life: "せいかつ",
  };

  /**
   * カテゴリごとに色を固定し、視覚的に判別しやすくする
   */
  const categoryColor: Record<string, string> = {
    study: "var(--oyako-study)",
    chore: "var(--oyako-chore)",
    life: "var(--oyako-life)",
  };

  /**
   * 選択中の子どもの現在ポイント
   * - 未選択時は 0 とする
   */
  const currentPoints = useMemo(() => {
    if (!selectedChildId) return 0;
    return pointsMap[selectedChildId] ?? 0;
  }, [pointsMap, selectedChildId]);

  /**
   * 選択中の子どもに紐づくタスクのみを抽出
   * - 子ども未選択時は空配列
   */
  const visibleTasks = useMemo(() => {
    if (!selectedChildId) return [];
    return tasks.filter((t) => t.child_id === selectedChildId);
  }, [tasks, selectedChildId]);

  /**
   * 表示順：未完了 → 完了
   * - 子どもが「いまやること」を上に見られるように並び替える
   */
  const sortedTasks = useMemo(() => {
    return [...visibleTasks].sort(
      (a, b) => Number(a.is_done) - Number(b.is_done)
    );
  }, [visibleTasks]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 現在ログインしている親ユーザーを取得
      const {
        data: { user },
        error: userErr,
      } = await supabase.auth.getUser();

      // 未ログイン時は保護ページ想定のため、空で終了
      if (userErr || !user) {
        setChildren([]);
        setTasks([]);
        setSelectedChildId("");
        setPointsMap({});
        setLoading(false);
        return;
      }

      // 子ども一覧（ポイント含む）を取得（親 user_id で絞り込み）
      const { data: childrenData, error: childErr } = await supabase
        .from("children")
        .select("id, name, points")
        .eq("user_id", user.id);

      if (childErr) {
        alert("こどもの じょうほうが とれなかったよ\n" + childErr.message);
        setLoading(false);
        return;
      }

      const list = (childrenData ?? []) as Child[];
      setChildren(list);

      // 子ども未登録時：選択IDが localStorage に残って混乱するためリセットする
      if (list.length === 0) {
        setSelectedChildId("");
        setPointsMap({});
        setTasks([]);
        try {
          localStorage.removeItem("child_selected_child_id");
        } catch {}
        setLoading(false);
        return;
      }

      // 子どもごとのポイントを即時参照できるよう map 化
      const pm: Record<string, number> = {};
      list.forEach((c) => (pm[c.id] = c.points ?? 0));
      setPointsMap(pm);

      // 親配下のタスクを取得し、表示側で子ども別に絞り込む
      const { data: tasksData, error: tasksErr } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (tasksErr) {
        alert("やることが とれなかったよ\n" + tasksErr.message);
        setLoading(false);
        return;
      }

      setTasks((tasksData ?? []) as Task[]);
      setLoading(false);
    };

    // 初回マウント時のみデータ取得
    load();
  }, []);

  /**
   * タスクの完了/未完了を切り替える処理
   * - 子ども未選択時は操作不可（切り替えを促す）
   * - タスク状態更新 → ポイント更新 → 履歴登録 の順に処理する
   */
  const toggleDone = async (task: Task) => {
    // 子ども未選択の場合は先に選択を促す
    if (!selectedChildId) {
      notifications.show({
        message: "だれの がめんにする？ えらんでね",
        color: "yellow",
      });
      return;
    }

    // 表示中の子どもと異なるタスクは変更不可（誤操作防止）
    if (task.child_id !== selectedChildId) {
      notifications.show({
        message: "いま えらんでる こどもの やることだけ さわれるよ",
        color: "yellow",
      });
      return;
    }

    // 次の完了状態とポイント増減（完了→加算 / やりなおし→減算）
    const nextDone = !task.is_done;
    const delta = nextDone ? task.point : -task.point;

    // 認証状態の再確認（DB更新の前提）
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // ① タスク完了状態を更新（RPC：更新処理をサーバ側に集約）
    const { error: updateTaskErr } = await supabase.rpc("toggle_task_done", {
      p_task_id: String(task.id),
      p_is_done: nextDone,
    });

    if (updateTaskErr) {
      alert("やることの こうしんに しっぱいしたよ\n" + updateTaskErr.message);
      return;
    }

    // ② 現在ポイントを取得（最新値をもとに計算する）
    const { data: childRow, error: getPointErr } = await supabase
      .from("children")
      .select("points")
      .eq("id", selectedChildId)
      .single();

    if (getPointErr || !childRow) {
      alert("ぽいんとが みれなかったよ\n" + (getPointErr?.message ?? ""));
      return;
    }

    // ポイントは 0 未満にならないよう下限を設ける
    const newPoints = Math.max(0, (childRow.points ?? 0) + delta);

    // ③ 子どものポイントを更新
    const { error: updatePointErr } = await supabase
      .from("children")
      .update({ points: newPoints })
      .eq("id", selectedChildId);

    if (updatePointErr) {
      alert("ぽいんとの こうしんに しっぱいしたよ\n" + updatePointErr.message);
      return;
    }

    // ④ ポイント履歴を登録（タスクの達成/取り消しを記録）
    const { error: txErr } = await supabase.from("point_transactions").insert({
      child_id: selectedChildId,
      type: nextDone ? "task_done" : "task_undo",
      points: delta,
      note: nextDone ? `できた：${task.title}` : `やりなおし：${task.title}`,
    });

    if (txErr) {
      alert("りれきの ほぞんに しっぱいしたよ\n" + txErr.message);
      return;
    }

    // UI を即時反映（完了状態とポイント表示）
    setTasks((prev) =>
      prev.map((t) => (t.id === task.id ? { ...t, is_done: nextDone } : t))
    );
    setPointsMap((prev) => ({ ...prev, [selectedChildId]: newPoints }));

    // 結果をトーストで通知
    notifications.show({
      title: nextDone ? "できた！" : "やりなおしたよ",
      message: `${delta > 0 ? "+" : ""}${delta} ぽいんと`,
      color: delta > 0 ? "green" : "gray",
    });
  };

  return (
    <Container size="sm" py={24}>
      <Center>
        <Text size="xl" fw={800} c="var(--oyako-text)">
          🧒 きょうの やること
        </Text>
      </Center>

      {/* 子ども切り替え */}
      <Center mt="md">
        <ChildSwitcher
          storageKey="child_selected_child_id"
          includeAll={false}
          onChange={(id) => setSelectedChildId(id)}
        />
      </Center>

      {/* 現在ポイント表示 */}
      <Group justify="center" mt="lg">
        <Text fw={700} c="var(--oyako-text)">
          {!selectedChildId
            ? "だれの がめんにする？"
            : `いまの ぽいんと：${currentPoints} ぽいんと`}
        </Text>
      </Group>

      {loading ? (
        // データ取得中は中央に Loader を表示
        <Group justify="center" mt="md">
          <Loader />
        </Group>
      ) : (
        <Stack mt="md">
          {sortedTasks.map((task) => (
            <Card
              key={task.id}
              withBorder
              shadow="sm"
              p="md"
              style={{
                // 完了タスクは薄くして区別する
                opacity: task.is_done ? 0.45 : 1,
                filter: task.is_done ? "grayscale(0.2)" : "none",
              }}
            >
              <Group justify="space-between" align="center">
                <div>
                  <Text
                    fw={800}
                    c="var(--oyako-text)"
                    td={task.is_done ? "line-through" : undefined}
                  >
                    {task.title}
                  </Text>

                  <Group mt={6} gap={8}>
                    {/* カテゴリ表示（色固定） */}
                    <Badge
                      size="sm"
                      style={{
                        background: categoryColor[task.category] ?? "#999",
                        color: "#fff",
                      }}
                    >
                      {categoryLabel[task.category] ?? task.category}
                    </Badge>

                    <Badge size="sm" variant="light">
                      {task.point}ぽいんと
                    </Badge>

                    {task.is_done && (
                      <Badge size="sm" color="green" variant="light">
                        できた！
                      </Badge>
                    )}
                  </Group>
                </div>

                {/* 完了/やりなおしを同一ボタンで切り替える */}
                <Button
                  size="xs"
                  onClick={() => toggleDone(task)}
                  variant={task.is_done ? "light" : "filled"}
                >
                  {task.is_done ? "やりなおす" : "できた！"}
                </Button>
              </Group>
            </Card>
          ))}

          {/* 空状態（子ども未選択 / タスク未登録） */}
          {sortedTasks.length === 0 && (
            <Card withBorder shadow="sm" p="md">
              <Text c="dimmed">
                {!selectedChildId
                  ? "まずは「マイページ」で子どもを登録してください。"
                  : "やることが ないよ"}
              </Text>
            </Card>
          )}
        </Stack>
      )}
    </Container>
  );
}
