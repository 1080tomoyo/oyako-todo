"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Text,
  TextInput,
  NumberInput,
  Button,
  Card,
  Stack,
  Container,
  Select,
  Loader,
  Group,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useParams, useRouter } from "next/navigation";

type Task = {
  id: string;
  title: string;
  category: string;
  point: number;
};

/**
 * 親用：タスク編集ページ
 * - URL パラメータ（taskId）から対象タスクを取得し、フォームに初期値を反映する
 * - 保存：tasks を update して一覧へ戻る
 * - 削除：tasks を delete して一覧へ戻る
 * - 取得失敗時はトースト表示 → 一覧へリダイレクトする
 */
export default function TaskEditPage() {
  // 編集対象ID（/tasks/[id] などのルート想定）
  const { id: taskId } = useParams<{ id: string }>();
  const router = useRouter();

  // 初期取得中の表示制御 / 元データ保持（ロード完了判定にも使う）
  const [loading, setLoading] = useState(true);
  const [task, setTask] = useState<Task | null>(null);

  // フォーム入力状態（初期ロード時に DB 値を投入）
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string | null>("study");
  const [point, setPoint] = useState<number>(1);

  // 保存・削除中の二重操作防止
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // ===== 初期ロード =====
  useEffect(() => {
    /**
     * 編集対象タスクの取得
     * - taskId で単一取得し、フォームの初期値に反映する
     * - 取得できない場合は「存在しない/権限がない/削除済み」などを想定し一覧へ戻す
     */
    const load = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("id, title, category, point")
        .eq("id", taskId)
        .single();

      if (error || !data) {
        notifications.show({
          title: "読み込みに失敗しました",
          message: "タスクが見つかりません。",
          color: "red",
        });
        router.push("/tasks");
        return;
      }

      // DB値をフォーム状態へ反映
      setTask(data);
      setTitle(data.title);
      setCategory(data.category);
      setPoint(data.point);

      setLoading(false);
    };

    load();
  }, [taskId, router]);

  // ===== 保存 =====
  /**
   * 保存処理
   * - 必須入力を満たしている場合のみ更新
   * - 成功後はトースト表示して一覧へ戻る
   */
  const handleSave = async () => {
    if (!title.trim() || !category) return;

    setSaving(true);

    const { error } = await supabase
      .from("tasks")
      .update({ title, category, point })
      .eq("id", taskId);

    if (error) {
      notifications.show({
        title: "保存に失敗しました",
        message: "タスクの更新に失敗しました。",
        color: "red",
      });
      setSaving(false);
      return;
    }

    notifications.show({
      title: "保存しました",
      message: "タスクを更新しました 🎉",
      color: "var(--oyako-accent)",
    });

    router.push("/tasks");
  };

  // ===== 削除 =====
  /**
   * 削除処理
   * - 対象タスクを削除し、成功後は一覧へ戻る
   * - 削除は取り消しできない想定のため、UI上で色を変えて注意を促す
   */
  const handleDelete = async () => {
    setDeleting(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setDeleting(false);
      return;
    }

    const { error, count } = await supabase
      .from("tasks")
      .delete({ count: "exact" })
      .eq("id", taskId)
      .eq("user_id", user.id);

    console.log("DELETE DEBUG", {
      taskId,
      userId: user.id,
      count,
      error,
    });


    if (error) {
      notifications.show({
        title: "削除に失敗しました",
        message: error.message,
        color: "red",
      });
      setDeleting(false);
      return;
    }

    if (!count) {
      notifications.show({
        title: "削除できませんでした",
        message: "権限がない、または既に削除されています。",
        color: "yellow",
      });
      setDeleting(false);
      return;
    }

    notifications.show({
      title: "削除しました",
      message: "タスクを削除しました。",
      color: "red",
    });

    router.push("/tasks");
  };

  // ===== ローディング =====
  // 初期取得中、またはタスク未取得の場合は Loader を表示
  if (loading || !task) {
    return (
      <Container size="sm" py={24}>
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={700} mb="lg" c="var(--oyako-text)">
        ✏️ タスク編集
      </Text>

      {/* 入力フォーム（保存 / 削除） */}
      <Card withBorder shadow="sm" p="md">
        <Stack gap="sm">
          <TextInput
            label="タイトル"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Select
            label="カテゴリ"
            required
            data={[
              { value: "study", label: "学習" },
              { value: "chore", label: "お手伝い" },
              { value: "life", label: "生活" },
            ]}
            value={category}
            onChange={setCategory}
          />

          <NumberInput
            label="ポイント"
            required
            min={1}
            value={point}
            onChange={(v) =>
              // NumberInput は number | string | null になり得るため型をガードして保持する
              setPoint(typeof v === "number" ? v : point)
            }
          />

          {/* 送信中は loading 表示で二重操作を防ぐ */}
          <Button
            onClick={handleSave}
            loading={saving}
            style={{ background: "var(--oyako-accent)" }}
          >
            保存する
          </Button>

          <Button
            onClick={handleDelete}
            loading={deleting}
            color="red"
            variant="light"
          >
            削除する
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
