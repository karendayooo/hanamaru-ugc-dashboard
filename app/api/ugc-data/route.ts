import { NextResponse } from 'next/server';
import Papa from 'papaparse';

/**
 * Google Sheets API制限事項:
 * - 読み取り制限: 1分あたり100リクエスト（プロジェクト全体）
 * - 1日あたり: 無制限（公開スプレッドシートの場合）
 * - 推奨: キャッシュを活用し、頻繁な更新は避ける
 * 
 * 各プラットフォームの取得件数制限:
 * - YouTube: 最新10件
 * - Instagram: 最新10件
 * - Twitter/X: 最新10件
 */

const ITEMS_PER_PLATFORM = 10; // 各プラットフォームから取得する件数

export async function GET() {
  try {
    const spreadsheetId = '1Mwlw2dKBIchpZ2WEQtsyu-NjEQZDdr_HNhXCbHv4UZg';
    
    // 3つのシートからデータを取得
    const sheets = [
      { name: 'YouTube投稿データ', platform: 'YouTube' },
      { name: 'X投稿データ', platform: 'Twitter' },
      { name: 'Instagram投稿データ', platform: 'Instagram' }
    ];
    
    const allData: any[] = [];
    
    for (const sheet of sheets) {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheet.name)}`;
      
      console.log(`\n=== Fetching ${sheet.name} ===`);
      
      const response = await fetch(csvUrl, {
        cache: 'no-store',
      });
      
      if (!response.ok) {
        console.error(`Failed to fetch ${sheet.name}: ${response.status}`);
        continue;
      }
      
      const csvText = await response.text();
      
      const parsed = Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (header) => header.trim(),
      });
      
      console.log(`${sheet.name} 全データ件数:`, parsed.data.length);
      
      // 最初の1件のデータ構造を確認
      if (parsed.data.length > 0) {
        const firstRow = parsed.data[0] as any;
        console.log(`${sheet.name} 列名:`, Object.keys(firstRow));
        console.log(`${sheet.name} サンプルデータ:`, firstRow);
      }
      
      // 日付フィールドを探す
      const dateFields = ['PublishedAt', 'PostedAt', 'CreatedAt', 'Date', 'Timestamp', '投稿日時'];
      let dateField: string | null = null;
      
      if (parsed.data.length > 0) {
        const firstRow = parsed.data[0] as any;
        for (const field of dateFields) {
          if (firstRow.hasOwnProperty(field)) {
            dateField = field;
            console.log(`${sheet.name} 使用する日付フィールド:`, dateField);
            break;
          }
        }
      }
      
      if (!dateField) {
        console.warn(`${sheet.name} 日付フィールドが見つかりません。全データを取得します。`);
        // 日付フィールドがない場合は最初の10件を取得
        const limitedData = parsed.data.slice(0, ITEMS_PER_PLATFORM);
        const dataWithPlatform = limitedData.map((row: any) => ({
          ...row,
          platform: sheet.platform
        }));
        allData.push(...dataWithPlatform);
        console.log(`${sheet.name} 取得件数:`, dataWithPlatform.length);
        continue;
      }
      
      // 日付でソートして最新のものを取得
      const sortedData = (parsed.data as any[])
        .filter((row: any) => row[dateField]) // 日付があるものだけ
        .sort((a: any, b: any) => {
          const dateA = new Date(a[dateField]);
          const dateB = new Date(b[dateField]);
          return dateB.getTime() - dateA.getTime(); // 新しい順
        })
        .slice(0, ITEMS_PER_PLATFORM); // 最新10件のみ
      
      console.log(`${sheet.name} 取得件数:`, sortedData.length);
      
      // プラットフォーム情報を追加
      const dataWithPlatform = sortedData.map((row: any) => ({
        ...row,
        platform: sheet.platform
      }));
      
      allData.push(...dataWithPlatform);
    }

    console.log('\n=== Total data count:', allData.length, '===\n');

    return NextResponse.json({ 
      data: allData,
      success: true,
      count: allData.length,
      limits: {
        itemsPerPlatform: ITEMS_PER_PLATFORM,
        totalItems: allData.length,
        note: 'Google Sheets APIは1分あたり100リクエストまで。頻繁な更新は避けてください。'
      }
    });
  } catch (error: any) {
    console.error('Error fetching data:', error);
    return NextResponse.json({ 
      error: error.message,
      success: false 
    }, { status: 500 });
  }
}
