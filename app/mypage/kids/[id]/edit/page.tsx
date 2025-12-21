'use client';

import { use } from 'react'; // Next.js の仕様上、params が Promise のため use() で解決する
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import {
  Text,
  TextInput,
  Button,
  Card,
  Stack,
  Container,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * 子ども情報 編集ページ
 * - 子どもの名前・学年を編集、または削除できる
 * - params は Promise で渡されるため use() を使って解決する（Next.js の仕様対応）
 * - 初期表示時は URL クエリから値を補完し、画面遷移時の体験を向上させている
 */
export default function ChildEditPage(props: {
  params: Promise<{ id: string }>;
}) {
  /**
   * Next.js の仕様：
   * - App Router では params が Promise になるため、
   *   use() を使って同期的に値を取り出す必要がある
   */
  const { id: childId } = use(props.params);

  const router = useRouter();
  const searchParams = useSearchParams();

  /**
   * URL クエリから初期値を取得
   * - 一覧 → 編集画面への遷移時に再フェッチせず即表示するため
   * - ?name=〇〇&grade=〇〇 の形式を想定
   */
  const [name, setName] = useState(searchParams.get('name') ?? '');
  const [grade, setGrade] = useState(searchParams.get('grade') ?? '');

  // 保存・削除中の二重操作防止用フラグ
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  /**
   * 子ども情報の保存処理
   * - name / grade を更新
   * - grade は未入力時に null を保存（DB側の型を考慮）
   */
  const handleSave = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('children')
      .update({
        name,
        grade: grade || null,
      })
      .eq('id', childId);

    if (error) {
      console.error(error);
      notifications.show({
        title: '保存に失敗しました',
        message: '子どもの情報を更新できませんでした。',
        color: 'red',
      });
    } else {
      notifications.show({
        title: '保存しました',
        message: '子どもの情報を更新しました 🎉',
        color: 'green',
      });

      // 保存完了後は一覧（マイページ）へ戻す
      router.push('/mypage');
    }

    setSaving(false);
  };

  /**
   * 子ども情報の削除処理
   * - 指定した childId を物理削除
   * - 成功後は一覧ページへ遷移
   */
  const handleDelete = async () => {
    setDeleting(true);

    const { error } = await supabase
      .from('children')
      .delete()
      .eq('id', childId);

    if (error) {
      console.error(error);
      notifications.show({
        title: '削除に失敗しました',
        message: '子ども情報を削除できませんでした。',
        color: 'red',
      });
    } else {
      notifications.show({
        title: '削除しました',
        message: '子ども情報を削除しました。',
        color: 'green',
      });

      router.push('/mypage');
    }

    setDeleting(false);
  };

  return (
    <Container size="sm" py={24}>
      <Text size="xl" fw={700} mb="sm">
        子ども編集
      </Text>

      <Card
        withBorder
        shadow="sm"
        p="md"
        style={{ background: 'var(--oyako-card)' }}
      >
        <Stack gap="sm">
          <TextInput
            label="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <TextInput
            label="学年（任意）"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
          />

          {/* 保存処理：二重送信防止のため loading を制御 */}
          <Button
            onClick={handleSave}
            loading={saving}
            style={{ background: 'var(--oyako-accent)' }}
          >
            保存
          </Button>

          {/* 削除は危険操作のため色とスタイルで明確に区別 */}
          <Button
            color="red"
            variant="light"
            onClick={handleDelete}
            loading={deleting}
          >
            削除
          </Button>
        </Stack>
      </Card>
    </Container>
  );
}
