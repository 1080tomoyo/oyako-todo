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

/**
 * 子ども 1人分（表示に必要な最小項目）
 */
type Child = {
  id: string;
  name: string;
  points: number;
};

/**
 * ごほうび 1件分（表示に必要な項目）
 * - child_id は「子ども専用」の紐づけに使用（共通ごほうびは使わない方針）
 */
type Reward = {
  id: number;
  parent_id: string;
  title: string;
  description: string | null;
  required_points: number;
  image_url: string | null;
  is_active: boolean;
  child_id: string | null;
};

/**
 * 子ども用 ごほうび一覧ページ
 * - 子どもを切り替えながら、現在ポイントと「交換できる/できない」を確認できる
 * - 交換リクエストは pending で登録（親が承認する運用）
 * - ローディング / 空状態 / 一覧表示を明確に分岐
 */
export default function ChildRewardsPage() {
  // 初期データ取得中の表示制御
  const [loading, setLoading] = useState(true);

  // ログイン中の親に紐づく子ども一覧
  const [children, setChildren] = useState<Child[]>([]);

  // 現在選択されている子どもID（未選択の場合は ""）
  const [selectedChildId, setSelectedChildId] = useState<string>("");

  // 表示対象のごほうび一覧（親配下の有効なもの）
  const [rewards, setRewards] = useState<Reward[]>([]);

  // 子どもID -> 現在ポイント（表示用に即参照できるよう map 化）
  const [pointsMap, setPointsMap] = useState<Record<string, number>>({});

  /**
   * 選択中の子どもの現在ポイント
   * - 未選択時は 0 とする
   */
  const currentPoints = useMemo(() => {
    if (!selectedChildId) return 0;
    return pointsMap[selectedChildId] ?? 0;
  }, [pointsMap, selectedChildId]);

  /**
   * 選択中の子どもに紐づくごほうびのみを表示
   * ※ 共通ごほうび（child_id=null）はこのアプリでは利用しない方針
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
        error: userErr,
      } = await supabase.auth.getUser();

      // 未ログイン時は保護ページ想定のため、空で終了
      if (userErr || !user) {
        setChildren([]);
        setRewards([]);
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

      // 取得失敗時は安全側に倒す
      if (childErr) {
        alert("こどもの じょうほうが とれなかったよ");
        setLoading(false);
        return;
      }

      const list = (childrenData ?? []) as Child[];
      setChildren(list);

      // 子ども未登録時：選択IDが localStorage に残って混乱するためリセットする
      if (list.length === 0) {
        setSelectedChildId("");
        setPointsMap({});
        setRewards([]);
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

      // 有効なごほうびのみを取得（親配下のみ）
      const { data: rewardsData, error: rewardsErr } = await supabase
        .from("rewards")
        .select("*")
        .eq("parent_id", user.id)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      // 取得失敗時は空表示にする
      if (rewardsErr) {
        alert("ごほうびが とれなかったよ");
        setRewards([]);
        setLoading(false);
        return;
      }

      setRewards((rewardsData ?? []) as Reward[]);
      setLoading(false);
    };

    // 初回マウント時のみ取得
    load();
  }, []);

  /**
   * ごほうび交換処理
   * - 子ども未選択 / ポイント不足時は事前にガード
   * - 交換は pending で登録（親が承認する運用）
   */
  const exchangeReward = async (reward: Reward) => {
    // 子ども未選択の場合は先に選択を促す
    if (!selectedChildId) {
      notifications.show({
        message: "だれの がめんにする？ えらんでね",
        color: "yellow",
      });
      return;
    }

    // ポイント不足時は交換不可
    const current = pointsMap[selectedChildId] ?? 0;
    if (current < reward.required_points) {
      notifications.show({
        message: "ぽいんとが たりないよ",
        color: "yellow",
      });
      return;
    }

    // 交換リクエストを登録（pending）
    const { error } = await supabase.from("reward_redemptions").insert({
      child_id: selectedChildId,
      reward_id: reward.id,
      status: "pending",
    });

    if (error) {
      alert("こうかんに しっぱいしたよ");
      return;
    }

    // 成功通知（ポイント減算は親承認後に行う想定）
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
          {visibleRewards.map((r) => {
            // 現在ポイントで交換可能かどうか
            const canExchange =
              (pointsMap[selectedChildId] ?? 0) >= r.required_points;

            // 交換に必要な残りポイント（表示用）
            const remain = Math.max(
              0,
              r.required_points - (pointsMap[selectedChildId] ?? 0)
            );

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

                        <Badge
                          color={canExchange ? "green" : "gray"}
                          variant="light"
                        >
                          {canExchange
                            ? "こうかん できる！"
                            : `あと ${remain} ぽいんと`}
                        </Badge>
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

          {/* 空状態（子ども未選択 / ごほうび未登録） */}
          {visibleRewards.length === 0 && (
            <Card withBorder shadow="sm" p="md">
              <Text c="dimmed">
                {!selectedChildId
                  ? "まずは「マイページ」で子どもを登録してください。"
                  : "ごほうびが ないよ"}
              </Text>
            </Card>
          )}
        </Stack>
      )}
    </Container>
  );
}
