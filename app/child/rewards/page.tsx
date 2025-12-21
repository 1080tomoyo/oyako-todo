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
  Box,
  Image,
} from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { supabase } from "@/lib/supabaseClient";
import ChildSwitcher from "@/app/(components)/ChildSwitcher";

type Child = {
  id: string;
  name: string;
  points: number;
};

type Reward = {
  id: number;
  parent_id: string;
  title: string;
  description: string | null;
  required_points: number;
  image_url: string | null;
  is_active: boolean;
  child_id?: string | null;
};

/**
 * 子ども用 ごほうび一覧ページ
 * - 子どもを切り替えながら、現在のポイントと交換可能なごほうびを確認できる
 * - ポイント不足時は交換不可とし、視覚的に状態を分かりやすく表示
 */
export default function ChildRewardsPage() {
  // 初期データ取得中の表示制御
  const [loading, setLoading] = useState(true);

  // ログイン中の親に紐づく子ども一覧
  const [children, setChildren] = useState<Child[]>([]);

  // 現在選択されている子どもID
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  // 表示対象のごほうび一覧
  const [rewards, setRewards] = useState<Reward[]>([]);

  // 子どもID -> 現在ポイント の参照用マップ
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});

  /**
   * 選択中の子どもの現在ポイント
   * - selectedChildId が未選択の場合は 0 とする
   */
  const currentPoints = useMemo(() => {
    if (!selectedChildId) return 0;
    return pointsMap[selectedChildId] ?? 0;
  }, [pointsMap, selectedChildId]);

  /**
   * 選択中の子どもに紐づくごほうびのみを抽出
   * - 子ども未選択時は空配列
   */
  const visibleRewards = useMemo(() => {
    if (!selectedChildId) return [];
    return rewards.filter((r) => r.child_id === selectedChildId);
  }, [rewards, selectedChildId]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // 現在ログインしている親ユーザーを取得
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // 子ども一覧を取得（ポイント含む）
      const { data: childrenData, error: childErr } = await supabase
        .from("children")
        .select("id, name, points")
        .eq("user_id", user.id);

      if (childErr) {
        alert("こどもの じょうほうが とれなかったよ");
        setLoading(false);
        return;
      }

      const list = (childrenData ?? []) as Child[];
      setChildren(list);

      // 子どもごとのポイントを即時参照できるよう map 化
      const pm: Record<string, number> = {};
      list.forEach((c) => (pm[c.id] = c.points ?? 0));
      setPointsMap(pm);

      // 有効なごほうびのみを取得（表示用）
      const { data: rewardsData, error: rewardsErr } = await supabase
        .from("rewards")
        .select("*")
        .eq("parent_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (rewardsErr) {
        alert("ごほうびが とれなかったよ");
        setLoading(false);
        return;
      }

      setRewards((rewardsData ?? []) as Reward[]);
      setLoading(false);
    };

    // 初回マウント時のみデータ取得
    load();
  }, []);

  /**
   * ごほうび交換処理
   * - 子ども未選択 / ポイント不足時は事前にガード
   * - 交換リクエストは pending 状態で登録
   */
  const exchangeReward = async (reward: Reward) => {
    if (!selectedChildId) {
      notifications.show({
        message: "だれの がめんにする？ えらんでね",
        color: "yellow",
      });
      return;
    }

    const current = pointsMap[selectedChildId] ?? 0;
    if (current < reward.required_points) {
      notifications.show({
        message: "ぽいんとが たりないよ",
        color: "yellow",
      });
      return;
    }

    const { error } = await supabase.from("reward_redemptions").insert({
      child_id: selectedChildId,
      reward_id: reward.id,
      status: "pending",
    });

    if (error) {
      alert("こうかんに しっぱいしたよ");
      return;
    }

    notifications.show({
      title: "こうかん したよ！",
      message: reward.title,
      color: "green",
    });
  };

  return (
    <Container size="sm" py={24}>
      <Center>
        <Text size="xl" fw={800} c="var(--oyako-text)">
          🎁 ごほうび
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

      {/* 現在のポイント表示 */}
      <Group justify="center" mt="lg">
        <Text fw={700} c="var(--oyako-text)">
          {!selectedChildId
            ? "だれの がめんにする？"
            : `いまの ぽいんと：${currentPoints} ぽいんと`}
        </Text>
      </Group>

      {loading ? (
        // 初期ロード中
        <Group justify="center" mt="md">
          <Loader />
        </Group>
      ) : (
        <Stack mt="md">
          {visibleRewards.map((r) => {
            // 現在のポイントで交換可能かどうか
            const canExchange =
              selectedChildId &&
              (pointsMap[selectedChildId] ?? 0) >= r.required_points;

            // 交換に必要な残りポイント
            const remain =
              selectedChildId
                ? Math.max(
                    0,
                    r.required_points -
                      (pointsMap[selectedChildId] ?? 0)
                  )
                : null;

            return (
              <Card key={String(r.id)} withBorder shadow="sm" p="md">
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Group align="flex-start" wrap="nowrap" gap="md">
                    <Box w={180}>
                      {r.image_url ? (
                        <Image src={r.image_url} h={110} radius="md" />
                      ) : (
                        // 画像未設定時のフォールバック表示
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

                    <Box>
                      <Text fw={800} size="lg" c="var(--oyako-text)">
                        {r.title}
                      </Text>

                      <Group gap="xs" mt={6}>
                        <Badge variant="light">
                          {r.required_points} ぽいんと
                        </Badge>

                        {selectedChildId && (
                          <Badge
                            color={canExchange ? "green" : "gray"}
                            variant="light"
                          >
                            {canExchange
                              ? "こうかん できる！"
                              : `あと ${remain} ぽいんと`}
                          </Badge>
                        )}
                      </Group>

                      {r.description && (
                        <Text size="sm" c="dimmed" mt="xs" lineClamp={2}>
                          {r.description}
                        </Text>
                      )}
                    </Box>
                  </Group>

                  {/* 交換可能時のみ有効化 */}
                  <Button
                    size="xs"
                    onClick={() => exchangeReward(r)}
                    disabled={!canExchange}
                    variant={canExchange ? "filled" : "light"}
                    style={{ flexShrink: 0 }}
                  >
                    こうかん する
                  </Button>
                </Group>
              </Card>
            );
          })}

          {/* ごほうびが存在しない場合の空状態 */}
          {visibleRewards.length === 0 && (
            <Card withBorder shadow="sm" p="md">
              <Text c="dimmed">
                {!selectedChildId
                  ? "だれの がめんにする？"
                  : "ごほうびが ないよ"}
              </Text>
            </Card>
          )}
        </Stack>
      )}
    </Container>
  );
}
