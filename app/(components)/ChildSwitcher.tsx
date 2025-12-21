"use client";

import { useEffect, useMemo, useState } from "react";
import { Group, SegmentedControl, Skeleton } from "@mantine/core";
import { supabase } from "@/lib/supabaseClient";

type Child = { id: string; name: string };

type Props = {
  // 選択状態を localStorage に永続化するためのキー（画面/用途ごとに切り替え可能）
  storageKey: string;
  // 「全員」を選択肢として含めるか
  includeAll?: boolean;
  // 「全員」選択時に扱う値（デフォルト: "all"）
  allValue?: string;
  // 選択変更を親コンポーネントへ通知（初期値確定時にも呼ぶ）
  onChange?: (childIdOrAll: string) => void;
};

/**
 * 子ども切り替え UI（SegmentedControl）
 * - children テーブルから子ども一覧を取得して表示
 * - 直近の選択状態を localStorage に保存し、次回表示時に復元
 * - includeAll=true の場合は「全員」タブも提供
 */
export default function ChildSwitcher({
  storageKey,
  includeAll = false,
  allValue = "all",
  onChange,
}: Props) {
  // 一覧取得中の表示制御（Skeletonを出す）
  const [loading, setLoading] = useState(true);

  // children テーブルから取得した子ども一覧
  const [children, setChildren] = useState<Child[]>([]);

  // 現在の選択値（child id / または allValue）
  const [value, setValue] = useState<string>("");

  useEffect(() => {
    // 非同期処理中にアンマウントされた場合の setState を防ぐためのフラグ
    let alive = true;

    (async () => {
      setLoading(true);

      // 子ども一覧を作成順で取得（表示順を安定させるため）
      const { data, error } = await supabase
        .from("children")
        .select("id,name")
        .order("created_at", { ascending: true });

      // 画面遷移等で既にアンマウントされていれば何もしない
      if (!alive) return;

      // 取得失敗時は安全側に倒して空配列扱い（UIは非表示になる）
      if (error) {
        console.error(error);
        setChildren([]);
        setLoading(false);
        return;
      }

      const list = (data ?? []) as Child[];
      setChildren(list);

      // クライアント実行前提だが、念のためSSR環境では localStorage 参照を避ける
      const saved =
        typeof window !== "undefined" ? localStorage.getItem(storageKey) : null;

      // 初期選択値の決定ルール：
      // 1) localStorage に保存値があり、かつ有効（includeAll=false なら allValue は無効）ならそれを採用
      // 2) includeAll=true の場合はデフォルトで「全員」
      // 3) それ以外は先頭の子どもを選択（未取得なら空文字）
      const next =
        saved && (includeAll ? true : saved !== allValue)
          ? saved
          : includeAll
            ? allValue
            : list[0]?.id ?? "";

      // UI表示の選択状態を反映し、親へも同じ値を通知（初期表示時の同期用）
      setValue(next);
      setLoading(false);

      onChange?.(next);
    })();

    return () => {
      alive = false;
    };
    // storageKey / includeAll / allValue が変わった場合は「初期選択ルール」を再計算するため再取得する
  }, [storageKey, includeAll, allValue]);

  const data = useMemo(() => {
    // SegmentedControl 用の表示データに変換（ラベル=名前、value=id）
    const base = children.map((c) => ({ label: c.name, value: c.id }));
    // includeAll=true の場合のみ「全員」を先頭に追加
    return includeAll ? [{ label: "全員", value: allValue }, ...base] : base;
    // children / includeAll / allValue に依存する派生データのため useMemo で不要な再計算を抑える
  }, [children, includeAll, allValue]);

  // ローディング中はコンポーネントのレイアウトを崩さないよう Skeleton を表示
  if (loading) {
    return (
      <Group mt="xs">
        <Skeleton height={36} width={260} radius="xl" />
      </Group>
    );
  }

  // 子どもが0人で「全員」も出さない場合は表示しない
  if (data.length === 0) return null;

  return (
    <Group mt="xs">
      <SegmentedControl
        value={value}
        onChange={(v) => {
          // 選択状態の更新は「UI反映 → 永続化 → 親通知」の順に揃える
          setValue(v);
          localStorage.setItem(storageKey, v);
          onChange?.(v);
        }}
        data={data}
        radius="xl"
      />
    </Group>
  );
}
