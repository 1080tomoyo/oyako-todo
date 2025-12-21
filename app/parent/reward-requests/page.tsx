'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Table, Button, Loader } from '@mantine/core';
import type { RewardRedemptionWithReward } from '@/types/reward';

/**
 * ご褒美申請一覧（簡易管理画面）
 * - pending 状態のご褒美申請を一覧表示
 * - 承認操作により、申請ステータス更新とポイント減算を行う
 * - UI / 処理ともにシンプルさを優先した実装（後続リファクタ前提）
 */
export default function RewardRequestsPage() {
  // pending の申請一覧
  const [list, setList] = useState<RewardRedemptionWithReward[]>([]);

  // 初期取得中の表示制御
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    /**
     * 初回表示時のデータ取得
     * - reward_redemptions を起点に rewards を JOIN して表示用データをまとめて取得
     * - status=pending のみを対象とする
     */
    const init = async () => {
      const { data } = await supabase
        .from('reward_redemptions')
        .select('*, rewards(*)')
        .eq('status', 'pending');

      setList((data || []) as RewardRedemptionWithReward[]);
      setLoading(false);
    };

    init();
  }, []);

  /**
   * 承認処理（簡易版）
   * - ① reward_redemptions の status を approved に更新
   * - ② 消費ポイントを point_transactions に記録
   * - ③ pending 一覧を再取得して画面を更新
   *
   * ※ 本来は RPC / トランザクションでまとめる想定だが、
   *    ここでは実装の分かりやすさを優先している
   */
  const approve = async (r: RewardRedemptionWithReward) => {
    // ① ステータス更新
    await supabase
      .from('reward_redemptions')
      .update({ status: 'approved' })
      .eq('id', r.id);

    // ② ポイント消費履歴を登録
    await supabase.from('point_transactions').insert({
      child_id: r.child_id,
      reward_redemption_id: r.id,
      type: 'spend',
      points: -r.rewards.required_points,
    });

    // ③ 再取得して一覧を最新状態にする
    const { data } = await supabase
      .from('reward_redemptions')
      .select('*, rewards(*)')
      .eq('status', 'pending');

    setList((data || []) as RewardRedemptionWithReward[]);
  };

  // 初期ロード中は Loader のみ表示
  if (loading) return <Loader />;

  return (
    <Table>
      <Table.Thead>
        <Table.Tr>
          <Table.Th>子</Table.Th>
          <Table.Th>ご褒美</Table.Th>
          <Table.Th>pt</Table.Th>
          <Table.Th />
        </Table.Tr>
      </Table.Thead>

      <Table.Tbody>
        {list.map((r) => (
          <Table.Tr key={r.id}>
            {/* 子どもIDは簡易的に先頭数文字のみ表示 */}
            <Table.Td>{r.child_id.slice(0, 6)}</Table.Td>
            <Table.Td>{r.rewards.title}</Table.Td>
            <Table.Td>{r.rewards.required_points}</Table.Td>
            <Table.Td>
              <Button size="xs" onClick={() => approve(r)}>
                承認
              </Button>
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
