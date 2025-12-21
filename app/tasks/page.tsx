"use client";

import { useEffect, useMemo, useState, useId } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Text,
  Card,
  Group,
  Button,
  Loader,
  Stack,
  Container,
  Badge,
  Center,
  Modal,
  TextInput,
  NumberInput,
  Select,
  Switch,
} from "@mantine/core";
import Link from "next/link";
import ChildSwitcher from "@/app/(components)/ChildSwitcher";

type Task = {
  id: string;
  title: string;
  category: string;
  point: number;
  child_id: string;
};

type Child = {
  id: string;
  name: string;
};

/**
 * 親用：タスク一覧ページ（一覧 + 子ども絞り込み + 新規作成モーダル + 編集導線）
 * - 親は「全員(all)」での閲覧が可能（ChildSwitcher includeAll=true）
 * - 一覧表示ではカテゴリ/ポイント/対象の子どもをバッジで可視化する
 * - 新規作成はページ遷移せずモーダルで追加（入力→insert→再取得→一覧更新）
 * - 編集は /tasks/[id]/edit に遷移する
 */
export default function TasksPage() {
  // モーダル内 input と label を紐づけるための id（※現状は使用のみ）
  const inputId = useId();

  // 一覧データ
  const [tasks, setTasks] = useState<Task[]>([]);

  // 子ども一覧（表示/作成対象の選択肢）
  const [children, setChildren] = useState<Child[]>([]);

  /**
   * 子どもID → 子ども名 の参照マップ
   * - 一覧表示のたびに find しないため Map として保持する
   */
  const [childrenMap, setChildrenMap] = useState<Record<string, string>>({});

  // 初期取得中の表示制御
  const [loading, setLoading] = useState(true);

  /**
   * 親は all OK
   * - "all" の場合は全件表示、それ以外は child_id で絞り込み
   */
  const [selectedChildId, setSelectedChildId] = useState<string>("all");

  // ===== モーダル用 state =====

  // 新規作成モーダルの開閉
  const [opened, setOpened] = useState(false);

  // 入力フォーム状態
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [point, setPoint] = useState<number | "">(10);

  /**
   * 作成対象の子ども
   * - 親の一覧は all 表示があり得るため、
   *   モーダルを開くときに selectedChildId を初期値として引き継ぐ
   */
  const [targetChildId, setTargetChildId] = useState<string>("");

  // 作成中の二重操作防止
  const [creating, setCreating] = useState(false);

  // ===== 表示用 =====

  /**
   * UI 表示用：カテゴリのラベルと色
   * - DB の category はキー（study/chore/life）として持ち、
   *   画面には日本語ラベルとテーマカラーで表示する
   */
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

  // ===== 初期ロード =====
  useEffect(() => {
    /**
     * 初回ロード処理
     * - 親ユーザー（ログイン中ユーザー）を取得
     * - children を取得して childrenMap を作成
     * - tasks を取得して一覧に反映
     */
    const load = async () => {
      setLoading(true);

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // children：対象子ども名の表示やモーダル選択肢に利用
      const { data: childrenData } = await supabase
        .from("children")
        .select("id, name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      const list = (childrenData ?? []) as Child[];
      setChildren(list);

      // id → name の参照マップを構築
      const map: Record<string, string> = {};
      list.forEach((c) => (map[c.id] = c.name));
      setChildrenMap(map);

      // tasks：親ユーザー配下のタスクを取得
      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      setTasks((tasksData ?? []) as Task[]);
      setLoading(false);
    };

    load();
  }, []);

  // ===== 表示フィルタ =====
  /**
   * 子ども切替に応じて表示するタスクを絞り込む
   * - "all" は全件
   * - それ以外は child_id でフィルタ
   */
  const visibleTasks = useMemo(() => {
    if (selectedChildId === "all") return tasks;
    return tasks.filter((t) => t.child_id === selectedChildId);
  }, [tasks, selectedChildId]);

  // ===== 新規タスク作成 =====
  /**
   * 新規作成処理（モーダル）
   * - 必須入力（title / category / targetChildId / point）を満たしている場合のみ insert
   * - 作成後は tasks を再取得して UI を最新化する（簡易的な同期の取り方）
   * - フォーム状態をリセットし、モーダルを閉じる
   */
  const createTask = async () => {
    if (!title.trim() || !category || !targetChildId || point === "") return;

    setCreating(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCreating(false);
      return;
    }

    const { error } = await supabase.from("tasks").insert({
      user_id: user.id,
      child_id: targetChildId,
      title,
      category,
      point,
    });

    if (error) {
      alert(`タスク作成に失敗しました\n${error.message}`);
      setCreating(false);
      return;
    }

    // リロード：作成後の一覧を最新化
    const { data: tasksData } = await supabase
      .from("tasks")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true });

    setTasks((tasksData ?? []) as Task[]);

    // reset：モーダルとフォーム状態を初期化
    setOpened(false);
    setTitle("");
    setCategory(null);
    setPoint(10);
    setTargetChildId("");
    setCreating(false);
  };

  return (
    <>
      <Container size="sm" py={24}>
        <Group justify="space-between" mb="lg">
          <Text size="xl" fw={700} c="var(--oyako-text)">
            📝 タスク一覧
          </Text>

          {/* 新規作成：ページ遷移ではなくモーダルで追加する */}
          <Button
            onClick={() => {
              // 子ども選択中なら、その子を作成フォームに引き継ぐ（UX）
              setTargetChildId(selectedChildId === "all" ? "" : selectedChildId);
              setOpened(true);
            }}
            style={{ background: "var(--oyako-accent)" }}
            size="sm"
          >
            ＋ 新規タスク
          </Button>
        </Group>

        {/* 子ども切替（親は all あり） */}
        <Center mb="lg">
          <ChildSwitcher
            storageKey="parent_selected_child_id"
            includeAll={true}
            onChange={(v) => setSelectedChildId(v)}
          />
        </Center>

        {loading ? (
          <Group justify="center">
            <Loader />
          </Group>
        ) : visibleTasks.length === 0 ? (
          <Text c="dimmed">タスクがありません。</Text>
        ) : (
          <Stack>
            {visibleTasks.map((task) => (
              <Card
                key={task.id}
                withBorder
                shadow="sm"
                p="md"
                style={{
                  background: "var(--oyako-card)",
                  borderColor: "var(--oyako-border)",
                }}
              >
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text fw={700}>{task.title}</Text>

                    {/* メタ情報をバッジで集約（カテゴリ/ポイント/対象の子ども） */}
                    <Group mt={4} gap={8}>
                      <Badge
                        size="sm"
                        style={{
                          background: categoryColor[task.category],
                          color: "#fff",
                        }}
                      >
                        {categoryLabel[task.category]}
                      </Badge>

                      <Badge size="sm" variant="light">
                        {task.point}pt
                      </Badge>

                      <Badge size="sm" variant="light">
                        {childrenMap[task.child_id]}
                      </Badge>
                    </Group>
                  </div>

                  {/* 編集導線：タスク編集ページへ */}
                  <Button
                    component={Link}
                    href={`/tasks/${task.id}/edit`}
                    size="xs"
                    variant="light"
                    style={{
                      color: "var(--oyako-text)",
                      borderColor: "var(--oyako-accent)",
                    }}
                  >
                    編集
                  </Button>
                </Group>
              </Card>
            ))}
          </Stack>
        )}
      </Container>

      {/* ===== 新規タスク作成モーダル ===== */}
      <Modal opened={opened} onClose={() => setOpened(false)} title="タスクを追加">
        <Stack>
          <Select
            label="対象の子ども"
            data={children.map((c) => ({
              value: c.id,
              label: c.name,
            }))}
            value={targetChildId}
            onChange={(v) => setTargetChildId(v ?? "")}
            required
          />

          <TextInput
            label="タイトル"
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
          />

          <Select
            label="カテゴリ"
            data={[
              { value: "study", label: "学習" },
              { value: "chore", label: "お手伝い" },
              { value: "life", label: "生活" },
            ]}
            value={category}
            onChange={setCategory}
            required
          />

          <NumberInput
            label="ポイント"
            min={1}
            value={point}
            onChange={(v) => setPoint(typeof v === "number" ? v : "")}
            required
          />

          {/* 必須入力が揃うまで無効化し、誤登録を防ぐ */}
          <Button
            fullWidth
            onClick={createTask}
            disabled={
              !title.trim() || !category || !targetChildId || point === ""
            }
            loading={creating}
          >
            登録
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
