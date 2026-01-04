"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { TextInput, Button, Group, Text, Stack, Anchor } from "@mantine/core";

type Props = {
  /**
   * middleware から渡される想定: /signin?redirectTo=/child
   * - 未指定の場合は null
   */
  redirectTo: string | null;
};

/**
 * 親ユーザー用 ログイン / 新規登録ページ（Client Component）
 * - 1画面で「ログイン」「新規登録」を切り替える
 * - 認証後に profiles を upsert し、アプリ内表示名（display_name）を保存する
 * - 認証完了後は redirectTo があればそこへ、なければ /mypage へ遷移する
 */
export default function SigninClient({ redirectTo }: Props) {
  const router = useRouter();

  /**
   * 認証後の遷移先
   * - open redirect 対策として、内部パス（/ から始まる）以外は弾く
   * - 不正/未指定の場合はマイページへ
   */
  const nextPath =
    redirectTo && redirectTo.startsWith("/") && !redirectTo.startsWith("//")
      ? redirectTo
      : "/mypage";

  // 画面モード：login / signup
  const [mode, setMode] = useState<"login" | "signup">("login");

  // 入力フォーム状態
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // signup 時のみ使用する表示名（profiles.display_name に保存）
  const [displayName, setDisplayName] = useState("");

  // 送信中の二重操作防止 / エラー表示
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  /**
   * Supabase Auth の英語エラーメッセージを日本語に変換する
   * - 生の error.message をそのまま表示しない（UXを日本語で統一）
   */
  const toJaAuthErrorMessage = (message: string) => {
    if (message.includes("Password should be at least")) {
      return "パスワードは6文字以上で入力してください。";
    }
    if (message.includes("Invalid login credentials")) {
      return "メールアドレスまたはパスワードが正しくありません。";
    }
    if (message.includes("User already registered")) {
      return "このメールアドレスはすでに登録されています。";
    }
    if (message.includes("Email rate limit exceeded")) {
      return "短時間にリクエストが多すぎます。しばらく待ってから再度お試しください。";
    }
    // 最後のフォールバック（英語を出さない）
    return "エラーが発生しました。入力内容をご確認のうえ、もう一度お試しください。";
  };

  /**
   * profiles の存在保証（表示名の補完）
   * - Auth の user とは別に、アプリ内で使う display_name を profiles に保存しておく
   * - displayName → user_metadata → email → "ママ" の順でフォールバックする
   * - upsert を使い「未作成なら作成 / 既存なら更新」を1本化する
   */
  const ensureProfile = async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return;

    const user = data.user;
    const name =
      displayName || user.user_metadata?.display_name || user.email || "ママ";

    await supabase.from("profiles").upsert({
      id: user.id,
      display_name: name,
    });
  };

  /**
   * 新規登録（Supabase Auth）
   * - signUp 時に user_metadata に display_name を保存
   * - 登録後は profiles も upsert して、アプリ内表示に備える
   */
  const handleSignup = async () => {
    setErrorMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            display_name: displayName,
          },
        },
      });

      if (error) {
        setErrorMessage(toJaAuthErrorMessage(error.message));
        return;
      }

      await ensureProfile();

      // 認証完了後は redirectTo があればそこへ、なければマイページへ
      router.replace(nextPath);
    } finally {
      setLoading(false);
    }
  };

  /**
   * ログイン（Supabase Auth）
   * - signInWithPassword でログイン
   * - 念のため profiles を ensure（表示名の登録漏れや更新を吸収）
   */
  const handleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(toJaAuthErrorMessage(error.message));
        return;
      }

      await ensureProfile();

      // 認証完了後は redirectTo があればそこへ、なければマイページへ
      router.replace(nextPath);
    } finally {
      setLoading(false);
    }
  };

  /**
   * フォーム送信ハンドラ
   * - mode に応じて login / signup を切り替える
   * - preventDefault でページリロードを抑止する
   */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (mode === "signup") {
      await handleSignup();
    } else {
      await handleLogin();
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "40px auto", padding: 16 }}>
      {/* ページタイトル */}
      <Text size="xl" fw={700} mb="md" ta="center">
        親子TODOログイン
      </Text>

      <form onSubmit={onSubmit}>
        <Stack gap="sm">
          <TextInput
            label="メールアドレス"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <TextInput
            label="パスワード"
            type="password"
            placeholder="6文字以上"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* signup のときだけ表示名を入力させる */}
          {mode === "signup" && (
            <TextInput
              label="表示名（ニックネーム）"
              placeholder="例：◯◯ママ"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          )}

          {/* 認証エラーの表示（日本語に整形したメッセージを表示） */}
          {errorMessage && (
            <Text c="red" size="sm">
              {errorMessage}
            </Text>
          )}

          {/* 送信ボタン：送信中は loading 表示で二重送信を抑止 */}
          <Button type="submit" loading={loading}>
            {mode === "signup" ? "新規登録して始める" : "ログイン"}
          </Button>
        </Stack>
      </form>

      {/* モード切替リンク：画面内で login/signup を切り替える */}
      <Group justify="center" mt="md">
        {mode === "signup" ? (
          <Text size="sm">
            すでにアカウントをお持ちの方は{" "}
            <Anchor
              component="button"
              type="button"
              onClick={() => setMode("login")}
            >
              ログインへ
            </Anchor>
          </Text>
        ) : (
          <Text size="sm">
            初めての方は{" "}
            <Anchor
              component="button"
              type="button"
              onClick={() => setMode("signup")}
            >
              新規登録
            </Anchor>
          </Text>
        )}
      </Group>
    </main>
  );
}
