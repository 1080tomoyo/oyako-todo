"use client";

import { supabase } from "@/lib/supabaseClient";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * ログアウト専用ページ
 * - アクセスされた時点で自動的にログアウト処理を実行する
 * - UI 操作を必要とせず、リンク遷移だけでログアウトできる構成
 * - 処理完了後はサインイン画面へリダイレクトする
 */
export default function SignOutPage() {
  const router = useRouter();

  useEffect(() => {
    /**
     * ログアウト処理
     * - Supabase Auth のセッションを破棄
     * - 完了後に /signin へ遷移する
     *
     * ※ useEffect 内で実行することで、
     *    ページマウント = ログアウト実行、という単純な責務にしている
     */
    const logout = async () => {
      await supabase.auth.signOut();
      router.push("/signin");
    };

    logout();
  }, [router]);

  // ログアウト処理中の簡易表示（一瞬表示される想定）
  return <p>ログアウト中...</p>;
}
