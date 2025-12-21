"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  Button,
  Card,
  Container,
  Group,
  Image,
  NumberInput,
  Select,
  Stack,
  Text,
  TextInput,
  Textarea,
  Loader,
  Box,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Child = { id: string; name: string };

type Reward = {
  id: number;
  title: string;
  description: string | null;
  required_points: number;
  image_url: string | null;
  child_id: string;
};

/**
 * 親用：ご褒美 編集ページ
 * - 既存ご褒美の「対象の子ども / タイトル / 説明 / 必要ポイント / 画像」を更新できる
 * - 画像は「変更なし / 新規選択 / 既存画像を削除」の3状態があり、
 *   その最終状態を removeImage + file で明示的に管理する（ここが仕様の肝）
 * - UI はタスク編集と同じ Card / ボタン構成に揃えて一貫性を保つ
 */
export default function RewardEditPage() {
  // URL パラメータから編集対象の reward id を取得
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  // input と label を紐づけるための id（アクセシビリティ/クリック導線）
  const inputId = useId();

  // file input を直接クリアするための参照（同じファイルを再選択できるようにする）
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // 初期データ取得中の表示制御
  const [loading, setLoading] = useState(true);

  // 取得した元データ（既存画像URLなど、更新判定の基準として保持）
  const [reward, setReward] = useState<Reward | null>(null);

  // 対象子ども選択肢（children テーブルから取得）
  const [children, setChildren] = useState<Child[]>([]);

  // 入力フォーム状態（DB値を初期ロード時に投入）
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState<number | "">(10);
  const [targetChildId, setTargetChildId] = useState("");

  /**
   * 画像関連の状態
   * - file: 新しく選択した画像ファイル（あればアップロード対象）
   * - preview: 選択ファイルを即表示するための ObjectURL
   */
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  /**
   * 既存画像を「消したい」状態
   * - 画像には「変更しない（既存維持）」「新しく選ぶ」「削除」の3パターンがあるため、
   *   removeImage というフラグで “削除” を明示する
   */
  const [removeImage, setRemoveImage] = useState(false);

  // 保存・削除中の二重操作防止
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    // 非同期処理中にアンマウントされた場合の setState を防ぐ
    let alive = true;

    const load = async () => {
      try {
        // ログイン確認（親ユーザー）
        const { data } = await supabase.auth.getUser();
        if (!data.user) return;

        // 子ども一覧を取得（対象選択のため）
        const { data: childrenData, error: childErr } = await supabase
          .from("children")
          .select("id, name")
          .eq("user_id", data.user.id)
          .order("created_at", { ascending: true });

        if (!alive) return;

        if (childErr) {
          alert(`子ども一覧の取得に失敗しました\n${childErr.message}`);
          return;
        }
        setChildren((childrenData ?? []) as Child[]);

        // 編集対象のご褒美を取得
        const { data: rewardData, error: rewardErr } = await supabase
          .from("rewards")
          .select("*")
          .eq("id", id)
          .single();

        if (!alive) return;

        // 該当データがなければ一覧へ戻す（不正URL/削除済みなど）
        if (rewardErr || !rewardData) {
          router.push("/parent/rewards");
          return;
        }

        // フォームに初期値を反映
        const r = rewardData as Reward;
        setReward(r);
        setTitle(r.title);
        setDescription(r.description ?? "");
        setPoints(r.required_points);
        setTargetChildId(r.child_id);

        // 初期状態では「既存画像を消す」ではない
        setRemoveImage(false);

        setLoading(false);
      } catch (e) {
        console.error(e);
        alert("読み込みに失敗しました");
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [id, router]);

  /**
   * ファイル選択時
   * - 選択した画像を即プレビュー表示する
   * - 以前の ObjectURL は revoke してメモリリークを防ぐ
   * - 新規選択した場合は「既存画像削除」フラグを解除する（矛盾防止）
   */
  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] ?? null;

    // 以前の preview URL があれば解放
    if (preview) URL.revokeObjectURL(preview);

    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);

    // 新しく選んだら「既存画像を消す」フラグは解除
    setRemoveImage(false);
  };

  /**
   * 画像クリア
   * - プレビュー/選択ファイルを消し、既存画像も削除対象にする
   * - input.value をクリアして、同じファイルを再選択できるようにする
   */
  const clearImage = () => {
    // 以前の preview URL があれば解放
    if (preview) URL.revokeObjectURL(preview);

    setFile(null);
    setPreview(null);

    // 既存画像も「消したい」
    setRemoveImage(true);

    // input 自体もクリア（同じファイルをもう一度選べる）
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  /**
   * 画像アップロード
   * - file が存在する場合のみ storage にアップロードし publicUrl を返す
   * - file がない場合は null（呼び出し元で「変更なし/削除」の分岐を持つ）
   */
  const uploadImage = async (userId: string) => {
    if (!file) return null;

    const ext = file.name.split(".").pop() || "png";
    const path = `rewards/${userId}/reward_${Date.now()}.${ext}`;

    const { error } = await supabase.storage
      .from("reward_images")
      .upload(path, file, {
        upsert: true,
        contentType: file.type || "image/*",
      });

    if (error) throw error;

    return supabase.storage.from("reward_images").getPublicUrl(path).data.publicUrl;
  };

  /**
   * 保存処理
   * - 必須入力を満たしている場合のみ更新
   * - 画像の最終状態（維持/新規/削除）を removeImage + file から決定して保存する
   */
  const handleSave = async () => {
    if (!reward) return;
    if (!title.trim() || !targetChildId || points === "") return;

    setSaving(true);

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;

      /**
       * 画像の最終決定ロジック
       * - removeImage=true            → null（画像なし）
       * - removeImage=false & fileあり → upload してURL
       * - removeImage=false & fileなし → 既存URL維持
       */
      let imageUrl: string | null = reward.image_url ?? null;

      if (removeImage) {
        imageUrl = null;
      } else if (file) {
        imageUrl = await uploadImage(data.user.id);
      }

      const { error } = await supabase
        .from("rewards")
        .update({
          title,
          description,
          required_points: points,
          child_id: targetChildId,
          image_url: imageUrl,
        })
        .eq("id", reward.id);

      if (error) {
        notifications.show({
          title: "保存に失敗しました",
          message: "ご褒美の更新に失敗しました。",
          color: "red",
        });
        return;
      }

      notifications.show({
        title: "保存しました",
        message: "ご褒美の内容を更新しました 🎉",
        color: "var(--oyako-accent)",
      });

      router.push("/parent/rewards");
    } catch (e) {
      console.error(e);
      notifications.show({
        title: "保存に失敗しました",
        message: "画像アップロードに失敗した可能性があります。",
        color: "red",
      });
    } finally {
      setSaving(false);
    }
  };

  /**
   * 削除処理
   * - 指定の reward を削除し、成功後は一覧へ戻す
   */
  const handleDelete = async () => {
    if (!reward) return;

    setDeleting(true);

    try {
      const { error } = await supabase.from("rewards").delete().eq("id", reward.id);

      if (error) {
        notifications.show({
          title: "削除に失敗しました",
          message: "ご褒美を削除できませんでした。",
          color: "red",
        });
        return;
      }

      notifications.show({
        title: "削除しました",
        message: "ご褒美を削除しました。",
        color: "red",
      });

      router.push("/parent/rewards");
    } finally {
      setDeleting(false);
    }
  };

  // 初期ロード中、または対象データ未取得の場合は Loader を表示
  if (loading || !reward) {
    return (
      <Container size="sm" py={24}>
        <Group justify="center">
          <Loader />
        </Group>
      </Container>
    );
  }

  // 保存可能条件（必須入力の簡易バリデーション）
  const canSave =
    title.trim().length > 0 && points !== "" && Boolean(targetChildId);

  /**
   * 表示用画像ソース
   * - preview を最優先
   * - removeImage=true の場合は表示しない
   * - それ以外は既存URLを表示
   */
  const displaySrc = removeImage ? null : (preview ?? reward.image_url ?? null);

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={700} mb="lg" c="var(--oyako-text)">
        🎁 ご褒美編集
      </Text>

      {/* タスク編集と同じ Card UI（見た目/操作感の統一） */}
      <Card
        withBorder
        shadow="sm"
        p="md"
        style={{
          background: "var(--oyako-card)",
          borderColor: "var(--oyako-border)",
        }}
      >
        <Stack gap="sm">
          <Select
            label="対象の子ども"
            placeholder="選択してください"
            data={children.map((c) => ({ value: c.id, label: c.name }))}
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

          <Textarea
            label="説明（任意）"
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
          />

          <NumberInput
            label="必要ポイント"
            min={1}
            value={points}
            onChange={(v) => setPoints(typeof v === "number" ? v : "")}
            required
          />

          {/* ファイル選択は input を隠して label(Box) で押しやすいUIにする */}
          <Text fw={600}>画像（任意）</Text>

          <input
            ref={fileInputRef}
            id={inputId}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            style={{ display: "none" }}
            onChange={onPickFile}
          />

          <Box
            component="label"
            htmlFor={inputId}
            mt="xs"
            w="100%"
            style={{
              display: "block",
              width: "100%",
              border: "2px dashed #d0d0d0",
              borderRadius: 12,
              padding: 18,
              cursor: "pointer",
              userSelect: "none",
              boxSizing: "border-box",
            }}
          >
            {!displaySrc ? (
              <Stack align="center" gap={6}>
                <Text size="44px" fw={800} c="dimmed">
                  ＋
                </Text>
                <Text size="sm" c="dimmed">
                  ファイルの選択
                </Text>
                <Text size="xs" c="dimmed">
                  JPG / PNG / WEBP（最大5MB目安）
                </Text>
              </Stack>
            ) : (
              <Stack gap="xs">
                <Image src={displaySrc} h={160} radius="md" />

                <Group justify="space-between">
                  <Text size="sm" c="dimmed">
                    {file ? `選択中：${file.name}` : "現在の画像"}
                  </Text>

                  <Button
                    size="xs"
                    variant="subtle"
                    onClick={(e) => {
                      e.preventDefault(); // labelクリック扱いを止める
                      clearImage();
                    }}
                  >
                    クリア
                  </Button>
                </Group>
              </Stack>
            )}
          </Box>

          {/* 下部の操作ボタンはタスク編集と同じ並びで統一 */}
          <Button
            onClick={handleSave}
            loading={saving}
            disabled={!canSave}
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
