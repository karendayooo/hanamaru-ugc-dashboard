'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';

export default function Dashboard() {
  const [allData, setAllData] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [mounted, setMounted] = useState(false);

  const [searchParams, setSearchParams] = useState({
    platform: 'すべて',
    startDate: '',
    endDate: '',
    keyword: '',
    menu: 'すべて'
  });

  const [stats, setStats] = useState({
    totalPosts: 0,
    totalLikes: 0,
    totalComments: 0,
    totalShares: 0
  });

  const [chartData, setChartData] = useState({
    platformCounts: [],
    timeSeriesData: []
  });

  const [sortBy, setSortBy] = useState('date');
  const [selectedPlatform, setSelectedPlatform] = useState('all');

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (mounted && isMounted) {
        await fetchAllData();
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [mounted]);

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

  function handleSearch() {
    let filtered = [...allData];

    if (searchParams.platform !== 'すべて') {
      filtered = filtered.filter(d => d.platform === searchParams.platform);
    }

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

    if (searchParams.keyword) {
      const kw = searchParams.keyword.toLowerCase();
      filtered = filtered.filter(d => 
        (d.content && d.content.toLowerCase().includes(kw)) ||
        (d.menu_keyword && d.menu_keyword.toLowerCase().includes(kw))
      );
    }

    if (searchParams.menu !== 'すべて') {
      filtered = filtered.filter(d => d.menu_keyword === searchParams.menu);
    }

    setFilteredData(filtered);
    calculateStats(filtered);
    calculateChartData(filtered);
  }

  function calculateStats(data) {
    const totalPosts = data.length;
    const totalLikes = data.reduce((sum, p) => sum + (p.likes || 0), 0);
    const totalComments = data.reduce((sum, p) => sum + (p.comments || 0), 0);
    const totalShares = data.reduce((sum, p) => sum + (p.shares || 0), 0);

    setStats({ totalPosts, totalLikes, totalComments, totalShares });
  }

  function calculateChartData(data) {
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

    const timeSeriesData = Object.values(dateMap).sort((a, b) => {
      const [aM, aD] = a.date.split('/').map(Number);
      const [bM, bD] = b.date.split('/').map(Number);
      return (aM * 100 + aD) - (bM * 100 + bD);
    });

    setChartData({ platformCounts, timeSeriesData });
  }

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

  function getDisplayData() {
    const sorted = getSortedData();
    if (selectedPlatform === 'all') {
      return sorted;
    }
    return sorted.filter(p => p.platform === selectedPlatform);
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

  if (!mounted) {
    return (
      <div className={styles.container}>
        <header className={styles.header}>
          <h1>🍜 はなまるうどん UGC検索ダッシュボード</h1>
          <p className={styles.subtitle}>読み込み中...</p>
        </header>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>🍜 はなまるうどん UGC検索ダッシュボード</h1>
        <p className={styles.subtitle}>Instagram・Twitter・YouTube の投稿検索・分析</p>
      </header>

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
<div className={styles.chartsSection}>
  <h2 className={styles.sectionTitle}>📊 データ分析</h2>
  
  {chartData.timeSeriesData.length > 0 ? (
    <div className={styles.chartCard}>
      <div className={styles.chartHeader}>
        <h3 className={styles.chartTitle}>プラットフォーム別 投稿数・いいね数推移</h3>
        <div className={styles.chartLegendHorizontal}>
          <div className={styles.legendGroup}>
            <span className={styles.legendGroupTitle}>投稿数</span>
            <div className={styles.legendItem}>
              <div className={styles.legendBar} style={{background: '#FF0000'}}></div>
              <span>YouTube</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendBar} style={{background: '#E1306C'}}></div>
              <span>Instagram</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendBar} style={{background: '#1DA1F2'}}></div>
              <span>Twitter</span>
            </div>
          </div>
          <div className={styles.legendGroup}>
            <span className={styles.legendGroupTitle}>いいね数</span>
            <div className={styles.legendItem}>
              <div className={styles.legendLine} style={{background: '#FF6B6B'}}></div>
              <span>YouTube</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLine} style={{background: '#F77FB0'}}></div>
              <span>Instagram</span>
            </div>
            <div className={styles.legendItem}>
              <div className={styles.legendLine} style={{background: '#6EC9FF'}}></div>
              <span>Twitter</span>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.comboChartWrapper}>
        {/* Y軸（左）- 投稿数 */}
        <div className={styles.yAxisLeft}>
          <div className={styles.yAxisLabel}>投稿数（件）</div>
          <div className={styles.yAxisTicks}>
            {(() => {
              const maxCount = Math.max(
                ...chartData.timeSeriesData.flatMap(d => 
                  [d.YouTube.count, d.Instagram.count, d.Twitter.count]
                ),
                5
              );
              const step = Math.max(1, Math.ceil(maxCount / 5));
              return [5, 4, 3, 2, 1, 0].map(i => (
                <div key={i} className={styles.yAxisTick}>{step * i}</div>
              ));
            })()}
          </div>
        </div>

        {/* メイングラフエリア */}
        <div className={styles.chartMainArea}>
          {/* グリッド線 */}
          <div className={styles.gridLines}>
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div key={i} className={styles.gridLine}></div>
            ))}
          </div>

          {/* 棒グラフ + 折れ線グラフ */}
          <div className={styles.chartContent}>
            {chartData.timeSeriesData.map((item, index) => {
              const maxCount = Math.max(
                ...chartData.timeSeriesData.flatMap(d => 
                  [d.YouTube.count, d.Instagram.count, d.Twitter.count]
                ),
                5
              );
              const step = Math.max(1, Math.ceil(maxCount / 5));
              const maxValue = step * 5;

              return (
                <div key={index} className={styles.chartColumn}>
                  <div className={styles.barGroup}>
                    <div 
                      className={styles.bar}
                      style={{
                        height: item.YouTube.count > 0 
                          ? `${Math.max((item.YouTube.count / maxValue) * 100, 2)}%`
                          : '2%',
                        background: item.YouTube.count > 0 ? '#FF0000' : '#FFE0E0',
                        opacity: item.YouTube.count > 0 ? 1 : 0.3
                      }}
                      data-tooltip={`YouTube: ${item.YouTube.count}件`}
                    >
                      {item.YouTube.count > 0 && (
                        <span className={styles.barValue}>{item.YouTube.count}</span>
                      )}
                    </div>
                    
                    <div 
                      className={styles.bar}
                      style={{
                        height: item.Instagram.count > 0 
                          ? `${Math.max((item.Instagram.count / maxValue) * 100, 2)}%`
                          : '2%',
                        background: item.Instagram.count > 0 ? '#E1306C' : '#FFE0EC',
                        opacity: item.Instagram.count > 0 ? 1 : 0.3
                      }}
                      data-tooltip={`Instagram: ${item.Instagram.count}件`}
                    >
                      {item.Instagram.count > 0 && (
                        <span className={styles.barValue}>{item.Instagram.count}</span>
                      )}
                    </div>
                    
                    <div 
                      className={styles.bar}
                      style={{
                        height: item.Twitter.count > 0 
                          ? `${Math.max((item.Twitter.count / maxValue) * 100, 2)}%`
                          : '2%',
                        background: item.Twitter.count > 0 ? '#1DA1F2' : '#E0F2FF',
                        opacity: item.Twitter.count > 0 ? 1 : 0.3
                      }}
                      data-tooltip={`Twitter: ${item.Twitter.count}件`}
                    >
                      {item.Twitter.count > 0 && (
                        <span className={styles.barValue}>{item.Twitter.count}</span>
                      )}
                    </div>
                  </div>

                  <div className={styles.linePoints}>
                    {item.YouTube.likes > 0 && (
                      <div 
                        className={styles.linePoint}
                        style={{
                          bottom: `${Math.min((item.YouTube.likes / 50) * 100, 100)}%`,
                          background: '#FF6B6B'
                        }}
                        data-tooltip={`YouTube: ${item.YouTube.likes.toLocaleString()}いいね`}
                      ></div>
                    )}
                    {item.Instagram.likes > 0 && (
                      <div 
                        className={styles.linePoint}
                        style={{
                          bottom: `${Math.min((item.Instagram.likes / 50) * 100, 100)}%`,
                          background: '#F77FB0'
                        }}
                        data-tooltip={`Instagram: ${item.Instagram.likes.toLocaleString()}いいね`}
                      ></div>
                    )}
                    {item.Twitter.likes > 0 && (
                      <div 
                        className={styles.linePoint}
                        style={{
                          bottom: `${Math.min((item.Twitter.likes / 50) * 100, 100)}%`,
                          background: '#6EC9FF'
                        }}
                        data-tooltip={`Twitter: ${item.Twitter.likes.toLocaleString()}いいね`}
                      ></div>
                    )}
                  </div>

                  <div className={styles.xAxisLabel}>{item.date}</div>
                </div>
              );
            })}

            {/* SVG折れ線 */}
         <svg className={styles.lineChartSvg} preserveAspectRatio="none">
  {/* YouTube いいね数 */}
  {(() => {
    const youtubePoints = chartData.timeSeriesData
      .map((item, index) => ({
        item,
        index,
        hasData: item.YouTube.likes > 0
      }))
      .filter(p => p.hasData);

    if (youtubePoints.length === 0) return null;

    const segments = [];
    let currentSegment = [youtubePoints[0]];

    for (let i = 1; i < youtubePoints.length; i++) {
      if (youtubePoints[i].index === youtubePoints[i - 1].index + 1) {
        currentSegment.push(youtubePoints[i]);
      } else {
        segments.push(currentSegment);
        currentSegment = [youtubePoints[i]];
      }
    }
    segments.push(currentSegment);

    return segments.map((segment, segIndex) => (
      <polyline
        key={`youtube-${segIndex}`}
        points={segment.map(p => {
          const x = ((p.index + 0.5) / chartData.timeSeriesData.length) * 100;
          const likesRatio = Math.min(p.item.YouTube.likes / 50, 1);
          const y = 100 - (likesRatio * 100);
          return `${x},${y}`;
        }).join(' ')}
        fill="none"
        stroke="#FF6B6B"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    ));
  })()}
  
  {/* Instagram いいね数 */}
  {(() => {
    const instagramPoints = chartData.timeSeriesData
      .map((item, index) => ({
        item,
        index,
        hasData: item.Instagram.likes > 0
      }))
      .filter(p => p.hasData);

    if (instagramPoints.length === 0) return null;

    const segments = [];
    let currentSegment = [instagramPoints[0]];

    for (let i = 1; i < instagramPoints.length; i++) {
      if (instagramPoints[i].index === instagramPoints[i - 1].index + 1) {
        currentSegment.push(instagramPoints[i]);
      } else {
        segments.push(currentSegment);
        currentSegment = [instagramPoints[i]];
      }
    }
    segments.push(currentSegment);

    return segments.map((segment, segIndex) => (
      <polyline
        key={`instagram-${segIndex}`}
        points={segment.map(p => {
          const x = ((p.index + 0.5) / chartData.timeSeriesData.length) * 100;
          const likesRatio = Math.min(p.item.Instagram.likes / 50, 1);
          const y = 100 - (likesRatio * 100);
          return `${x},${y}`;
        }).join(' ')}
        fill="none"
        stroke="#F77FB0"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    ));
  })()}
  
  {/* Twitter いいね数 */}
  {(() => {
    const twitterPoints = chartData.timeSeriesData
      .map((item, index) => ({
        item,
        index,
        hasData: item.Twitter.likes > 0
      }))
      .filter(p => p.hasData);

    if (twitterPoints.length === 0) return null;

    const segments = [];
    let currentSegment = [twitterPoints[0]];

    for (let i = 1; i < twitterPoints.length; i++) {
      if (twitterPoints[i].index === twitterPoints[i - 1].index + 1) {
        currentSegment.push(twitterPoints[i]);
      } else {
        segments.push(currentSegment);
        currentSegment = [twitterPoints[i]];
      }
    }
    segments.push(currentSegment);

    return segments.map((segment, segIndex) => (
      <polyline
        key={`twitter-${segIndex}`}
        points={segment.map(p => {
          const x = ((p.index + 0.5) / chartData.timeSeriesData.length) * 100;
          const likesRatio = Math.min(p.item.Twitter.likes / 50, 1);
          const y = 100 - (likesRatio * 100);
          return `${x},${y}`;
        }).join(' ')}
        fill="none"
        stroke="#6EC9FF"
        strokeWidth="3"
        vectorEffect="non-scaling-stroke"
      />
    ));
  })()}
</svg>

          </div>
        </div>

        {/* Y軸（右）- いいね数 */}
        <div className={styles.yAxisRight}>
          <div className={styles.yAxisLabel}>いいね数（回）</div>
          <div className={styles.yAxisTicks}>
            {[50, 40, 30, 20, 10, 0].map((value, i) => (
              <div key={i} className={styles.yAxisTick}>
                {value}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className={styles.chartCard}>
      <div className={styles.emptyChart}>
        <p>📊 データがありません</p>
        <p className={styles.emptyChartSub}>検索条件を変更してください</p>
      </div>
    </div>
  )}
</div>

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

        <div className={styles.platformTabs}>
          <button 
            className={`${styles.platformTab} ${selectedPlatform === 'all' ? styles.active : ''}`}
            onClick={() => setSelectedPlatform('all')}
          >
            すべて ({filteredData.length})
          </button>
          <button 
            className={`${styles.platformTab} ${styles.youtubeTab} ${selectedPlatform === 'YouTube' ? styles.active : ''}`}
            onClick={() => setSelectedPlatform('YouTube')}
          >
            YouTube ({filteredData.filter(p => p.platform === 'YouTube').length})
          </button>
          <button 
            className={`${styles.platformTab} ${styles.instagramTab} ${selectedPlatform === 'Instagram' ? styles.active : ''}`}
            onClick={() => setSelectedPlatform('Instagram')}
          >
            Instagram ({filteredData.filter(p => p.platform === 'Instagram').length})
          </button>
          <button 
            className={`${styles.platformTab} ${styles.twitterTab} ${selectedPlatform === 'Twitter' ? styles.active : ''}`}
            onClick={() => setSelectedPlatform('Twitter')}
          >
            Twitter ({filteredData.filter(p => p.platform === 'Twitter').length})
          </button>
        </div>

        {selectedPlatform === 'all' ? (
          <div className={styles.platformColumns}>
            <div className={styles.platformColumn}>
              <div className={styles.columnHeader}>
                <div className={`${styles.platformIcon} ${styles.youtube}`}>▶️</div>
                <h3>YouTube</h3>
                <span className={styles.columnCount}>
                  {getSortedData().filter(p => p.platform === 'YouTube').length}件
                </span>
              </div>
              <div className={styles.columnPosts}>
                {getSortedData().filter(p => p.platform === 'YouTube').length > 0 ? (
                  getSortedData().filter(p => p.platform === 'YouTube').map((post, index) => (
                    <div key={index} className={styles.postCard}>
                      {post.media_url && (
                        <div className={styles.postThumbnail}>
                          <img src={post.media_url} alt="投稿画像" />
                        </div>
                      )}
                      <div className={styles.postContent}>
                        <div className={styles.postMeta}>
                          <span className={styles.postTime}>{formatDate(post.post_date)}</span>
                        </div>
                        <div className={styles.postUsername}>@{post.username}</div>
                        <p className={styles.postText}>
                          {post.content ? 
                            (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) 
                            : '投稿内容なし'}
                        </p>
                        {post.menu_keyword && (
                          <span className={styles.postTag}>#{post.menu_keyword}</span>
                        )}
                        <div className={styles.postStats}>
                          <span>💚 {post.likes.toLocaleString()}</span>
                          <span>💬 {post.comments.toLocaleString()}</span>
                        </div>
                        {post.post_url && (
                          <a href={post.post_url} target="_blank" rel="noopener noreferrer" className={styles.postLink}>
                            投稿を見る →
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyColumn}>投稿がありません</div>
                )}
              </div>
            </div>

            <div className={styles.platformColumn}>
              <div className={styles.columnHeader}>
                <div className={`${styles.platformIcon} ${styles.instagram}`}>📷</div>
                <h3>Instagram</h3>
                <span className={styles.columnCount}>
                  {getSortedData().filter(p => p.platform === 'Instagram').length}件
                </span>
              </div>
              <div className={styles.columnPosts}>
                {getSortedData().filter(p => p.platform === 'Instagram').length > 0 ? (
                  getSortedData().filter(p => p.platform === 'Instagram').map((post, index) => (
                    <div key={index} className={styles.postCard}>
                      {post.media_url && (
                        <div className={styles.postThumbnail}>
                          <img src={post.media_url} alt="投稿画像" />
                        </div>
                      )}
                      <div className={styles.postContent}>
                        <div className={styles.postMeta}>
                          <span className={styles.postTime}>{formatDate(post.post_date)}</span>
                        </div>
                        <div className={styles.postUsername}>@{post.username}</div>
                        <p className={styles.postText}>
                          {post.content ? 
                            (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) 
                            : '投稿内容なし'}
                        </p>
                        {post.menu_keyword && (
                          <span className={styles.postTag}>#{post.menu_keyword}</span>
                        )}
                        <div className={styles.postStats}>
                          <span>💚 {post.likes.toLocaleString()}</span>
                          <span>💬 {post.comments.toLocaleString()}</span>
                        </div>
                        {post.post_url && (
                          <a href={post.post_url} target="_blank" rel="noopener noreferrer" className={styles.postLink}>
                            投稿を見る →
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className={styles.emptyColumn}>投稿がありません</div>
                )}
              </div>
            </div>

            <div className={styles.platformColumn}>
              <div className={styles.columnHeader}>
                <div className={`${styles.platformIcon} ${styles.twitter}`}>🐦</div>
                <h3>Twitter</h3>
                <span className={styles.columnCount}>
                  {getSortedData().filter(p => p.platform === 'Twitter').length}件
                </span>
              </div>
              <div className={styles.columnPosts}>
                {getSortedData().filter(p => p.platform === 'Twitter').length > 0 ? (
                  getSortedData().filter(p => p.platform === 'Twitter').map((post, index) => (
                    <div key={index} className={styles.postCard}>
                      {post.media_url && (
                        <div className={styles.postThumbnail}>
                          <img src={post.media_url} alt="投稿画像" />
                        </div>
                      )}
                      <div className={styles.postContent}>
                        <div className={styles.postMeta}>
                          <span className={styles.postTime}>{formatDate(post.post_date)}</span>
                        </div>
                        <div className={styles.postUsername}>@{post.username}</div>
                        <p className={styles.postText}>
                          {post.content ? 
                            (post.content.length > 100 ? post.content.substring(0, 100) + '...' : post.content) 
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
                  ))
                ) : (
                  <div className={styles.emptyColumn}>投稿がありません</div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.singleColumnPosts}>
            {getDisplayData().map((post, index) => (
              <div key={index} className={styles.postCardLarge}>
                {post.media_url && (
                  <div className={styles.postThumbnailLarge}>
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
                    {post.platform === 'Twitter' && <span>🔄 {post.shares.toLocaleString()}</span>}
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
        )}
      </div>
    </div>
  );
}
