import { createClient } from '@supabase/supabase-js';

/**
 * Supabase クライアント（ブラウザ用）
 *
 * - NEXT_PUBLIC_ プレフィックス付きの環境変数を使用
 * - クライアントサイド（Browser / Client Component）から利用する前提
 * - anon key は RLS（Row Level Security）によって安全に制御される
 *
 * ※ サーバー専用キー（service_role）は
 *    絶対にフロントエンドでは使用しない
 */

// Supabase プロジェクトの URL
// NEXT_PUBLIC_ を付けることで、ビルド時にクライアントへ公開される
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

// Supabase の匿名キー（公開前提）
// RLS によってアクセス権限が制限されるため、
// クライアント利用でも安全に扱える
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabase クライアント生成
// このインスタンスをアプリ全体で使い回す
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
