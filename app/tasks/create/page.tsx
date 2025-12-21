'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Text,
  TextInput,
  Button,
  Select,
  NumberInput,
  Container,
  Card,
  Stack,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter } from 'next/navigation';

type ChildOption = {
  value: string;
  label: string;
};

/**
 * 親用：タスク作成ページ
 * - 親が子ども向けのタスク（やること）を新規登録する
 * - 子ども一覧を取得して Select の選択肢として表示する
 * - 保存時は tasks に insert し、成功トースト → 一覧へ遷移する
 */
export default function TaskCreatePage() {
  const router = useRouter();

  // 入力フォーム状態
  const [title, setTitle] = useState('');
  const [childId, setChildId] = useState<string | null>(null);

  /**
   * ポイントは number で保持する（型の一貫性）
   * - NumberInput は型が揺れる可能性があるため onChange 内で number 化して管理する
   */
  const [point, setPoint] = useState<number>(1);

  // カテゴリ（既定は study）
  const [category, setCategory] = useState<string | null>('study');

  // 子ども Select の選択肢（id→name を value/label に変換したもの）
  const [children, setChildren] = useState<ChildOption[]>([]);

  // 送信中の二重操作防止
  const [saving, setSaving] = useState(false);

  // ------------------------------
  // 子どもの一覧を取得
  // ------------------------------
  useEffect(() => {
    /**
     * 初回表示時に子ども一覧を取得
     * - 親ユーザーの user_id に紐づく children を取得する
     * - Select 用の { value, label } 形式に変換して保持する
     */
    const load = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('children')
        .select('id, name')
        .eq('user_id', user.id)
        .order('created_at', { ascending: true });

      setChildren(
        (data || []).map((c) => ({
          value: c.id,
          label: c.name,
        }))
      );
    };

    load();
  }, []);

  // ------------------------------
  // 作成ボタン
  // ------------------------------
  /**
   * 作成処理
   * - 必須入力（title / childId / category）を満たしている場合のみ insert
   * - 成功後はトースト表示 → タスク一覧へ遷移
   */
  const handleCreate = async () => {
    if (!title.trim() || !childId || !category) return;

    setSaving(true);

    // 親ユーザー（ログイン中ユーザー）を取得
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    // tasks に新規登録
    await supabase.from('tasks').insert([
      {
        user_id: user.id,
        child_id: childId,
        title,
        category,
        point,
      },
    ]);

    notifications.show({
      title: '作成しました',
      message: '新しいタスクが追加されました 🎉',
      color: 'var(--oyako-accent)',
    });

    // 作成後は一覧へ
    router.push('/tasks');

    setSaving(false);
  };

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={700} mb="lg" c="var(--oyako-text)">
        ➕ タスク作成
      </Text>

      {/* 入力フォーム（タスク編集と同じ Card UI に揃える） */}
      <Card
        withBorder
        shadow="sm"
        p="md"
        style={{
          background: 'var(--oyako-card)',
          borderColor: 'var(--oyako-border)',
        }}
      >
        <Stack gap="sm">
          <TextInput
            label="タイトル"
            placeholder="例：漢プリ5枚 / 床ふき8分"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <Select
            label="カテゴリ"
            data={[
              { value: 'study', label: '学習' },
              { value: 'chore', label: 'お手伝い' },
              { value: 'life', label: '生活' },
            ]}
            value={category}
            onChange={setCategory}
          />

          <Select
            label="対象の子ども"
            placeholder="選択してください"
            data={children}
            value={childId}
            onChange={setChildId}
          />

          <NumberInput
            label="ポイント"
            min={1}
            value={point}
            onChange={(value) => {
              /**
               * NumberInput は number / string / null になり得るため、
               * number に変換して state を一貫させる
               */
              const num = typeof value === 'number' ? value : Number(value);
              setPoint(Number.isNaN(num) ? 1 : num);
            }}
          />

          {/* 送信中は loading 表示で二重登録を防止 */}
          <Button
            onClick={handleCreate}
            loading={saving}
            style={{ background: 'var(--oyako-accent)' }}
          >
            作成する
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
