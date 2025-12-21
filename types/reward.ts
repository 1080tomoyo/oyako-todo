/**
 * rewards テーブルの1行を表す型
 * - Supabase の select 結果（JSON）をそのまま受ける前提のため、
 *   created_at は string（ISO文字列）として扱う
 * - child_id は「対象の子ども」を表し、未設定の可能性があるため null を許容
 */
export type Reward = {
  id: number;
  parent_id: string;
  title: string;
  description: string | null;
  required_points: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  child_id: string | null;
};

/**
 * ご褒美申請の状態
 * - 取りうる値を union で閉じることで、if/switch の抜け漏れを防ぐ
 * - DB 側の CHECK 制約 / enum 的運用と合わせる想定
 */
export type RewardRedemptionStatus = "pending" | "approved" | "rejected";

/**
 * reward_redemptions テーブルの1行を表す型
 * - requested_at / handled_at は string（ISO文字列）として扱う
 * - handled_by / handled_at は未処理（pending）の場合に null になり得る
 */
export type RewardRedemption = {
  id: number;
  child_id: string;
  reward_id: number;
  status: RewardRedemptionStatus;
  requested_at: string;
  handled_by: string | null;
  handled_at: string | null;
};

/**
 * Supabase の join 結果（reward_redemptions + rewards）を表す型
 * - select('*, rewards(*)') のようなクエリ結果を想定
 * - redemption 本体に rewards がネストして返る形に合わせる
 */
export type RewardRedemptionWithReward = RewardRedemption & {
  rewards: Reward;
};
