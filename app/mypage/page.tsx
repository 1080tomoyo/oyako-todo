'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Text,
  TextInput,
  Button,
  Card,
  Stack,
  Container,
  Group,
  Loader,
  Badge,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import Link from 'next/link';

type Child = {
  id: string;
  name: string;
  grade: string | null;
};

type Profile = {
  display_name: string;
  email?: string | null;
};

/**
 * マイページ（親ユーザー用）
 * - 親のプロフィール情報を表示
 * - 子ども（タスク対象）を追加・一覧表示・編集画面へ遷移できる
 * - 取得処理は fetchChildren に集約し、「追加後の再取得」にも再利用する
 */
export default function MyPage() {
  // 親プロフィール（profiles + auth から補完）
  const [profile, setProfile] = useState<Profile | null>(null);

  // 親に紐づく子ども一覧
  const [children, setChildren] = useState<Child[]>([]);

  // 一覧取得中の表示制御（初回表示・再取得で使う）
  const [loading, setLoading] = useState(true);

  // 追加処理中の二重送信防止
  const [adding, setAdding] = useState(false);

  // 子ども追加フォーム入力値
  const [name, setName] = useState('');
  const [grade, setGrade] = useState('');

  /**
   * 子ども一覧（+ 親プロフィール）を取得する共通関数
   * - 追加後に一覧を再取得する用途もあるため useCallback で保持
   * - auth の user を起点に、profiles と children を取得
   */
  const fetchChildren = useCallback(async () => {
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    // 親プロフィール取得（表示名は profiles を優先し、なければ email 等から補完）
    const { data: profileData } = await supabase
      .from('profiles')
      .select('display_name')
      .eq('id', user.id)
      .maybeSingle();

    setProfile({
      display_name: profileData?.display_name ?? (user.email ?? 'ママ'),
      email: user.email,
    });

    // 子ども一覧取得（表示順を安定させるため created_at 昇順）
    const { data: childrenData } = await supabase
      .from('children')
      .select('id, name, grade')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true });

    setChildren((childrenData || []) as Child[]);
    setLoading(false);
  }, []);

  /**
   * 初回マウント時に一覧取得
   * - fetchChildren を依存に持つことで、関数が変わった場合も追従できる
   */
  useEffect(() => {
    (async () => {
      await fetchChildren();
    })();
  }, [fetchChildren]);

  /**
   * 子ども追加処理
   * - 未入力（空文字）を弾く
   * - grade は任意入力のため未入力時は null を保存
   * - 追加後は一覧を再取得して画面を最新状態にする
   */
  const handleAdd = async () => {
    if (!name.trim()) return;

    setAdding(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setAdding(false);
      return;
    }

    const { error } = await supabase.from('children').insert([
      {
        user_id: user.id,
        name,
        grade: grade || null,
        icon_color: '#FDB714',
      },
    ]);

    if (error) {
      console.error(error);
      notifications.show({
        title: '追加に失敗しました',
        message: '子どもの追加に失敗しました。',
        color: 'red',
      });
    } else {
      notifications.show({
        title: '追加しました',
        message: '子どもを登録しました 🎉',
        color: 'var(--oyako-accent)',
      });

      // フォームをリセットして、一覧を再取得
      setName('');
      setGrade('');
      await fetchChildren();
    }

    setAdding(false);
  };

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={700} mb="sm" c="var(--oyako-text)">
        👨‍👩‍👦 マイページ
      </Text>
      <Text size="sm" c="dimmed" mb="lg">
        親ユーザー情報と、タスクの対象になる子どもを管理します。
      </Text>

      {/* 親情報 */}
      <Card
        withBorder
        shadow="sm"
        mb="lg"
        p="md"
        style={{
          background: 'var(--oyako-card)',
          borderColor: 'var(--oyako-border)',
        }}
      >
        <Text fw={600} mb="xs">
          親ユーザー情報
        </Text>

        {/* profiles 取得前はプレースホルダ表示 */}
        {profile ? (
          <Stack gap={4}>
            <Text size="sm">表示名：{profile.display_name}</Text>
            {profile.email && (
              <Text size="sm" c="dimmed">
                メール：{profile.email}
              </Text>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">
            情報を取得中です…
          </Text>
        )}
      </Card>

      {/* 子ども追加フォーム */}
      <Card
        withBorder
        shadow="sm"
        mb="lg"
        p="md"
        style={{
          background: 'var(--oyako-card)',
          borderColor: 'var(--oyako-border)',
        }}
      >
        <Stack gap="sm">
          <Text fw={600}>子どもを追加</Text>
          <TextInput
            label="名前"
            placeholder="例：長男 / 次男 / ○○くん"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <TextInput
            label="学年（任意）"
            placeholder="例：小4 / 小1"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />
          {/* 二重送信防止のため loading を制御 */}
          <Button
            onClick={handleAdd}
            loading={adding}
            style={{ background: 'var(--oyako-accent)' }}
          >
            追加する
          </Button>
        </Stack>
      </Card>

      {/* 子ども一覧 */}
      <Text fw={600} mb="sm" c="var(--oyako-text)">
        登録済みの子ども
      </Text>

      {loading ? (
        // 初期取得 / 再取得中
        <Group justify="center" mt="md">
          <Loader />
        </Group>
      ) : children.length === 0 ? (
        // 空状態
        <Text size="sm" c="dimmed" mt="sm">
          まだ登録されていません。
        </Text>
      ) : (
        <Stack gap="sm" mt="sm">
          {children.map((child) => {
            /**
             * 編集画面の初期表示をスムーズにするため、一覧側でクエリを付与して渡す
             * - /mypage/kids/:id/edit?name=...&grade=...
             */
            const params = new URLSearchParams({
              name: child.name,
              grade: child.grade ?? '',
            });

            return (
              <Card
                key={child.id}
                withBorder
                shadow="sm"
                p="md"
                style={{
                  background: 'var(--oyako-card)',
                  borderColor: 'var(--oyako-border)',
                }}
              >
                <Group justify="space-between" align="center">
                  <div>
                    <Text fw={600}>{child.name}</Text>
                    {child.grade && (
                      <Text size="sm" c="dimmed">
                        学年：{child.grade}
                      </Text>
                    )}
                  </div>

                  {/* 編集導線：ボタンは 1 つに集約して迷わせない */}
                  <Button
                    component={Link}
                    href={`/mypage/kids/${child.id}/edit?${params.toString()}`}
                    size="xs"
                    variant="light"
                    style={{
                      borderColor: 'var(--oyako-accent)',
                      color: 'var(--oyako-text)',
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
  );
}
