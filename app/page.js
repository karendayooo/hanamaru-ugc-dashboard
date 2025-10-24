'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

export default function Dashboard() {
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // 検索条件
  const [searchParams, setSearchParams] = useState({
    platform: 'すべて',
    startDate: '',
    endDate: '',
    keyword: '',
    menu: 'すべて'
  });

  // 統計情報
  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0
  });

  // グラフデータ
  const [chartData, setChartData] = useState({
    platformCounts: [],
    timeSeriesData: []
  });

  // ソート設定
  const [sortBy, setSortBy] = useState('date'); // date, likes, comments

  // 初回データ取得
  useEffect(() => {
    fetchAllData();
  }, []);

  // データ取得
  async function fetchAllData() {
    setLoading(true);
    try {
      const response = await fetch('/api/ugc-data');
      const result = await response.json();
      
      if (result.success && result.data) {
        const normalizedData = result.data.map(row => {
          let platformName = row.platform || row.Platform || '';
          if (platformName.toLowerCase() === 'youtube') platformName = 'YouTube';
          if (platformName.toLowerCase() === 'twitter' || platformName.toLowerCase() === 'x') platformName = 'Twitter';
          if (platformName.toLowerCase() === 'instagram') platformName = 'Instagram';
          
          return {
            platform: platformName,
            username: row.Channel || row.Username || row['ユーザー名'] || row.username || 'unknown',
            post_date: row.PublishedAt || row.PostedAt || row['投稿日時'] || row.post_date,
            content: row.Description || row.Text || row.Caption || row['本文'] || row.content || '',
            likes: parseInt(row.LikeCount || row.Likes || row['いいね数'] || row.likes || 0),
            comments: parseInt(row.CommentCount || row.Comments || row['返信数'] || row.comments || 0),
            shares: parseInt(row.RetweetCount || row.Shares || row['リツイート数'] || row.shares || 0),
            menu_keyword: row.Keyword || row['キーワード'] || row.menu_keyword || '',
            media_url: row.Thumbnail || row.MediaUrl || row.media_url || '',
            post_url: row.URL || row['パーマリンク'] || row.post_url || ''
          };
        });
        
        // キーワードがあるデータのみ
        const validData = normalizedData.filter(d => 
          d.menu_keyword && 
          d.menu_keyword.trim() !== '' &&
          d.menu_keyword !== '_キーワード設定' &&
          d.menu_keyword !== 'キーワード設定'
        );
        
        setAllData(validData);
        setFilteredData(validData);
        setLastUpdated(new Date());
        calculateStats(validData);
        calculateChartData(validData);
      }
    } catch (error) {
      console.error('データ取得エラー:', error);
    } finally {
      setLoading(false);
    }
  }

  // 検索実行
  function handleSearch() {
    let filtered = [...allData];

    // プラットフォームフィルター
    if (searchParams.platform !== 'すべて') {
      filtered = filtered.filter(d => d.platform === searchParams.platform);
    }

    // 日付フィルター
    if (searchParams.startDate) {
      filtered = filtered.filter(d => {
        const postDate = new Date(d.post_date);
        return postDate >= new Date(searchParams.startDate);
      });
    }
    if (searchParams.endDate) {
      filtered = filtered.filter(d => {
        const postDate = new Date(d.post_date);
        return postDate <= new Date(searchParams.endDate + 'T23:59:59');
      });
    }

    // キーワードフィルター
    if (searchParams.keyword) {
      const kw = searchParams.keyword.toLowerCase();
      filtered = filtered.filter(d => 
        (d.content && d.content.toLowerCase().includes(kw)) ||
        (d.menu_keyword && d.menu_keyword.toLowerCase().includes(kw))
      );
    }

    // メニューフィルター
    if (searchParams.menu !== 'すべて') {
      filtered = filtered.filter(d => d.menu_keyword === searchParams.menu);
    }

    setFilteredData(filtered);
    calculateStats(filtered);
    calculateChartData(filtered);
  }

  // 統計計算
  function calculateStats(data) {
    const totalPosts = data.length;
    const totalLikes = data.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = data.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalShares = data.reduce((sum, p) => sum + (p.shares || 0), 0);

    setStats({ totalPosts, totalLikes, totalComments, totalShares });
  }

  // グラフデータ計算
  function calculateChartData(data) {
    // プラットフォーム別集計
    const platformStats = data.reduce((acc, post) => {
      const platform = post.platform;
      if (!acc[platform]) {
        acc[platform] = { platform, count: 0, likes: 0 };
      }
      acc[platform].count += 1;
      acc[platform].likes += post.likes || 0;
      return acc;
    }, {});

    const platformCounts = [
      platformStats.YouTube || { platform: 'YouTube', count: 0, likes: 0 },
      platformStats.Instagram || { platform: 'Instagram', count: 0, likes: 0 },
      platformStats.Twitter || { platform: 'Twitter', count: 0, likes: 0 }
    ];

    // 時系列データ（日別）
    const dateMap = {};
    data.forEach(post => {
      if (!post.post_date) return;
      const date = new Date(post.post_date);
      const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
      
      if (!dateMap[dateKey]) {
        dateMap[dateKey] = {
          date: dateKey,
          YouTube: { count: 0, likes: 0 },
          Instagram: { count: 0, likes: 0 },
          Twitter: { count: 0, likes: 0 }
        };
      }
      
      const platform = post.platform;
      if (dateMap[dateKey][platform]) {
        dateMap[dateKey][platform].count += 1;
        dateMap[dateKey][platform].likes += post.likes || 0;
      }
    });

    // 日付順にソート
    const timeSeriesData = Object.values(dateMap).sort((a, b) => {
      const [aM, aD] = a.date.split('/').map(Number);
      const [bM, bD] = b.date.split('/').map(Number);
      return (aM * 100 + aD) - (bM * 100 + bD);
    });

    setChartData({ platformCounts, timeSeriesData });
  }

  // ソート処理
  function getSortedData() {
    const sorted = [...filteredData];
    switch (sortBy) {
      case 'likes':
        return sorted.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      case 'comments':
        return sorted.sort((a, b) => (b.comments || 0) - (a.comments || 0));
      case 'date':
      default:
        return sorted.sort((a, b) => new Date(b.post_date) - new Date(a.post_date));
    }
  }

  function formatDate(dateString) {
    if (!dateString) return '日時不明';
    const date = new Date(dateString);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000 / 60 / 60);
    
    if (diff < 1) return '1時間前';
    if (diff < 24) return `${diff}時間前`;
    return `${Math.floor(diff / 24)}日前`;
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🍜 はなまるうどん UGC検索ダッシュボード</h1>
        <p className={styles.subtitle}>Instagram・Twitter・YouTube の投稿検索・分析</p>
      </header>

      {/* 検索フォーム */}
      <div className={styles.searchSection}>
        <h2 className={styles.sectionTitle}>📊 検索条件</h2>
        <div className={styles.searchForm}>
          <div className={styles.searchRow}>
            <div className={styles.formGroup}>
              <label>プラットフォーム</label>
              <select 
                value={searchParams.platform} 
                onChange={(e) => setSearchParams({...searchParams, platform: e.target.value})}
              >
                <option>すべて</option>
                <option>YouTube</option>
                <option>Instagram</option>
                <option>Twitter</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label>開始日</label>
              <input 
                type="date" 
                value={searchParams.startDate}
                onChange={(e) => setSearchParams({...searchParams, startDate: e.target.value})}
              />
            </div>

            <div className={styles.formGroup}>
              <label>終了日</label>
              <input 
                type="date" 
                value={searchParams.endDate}
                onChange={(e) => setSearchParams({...searchParams, endDate: e.target.value})}
              />
            </div>
          </div>

          <div className={styles.searchRow}>
            <div className={styles.formGroup} style={{flex: 2}}>
              <label>キーワード検索</label>
              <input 
                type="text" 
                placeholder="投稿内容やメニュー名で検索..."
                value={searchParams.keyword}
                onChange={(e) => setSearchParams({...searchParams, keyword: e.target.value})}
              />
            </div>

            <div className={styles.formGroup}>
              <label>メニュー</label>
              <select 
                value={searchParams.menu} 
                onChange={(e) => setSearchParams({...searchParams, menu: e.target.value})}
              >
                <option>すべて</option>
                <option>天ぷら定期券</option>
                <option>白ごま担々</option>
                <option>3種薬味で食べる豚しゃぶうどん</option>
                <option>スタミナ肉野菜炒めうどん</option>
                <option>焼き塩豚カルビの半割レモンぶっかけ</option>
                <option>ふわとろ明太オムうどん</option>
              </select>
            </div>

            <button className={styles.searchButton} onClick={handleSearch} disabled={loading}>
              🔍 検索
            </button>
          </div>
        </div>
      </div>

    {/* グラフエリア */}
      <div className={styles.chartsSection}>
        <h2 className={styles.sectionTitle}>📊 データ分析</h2>
        
        {/* プラットフォーム別 投稿数（棒）& いいね数（折れ線）複合グラフ */}
        {chartData.timeSeriesData.length > 0 ? (
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>プラットフォーム別 投稿数・いいね数推移</h3>
            <div className={styles.comboChartContainer}>
              {/* Y軸（左）- 投稿数 */}
              <div className={styles.yAxisLeft}>
                <div className={styles.yAxisLabel}>投稿数</div>
                <div className={styles.yAxisTicks}>
                  {(() => {
                    const maxCount = Math.max(
                      ...chartData.timeSeriesData.map(d => 
                        Math.max(d.YouTube.count, d.Instagram.count, d.Twitter.count)
                      ),
                      1
                    );
                    const step = Math.max(1, Math.ceil(maxCount / 5));
                    return [5, 4, 3, 2, 1, 0].map(i => (
                      <div key={i} className={styles.yAxisTick}>{step * i}</div>
                    ));
                  })()}
                </div>
              </div>

              {/* グラフエリア */}
              <div className={styles.comboChartArea}>
                {/* グリッド線 */}
                <div className={styles.gridLines}>
                  {[0, 1, 2, 3, 4, 5].map(i => (
                    <div key={i} className={styles.gridLine}></div>
                  ))}
                </div>

                {/* 棒グラフ */}
                <div className={styles.barsContainer}>
                  {chartData.timeSeriesData.map((item, index) => {
                    const maxCount = Math.max(
                      ...chartData.timeSeriesData.map(d => 
                        Math.max(d.YouTube.count, d.Instagram.count, d.Twitter.count)
                      ),
                      1
                    );
                    const step = Math.max(1, Math.ceil(maxCount / 5));
                    const maxValue = step * 5;
                    
                    const youtubeHeight = (item.YouTube.count / maxValue) * 100;
                    const instagramHeight = (item.Instagram.count / maxValue) * 100;
                    const twitterHeight = (item.Twitter.count / maxValue) * 100;

                    return (
                      <div key={index} className={styles.barGroup}>
                        {item.YouTube.count > 0 && (
                          <div 
                            className={styles.barYoutube}
                            style={{height: `${Math.max(youtubeHeight, 3)}%`}}
                            title={`YouTube: ${item.YouTube.count}件`}
                          >
                            <span className={styles.barValueInside}>{item.YouTube.count}</span>
                          </div>
                        )}
                        {item.Instagram.count > 0 && (
                          <div 
                            className={styles.barInstagram}
                            style={{height: `${Math.max(instagramHeight, 3)}%`}}
                            title={`Instagram: ${item.Instagram.count}件`}
                          >
                            <span className={styles.barValueInside}>{item.Instagram.count}</span>
                          </div>
                        )}
                        {item.Twitter.count > 0 && (
                          <div 
                            className={styles.barTwitter}
                            style={{height: `${Math.max(twitterHeight, 3)}%`}}
                            title={`Twitter: ${item.Twitter.count}件`}
                          >
                            <span className={styles.barValueInside}>{item.Twitter.count}</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 折れ線グラフ */}
                <div className={styles.lineChartWrapper}>
                  <svg 
                    className={styles.lineChart} 
                    viewBox="0 0 100 100" 
                    preserveAspectRatio="none"
                  >
                    {/* YouTube いいね数 */}
                    <polyline
                      points={chartData.timeSeriesData.map((item, index) => {
                        const maxLikes = Math.max(
                          ...chartData.timeSeriesData.map(d => 
                            Math.max(d.YouTube.likes, d.Instagram.likes, d.Twitter.likes)
                          ),
                          1
                        );
                        const x = ((index + 0.5) / chartData.timeSeriesData.length) * 100;
                        const y = 95 - ((item.YouTube.likes / maxLikes) * 85);
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#FF0000"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Instagram いいね数 */}
                    <polyline
                      points={chartData.timeSeriesData.map((item, index) => {
                        const maxLikes = Math.max(
                          ...chartData.timeSeriesData.map(d => 
                            Math.max(d.YouTube.likes, d.Instagram.likes, d.Twitter.likes)
                          ),
                          1
                        );
                        const x = ((index + 0.5) / chartData.timeSeriesData.length) * 100;
                        const y = 95 - ((item.Instagram.likes / maxLikes) * 85);
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#E4405F"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    
                    {/* Twitter いいね数 */}
                    <polyline
                      points={chartData.timeSeriesData.map((item, index) => {
                        const maxLikes = Math.max(
                          ...chartData.timeSeriesData.map(d => 
                            Math.max(d.YouTube.likes, d.Instagram.likes, d.Twitter.likes)
                          ),
                          1
                        );
                        const x = ((index + 0.5) / chartData.timeSeriesData.length) * 100;
                        const y = 95 - ((item.Twitter.likes / maxLikes) * 85);
                        return `${x},${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#1DA1F2"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* ポイント表示 */}
                    {chartData.timeSeriesData.map((item, index) => {
                      const maxLikes = Math.max(
                        ...chartData.timeSeriesData.map(d => 
                          Math.max(d.YouTube.likes, d.Instagram.likes, d.Twitter.likes)
                        ),
                        1
                      );
                      const x = ((index + 0.5) / chartData.timeSeriesData.length) * 100;
                      
                      return (
                        <g key={index}>
                          {/* YouTube ポイント */}
                          {item.YouTube.likes > 0 && (
                            <>
                              <circle 
                                cx={x} 
                                cy={95 - ((item.YouTube.likes / maxLikes) * 85)} 
                                r="1.5" 
                                fill="#FF0000"
                                stroke="#fff"
                                strokeWidth="1"
                              />
                              <text
                                x={x}
                                y={95 - ((item.YouTube.likes / maxLikes) * 85) - 3}
                                fill="#FF0000"
                                fontSize="3"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                {item.YouTube.likes}
                              </text>
                            </>
                          )}
                          
                          {/* Instagram ポイント */}
                          {item.Instagram.likes > 0 && (
                            <>
                              <circle 
                                cx={x} 
                                cy={95 - ((item.Instagram.likes / maxLikes) * 85)} 
                                r="1.5" 
                                fill="#E4405F"
                                stroke="#fff"
                                strokeWidth="1"
                              />
                              <text
                                x={x}
                                y={95 - ((item.Instagram.likes / maxLikes) * 85) - 3}
                                fill="#E4405F"
                                fontSize="3"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                {item.Instagram.likes}
                              </text>
                            </>
                          )}
                          
                          {/* Twitter ポイント */}
                          {item.Twitter.likes > 0 && (
                            <>
                              <circle 
                                cx={x} 
                                cy={95 - ((item.Twitter.likes / maxLikes) * 85)} 
                                r="1.5" 
                                fill="#1DA1F2"
                                stroke="#fff"
                                strokeWidth="1"
                              />
                              <text
                                x={x}
                                y={95 - ((item.Twitter.likes / maxLikes) * 85) - 3}
                                fill="#1DA1F2"
                                fontSize="3"
                                fontWeight="700"
                                textAnchor="middle"
                              >
                                {item.Twitter.likes}
                              </text>
                            </>
                          )}
                        </g>
                      );
                    })}
                  </svg>
                </div>
              </div>

              {/* Y軸（右）- いいね数 */}
              <div className={styles.yAxisRight}>
                <div className={styles.yAxisLabel}>いいね数</div>
                <div className={styles.yAxisTicks}>
                  {(() => {
                    const maxLikes = Math.max(
                      ...chartData.timeSeriesData.map(d => 
                        Math.max(d.YouTube.likes, d.Instagram.likes, d.Twitter.likes)
                      ),
                      1
                    );
                    const step = Math.max(10, Math.ceil(maxLikes / 5 / 10) * 10);
                    return [5, 4, 3, 2, 1, 0].map(i => (
                      <div key={i} className={styles.yAxisTick}>
                        {(step * i).toLocaleString()}
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>

            {/* X軸ラベル */}
            <div className={styles.xAxisLabels}>
              {chartData.timeSeriesData.map((item, index) => (
                <div key={index} className={styles.xAxisLabel}>{item.date}</div>
              ))}
            </div>

            {/* 凡例 */}
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div style={{width: '20px', height: '12px', background: '#FF0000', borderRadius: '3px'}}></div>
                <span>YouTube 投稿数</span>
              </div>
              <div className={styles.legendItem}>
                <div style={{width: '20px', height: '12px', background: '#E4405F', borderRadius: '3px'}}></div>
                <span>Instagram 投稿数</span>
              </div>
              <div className={styles.legendItem}>
                <div style={{width: '20px', height: '12px', background: '#1DA1F2', borderRadius: '3px'}}></div>
                <span>Twitter 投稿数</span>
              </div>
              <div className={styles.legendItem}>
                <div style={{width: '20px', height: '3px', background: '#FF0000', borderRadius: '2px'}}></div>
                <span>YouTube いいね</span>
              </div>
              <div className={styles.legendItem}>
                <div style={{width: '20px', height: '3px', background: '#E4405F', borderRadius: '2px'}}></div>
                <span>Instagram いいね</span>
              </div>
              <div className={styles.legendItem}>
                <div style={{width: '20px', height: '3px', background: '#1DA1F2', borderRadius: '2px'}}></div>
                <span>Twitter いいね</span>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.chartCard}>
            <div className={styles.emptyChart}>データがありません</div>
          </div>
        )}
      </div>

      {/* 投稿一覧 */}
      <div className={styles.postsSection}>
        <div className={styles.postsHeader}>
          <h2 className={styles.sectionTitle}>📱 投稿一覧（{filteredData.length}件）</h2>
          <div className={styles.sortControl}>
            <label>並び替え:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="date">新しい順</option>
              <option value="likes">いいね順</option>
              <option value="comments">コメント順</option>
            </select>
          </div>
        </div>

        <div className={styles.postsList}>
          {getSortedData().map((post, index) => (
            <div key={index} className={styles.postCard}>
              {post.media_url && (
                <div className={styles.postThumbnail}>
                  <img src={post.media_url} alt="投稿画像" />
                </div>
              )}
              <div className={styles.postContent}>
                <div className={styles.postHeader}>
                  <span className={`${styles.platformBadge} ${styles[post.platform.toLowerCase()]}`}>
                    {post.platform}
                  </span>
                  <span className={styles.postTime}>{formatDate(post.post_date)}</span>
                </div>
                <div className={styles.postUsername}>@{post.username}</div>
                <p className={styles.postText}>
                  {post.content ? 
                    (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content) 
                    : '投稿内容なし'}
                </p>
                {post.menu_keyword && (
                  <span className={styles.postTag}>#{post.menu_keyword}</span>
                )}
                <div className={styles.postStats}>
                  <span>💚 {post.likes.toLocaleString()}</span>
                  <span>💬 {post.comments.toLocaleString()}</span>
                  <span>🔄 {post.shares.toLocaleString()}</span>
                </div>
                {post.post_url && (
                  <a href={post.post_url} target="_blank" rel="noopener noreferrer" className={styles.postLink}>
                    投稿を見る →
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}