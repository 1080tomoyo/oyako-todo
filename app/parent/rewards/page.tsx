"use client";

import { useEffect, useId, useMemo, useState } from "react";
import {
  Badge,
  Box,
  Button,
  Card,
  Center,
  Container,
  Group,
  Image,
  Loader,
  Modal,
  NumberInput,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { Reward } from "@/types/reward";
import ChildSwitcher from "@/app/(components)/ChildSwitcher";

type Child = {
  id: string;
  name: string;
};

/**
 * 親用：ご褒美カタログ（一覧 + 新規作成 + 表示切替 + 編集導線）
 * - 子ども別にご褒美を管理できる（親は「全員/all」絞り込みも可能）
 * - 一覧：子ども切替で表示対象をフィルタ
 * - 新規：モーダルで登録（画像アップロードも任意で対応）
 * - 更新：表示/非表示（is_active）を切り替え
 * - 詳細編集：編集ページへ遷移
 */
export default function ParentRewardsPage() {
  const router = useRouter();

  // モーダル内の file input と label を紐づけるための id
  const inputId = useId();

  // ご褒美一覧
  const [rewards, setRewards] = useState<Reward[]>([]);

  // 初期取得・再取得中の表示制御
  const [loading, setLoading] = useState(true);

  /**
   * 親は「全員(all)」での閲覧が可能
   * - ChildSwitcher(includeAll=true) とセットで扱う
   */
  const [selectedChildId, setSelectedChildId] = useState<string>("all");

  // 子ども一覧（表示バッジ・作成対象の選択肢に利用）
  const [children, setChildren] = useState<Child[]>([]);

  /**
   * 子どもID→子ども名 の参照マップ
   * - 一覧表示のたびに線形探索しないため useMemo で生成
   */
  const childrenMap = useMemo(() => {
    const map: Record<string, string> = {};
    children.forEach((c) => (map[c.id] = c.name));
    return map;
  }, [children]);

  // -----------------------
  // 新規作成モーダル / フォーム状態
  // -----------------------
  const [opened, setOpened] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState<number | "">(10);

  /**
   * 新規作成時の対象子ども
   * - 「全員なし」：必ず child_id を持つ前提（未選択は弾く）
   */
  const [targetChildId, setTargetChildId] = useState<string>("");

  /**
   * 新規作成用：画像選択状態
   * - file: 選択中の画像ファイル
   * - preview: 選択直後に表示するための ObjectURL
   */
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  // -----------------------
  // データ取得
  // -----------------------

  /**
   * 子ども一覧取得（親ユーザー配下）
   * - ご褒美の「対象子ども選択肢」および「一覧の子ども名表示」に利用
   */
  const fetchChildren = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    const { data: rows, error } = await supabase
      .from("children")
      .select("id, name")
      .eq("user_id", data.user.id)
      .order("created_at", { ascending: true });

    if (error) {
      alert("子ども一覧の取得に失敗しました");
      return;
    }

    setChildren((rows ?? []) as Child[]);
  };

  /**
   * ご褒美一覧取得（親ユーザー配下）
   * - 表示/非表示も含め、全件取得して一覧で管理
   */
  const fetchRewards = async () => {
    setLoading(true);

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setLoading(false);
      return;
    }

    const { data: rows, error } = await supabase
      .from("rewards")
      .select("*")
      .eq("parent_id", data.user.id)
      .order("created_at", { ascending: false });

    if (error) {
      alert("ご褒美の取得に失敗しました");
      setLoading(false);
      return;
    }

    setRewards((rows ?? []) as Reward[]);
    setLoading(false);
  };

  /**
   * 初回マウント時に子ども/ご褒美を取得
   * - eslint-disable は「依存関係より、初回のみ実行」を優先するための割り切り
   */
  useEffect(() => {
    fetchChildren();
    fetchRewards();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -----------------------
  // 表示用（絞り込み）
  // -----------------------

  /**
   * 子ども切替に応じた表示対象
   * - "all" の場合は全件
   * - それ以外は child_id で絞り込み
   * - child_id が null の過去データが混ざっても落ちないようにガードしている
   */
  const visibleRewards = useMemo(() => {
    if (selectedChildId === "all") return rewards;
    return rewards.filter((r) => r.child_id === selectedChildId);
  }, [rewards, selectedChildId]);

  /**
   * 画像選択のクリア
   * - preview の ObjectURL は revoke してメモリリークを防ぐ
   */
  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
  };

  /**
   * ファイル選択時（新規作成モーダル）
   * - 未選択の場合はクリア扱い
   * - 選択した場合は preview を生成して即表示
   */
  const onPickFile: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) {
      clearImage();
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  /**
   * 画像アップロード（新規作成用）
   * - file がある場合のみ Storage へアップロードし publicUrl を返す
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

    if (error) {
      alert(`画像アップロードに失敗しました\n${error.message}`);
      return null;
    }

    return supabase.storage.from("reward_images").getPublicUrl(path).data.publicUrl;
  };

  /**
   * 新規作成モーダルを開く
   * - 一覧で特定の子どもを選択中なら、その子をデフォルト選択にする（UX改善）
   */
  const openCreateModal = () => {
    setTargetChildId(selectedChildId === "all" ? "" : selectedChildId);
    setOpened(true);
  };

  /**
   * ご褒美の新規作成
   * - 必須入力を満たしているかチェック
   * - 画像は任意：あればアップロードして URL を保存
   * - 登録後はフォームをリセットし、一覧を再取得して最新化
   */
  const createReward = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;

    if (!targetChildId) {
      alert("対象の子どもを選択してください");
      return;
    }
    if (!title.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    if (points === "") {
      alert("必要ポイントを入力してください");
      return;
    }

    const imageUrl = await uploadImage(data.user.id);

    const { error } = await supabase.from("rewards").insert({
      parent_id: data.user.id,
      child_id: targetChildId,
      title,
      description,
      required_points: points,
      image_url: imageUrl,
    });

    if (error) {
      alert(`ご褒美の登録に失敗しました\n${error.message}`);
      return;
    }

    // 登録後：UI 状態をリセット
    setOpened(false);
    setTitle("");
    setDescription("");
    setPoints(10);
    setTargetChildId("");
    clearImage();

    // 一覧を最新化
    fetchRewards();
  };

  /**
   * 表示/非表示の切替（is_active）
   * - 一覧で ON/OFF を操作しやすくする
   * - 更新後は一覧を再取得して最新状態にする
   */
  const toggleActive = async (reward: Reward) => {
    const { error } = await supabase
      .from("rewards")
      .update({ is_active: !reward.is_active })
      .eq("id", reward.id);

    if (error) {
      alert(`更新に失敗しました\n${error.message}`);
      return;
    }

    fetchRewards();
  };

  // Select 用オプション
  const whoOptions = children.map((c) => ({ value: c.id, label: c.name }));

  // 新規登録ボタンの活性条件（簡易バリデーション）
  const canSubmit =
    Boolean(targetChildId) && title.trim().length > 0 && points !== "";

  return (
    <>
      <Container size="sm" py={24}>
        <Group justify="space-between" mb="xs">
          <Text size="xl" fw={700} c="var(--oyako-text)">
            🎁 ご褒美カタログ
          </Text>

          {/* 新規作成導線（モーダルを開く） */}
          <Button
            onClick={openCreateModal}
            style={{ background: "var(--oyako-accent)" }}
            size="sm"
          >
            ＋ 新規ご褒美
          </Button>
        </Group>

        {/* 子ども切替（親は all も可） */}
        <Center mt="md" mb="lg">
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
        ) : visibleRewards.length === 0 ? (
          // 空状態
          <Text c="dimmed" mt="md">
            ご褒美がありません。
          </Text>
        ) : (
          // 一覧表示
          <Stack>
            {visibleRewards.map((r) => {
              // 子ども名の表示（child_id が null の可能性に備えてガード）
              const childName = r.child_id ? childrenMap[r.child_id] : "未設定";

              return (
                <Card
                  key={String(r.id)}
                  withBorder
                  shadow="sm"
                  p="md"
                  style={{
                    background: "var(--oyako-card)",
                    borderColor: "var(--oyako-border)",
                    // 非表示は薄くして区別（閲覧性/状態の明確化）
                    opacity: r.is_active ? 1 : 0.6,
                  }}
                >
                  <Group justify="space-between" align="flex-start" wrap="nowrap">
                    <Group align="flex-start" wrap="nowrap" gap="md">
                      <Box w={180}>
                        {r.image_url ? (
                          <Image src={r.image_url} h={110} radius="md" />
                        ) : (
                          // 画像未設定時のフォールバック
                          <Box
                            h={110}
                            style={{
                              borderRadius: 12,
                              background: "#e9ecef",
                              display: "grid",
                              placeItems: "center",
                              color: "#868e96",
                              fontWeight: 700,
                            }}
                          >
                            No Image
                          </Box>
                        )}
                      </Box>

                      <div>
                        <Text fw={700} c="var(--oyako-text)">
                          {r.title}
                        </Text>

                        <Group mt={4} gap={8}>
                          <Badge size="sm" variant="light">
                            {r.required_points}pt
                          </Badge>

                          <Badge
                            size="sm"
                            color={r.is_active ? "green" : "gray"}
                            variant="light"
                          >
                            {r.is_active ? "表示中" : "非表示"}
                          </Badge>

                          {/* 子ども名バッジ（親が対象を把握しやすい） */}
                          <Badge size="sm" variant="light">
                            {childName}
                          </Badge>
                        </Group>

                        {r.description && (
                          <Text size="sm" c="dimmed" mt="xs" lineClamp={2}>
                            {r.description}
                          </Text>
                        )}

                        {/* 一覧上で表示/非表示を切り替えられる */}
                        <Group mt="sm">
                          <Switch
                            checked={r.is_active}
                            onChange={() => toggleActive(r)}
                            size="sm"
                            label={r.is_active ? "表示中" : "非表示"}
                          />
                        </Group>
                      </div>
                    </Group>

                    {/* 編集ページへの導線 */}
                    <Button
                      variant="light"
                      size="xs"
                      onClick={() => router.push(`/parent/rewards/${r.id}`)}
                      style={{
                        color: "var(--oyako-text)",
                        borderColor: "var(--oyako-accent)",
                        flexShrink: 0,
                      }}
                    >
                      編集
                    </Button>
                  </Group>
                </Card>
              );
            })}
          </Stack>
        )}
      </Container>

      {/* 新規追加モーダル */}
      <Modal opened={opened} onClose={() => setOpened(false)} title="ご褒美を追加">
        <Stack>
          <Select
            label="対象の子ども"
            data={whoOptions}
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

          {/* 画像アップロード（任意）：
              input を hidden にして label(Box) で押しやすいUIにする */}
          <div>
            <Text size="sm" fw={500} mb={6}>
              画像（任意）
            </Text>

            <input
              id={inputId}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              onChange={onPickFile}
            />

            <Box
              component="label"
              htmlFor={inputId}
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
              {!preview ? (
                <Stack align="center" gap={6}>
                  <Text size="44px" fw={800} c="dimmed">
                    ＋
                  </Text>
                  <Text size="sm" c="dimmed">
                    ファイルの選択
                  </Text>
                  <Text size="xs" c="dimmed">
                    JPG / PNG / WEBP
                  </Text>
                </Stack>
              ) : (
                <Stack gap="xs">
                  <Image src={preview} h={160} radius="md" />
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">
                      選択中：{file?.name ?? "-"}
                    </Text>
                    <Button
                      size="xs"
                      variant="subtle"
                      onClick={(e) => {
                        e.preventDefault();
                        clearImage();
                      }}
                    >
                      クリア
                    </Button>
                  </Group>
                </Stack>
              )}
            </Box>
          </div>

          {/* 必須入力を満たすまで無効化（誤登録防止） */}
          <Button fullWidth mt="xs" onClick={createReward} disabled={!canSubmit}>
            登録
          </Button>
        </Stack>
      </Modal>
    </>
  );
}
