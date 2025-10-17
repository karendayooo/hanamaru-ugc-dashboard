'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './page.module.css';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalPosts: 0,
    avgEngagement: 0,
    totalReach: 0,
    uniqueUsers: 0
  });
  const [platformData, setPlatformData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [menuData, setMenuData] = useState([]);
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState({
    platform: 'すべて',
    menu: 'すべて',
    period: '全期間'
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  async function fetchDashboardData() {
    await Promise.all([
      fetchStats(),
      fetchPlatformData(),
      fetchTrendData(),
      fetchMenuData(),
      fetchPosts()
    ]);
  }

  async function handleRefresh() {
    setLoading(true);
    try {
      await fetchDashboardData();
      setLastUpdated(new Date());
    } catch (error) {
      console.error('更新エラー:', error);
    } finally {
      setLoading(false);
    }
  }

  function getDateFilter() {
    const now = new Date();
    let startDate = null;

    switch (filters.period) {
      case '過去7日間':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '過去30日間':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '過去90日間':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        return null;
    }

    return startDate.toISOString();
  }

  async function fetchStats() {
    let query = supabase.from('posts').select('*');
    
    if (filters.platform !== 'すべて') {
      query = query.eq('platform', filters.platform);
    }
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const dateFilter = getDateFilter();
    if (dateFilter) {
      query = query.gte('post_date', dateFilter);
    }

    const { data } = await query;

    if (data) {
      const totalPosts = data.length;
      const totalLikes = data.reduce((sum, p) => sum + (p.likes || 0), 0);
      const totalComments = data.reduce((sum, p) => sum + (p.comments || 0), 0);
      const totalShares = data.reduce((sum, p) => sum + (p.shares || 0), 0);
      const totalEngagement = totalLikes + totalComments + totalShares;
      const avgEngagement = totalPosts > 0 ? (totalEngagement / totalPosts).toFixed(1) : 0;
      const totalReach = (totalPosts * 71.5 / 1000).toFixed(1);
      const uniqueUsers = new Set(data.map(p => p.username).filter(Boolean)).size;

      setStats({
        totalPosts,
        avgEngagement,
        totalReach,
        uniqueUsers
      });
    }
  }

  async function fetchPlatformData() {
    let query = supabase.from('posts').select('platform, likes, comments, shares');
    
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const dateFilter = getDateFilter();
    if (dateFilter) {
      query = query.gte('post_date', dateFilter);
    }

    const { data } = await query;

    if (data) {
      const platformStats = data.reduce((acc, post) => {
        const platform = post.platform;
        if (!acc[platform]) {
          acc[platform] = { 
            platform, 
            count: 0, 
            likes: 0,
            comments: 0,
            shares: 0
          };
        }
        acc[platform].count += 1;
        acc[platform].likes += post.likes || 0;
        acc[platform].comments += post.comments || 0;
        acc[platform].shares += post.shares || 0;
        return acc;
      }, {});

      const total = data.length;
      setPlatformData([
        { 
          ...platformStats.Instagram,
          platform: 'Instagram',
          count: platformStats.Instagram?.count || 0,
          likes: platformStats.Instagram?.likes || 0,
          comments: platformStats.Instagram?.comments || 0,
          shares: platformStats.Instagram?.shares || 0,
          percentage: total > 0 ? ((platformStats.Instagram?.count || 0) / total * 100) : 0 
        },
        { 
          ...platformStats.Twitter,
          platform: 'Twitter',
          count: platformStats.Twitter?.count || 0,
          likes: platformStats.Twitter?.likes || 0,
          comments: platformStats.Twitter?.comments || 0,
          shares: platformStats.Twitter?.shares || 0,
          percentage: total > 0 ? ((platformStats.Twitter?.count || 0) / total * 100) : 0 
        }
      ]);
    }
  }

  async function fetchTrendData() {
    let query = supabase.from('posts').select('post_date, platform, likes');
    
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const dateFilter = getDateFilter();
    if (dateFilter) {
      query = query.gte('post_date', dateFilter);
    } else {
      // デフォルトで過去7日間
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('post_date', sevenDaysAgo);
    }

    query = query.order('post_date');

    const { data } = await query;

    if (data) {
      const days = ['日', '月', '火', '水', '木', '金', '土'];
      const dayData = {};

      data.forEach(post => {
        const date = new Date(post.post_date);
        const dayName = days[date.getDay()];
        
        if (!dayData[dayName]) {
          dayData[dayName] = { 
            day: dayName, 
            Instagram: { count: 0, likes: 0 },
            Twitter: { count: 0, likes: 0 }
          };
        }

        if (post.platform === 'Instagram') {
          dayData[dayName].Instagram.count += 1;
          dayData[dayName].Instagram.likes += post.likes || 0;
        } else {
          dayData[dayName].Twitter.count += 1;
          dayData[dayName].Twitter.likes += post.likes || 0;
        }
      });

      const orderedDays = ['月', '火', '水', '木', '金', '土', '日'];
      const trends = orderedDays.map(day => dayData[day] || {
        day,
        Instagram: { count: 0, likes: 0 },
        Twitter: { count: 0, likes: 0 }
      });

      setTrendData(trends);
    }
  }

  async function fetchMenuData() {
    let query = supabase.from('posts').select('menu_keyword, likes, comments, shares');
    
    if (filters.platform !== 'すべて') {
      query = query.eq('platform', filters.platform);
    }

    const dateFilter = getDateFilter();
    if (dateFilter) {
      query = query.gte('post_date', dateFilter);
    }

    const { data } = await query;

    if (data) {
      const menuStats = data.reduce((acc, post) => {
        const menu = post.menu_keyword;
        if (!acc[menu]) {
          acc[menu] = { menu, count: 0, totalEngagement: 0 };
        }
        acc[menu].count += 1;
        acc[menu].totalEngagement += (post.likes || 0) + (post.comments || 0) + (post.shares || 0);
        return acc;
      }, {});

      const menuArray = Object.values(menuStats)
        .map(m => ({
          ...m,
          avgEngagement: m.count > 0 ? (m.totalEngagement / m.count).toFixed(1) : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setMenuData(menuArray);
    }
  }

  async function fetchPosts() {
    let query = supabase
      .from('posts')
      .select('*')
      .not('menu_keyword', 'in', '("_キーワード設定","キーワード設定")')
      .order('post_date', { ascending: false })
      .limit(12);

    if (filters.platform !== 'すべて') {
      query = query.eq('platform', filters.platform);
    }
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const dateFilter = getDateFilter();
    if (dateFilter) {
      query = query.gte('post_date', dateFilter);
    }

    const { data } = await query;
    setPosts(data || []);
  }

  function formatDate(dateString) {
    if (!dateString) return '';
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
        <h1>🍜 はなまるうどん UGCモニタリングダッシュボード</h1>
        <p className={styles.subtitle}>Instagram & Twitter の投稿分析</p>
      </header>

      <div className={styles.refreshSection}>
        <button 
          onClick={handleRefresh}
          disabled={loading}
          className={styles.refreshButton}
        >
          {loading ? '🔄 更新中...' : '🔄 データを更新'}
        </button>
        
        {lastUpdated && (
          <span className={styles.lastUpdated}>
            最終更新: {lastUpdated.toLocaleTimeString('ja-JP')}
          </span>
        )}
      </div>

      <div className={styles.filters}>
        <div className={styles.filterGroup}>
          <label>プラットフォーム</label>
          <select value={filters.platform} onChange={(e) => setFilters({...filters, platform: e.target.value})}>
            <option>すべて</option>
            <option>Instagram</option>
            <option>Twitter</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>メニュー</label>
          <select value={filters.menu} onChange={(e) => setFilters({...filters, menu: e.target.value})}>
            <option>すべて</option>
            <option>天ぷら定期券</option>
            <option>白ごま担々</option>
            <option>3種薬味で食べる豚しゃぶうどん</option>
            <option>スタミナ肉野菜炒めうどん</option>
            <option>焼き塩豚カルビの半割レモンぶっかけ</option>
            <option>ふわとろ明太オムうどん</option>
          </select>
        </div>
        <div className={styles.filterGroup}>
          <label>期間</label>
          <select value={filters.period} onChange={(e) => setFilters({...filters, period: e.target.value})}>
            <option>全期間</option>
            <option>過去7日間</option>
            <option>過去30日間</option>
            <option>過去90日間</option>
          </select>
        </div>
      </div>

      {/* 続きは次のメッセージで */}
            <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>総投稿数</div>
          <div className={styles.statValue}>{stats.totalPosts.toLocaleString()}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>平均エンゲージメント</div>
          <div className={styles.statValue}>{stats.avgEngagement}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>総リーチ数</div>
          <div className={styles.statValue}>{stats.totalReach}K</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>ユニークユーザー</div>
          <div className={styles.statValue}>{stats.uniqueUsers}</div>
        </div>
      </div>

      <div className={styles.chartGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>プラットフォーム別投稿数・エンゲージメント</div>
          <div className={styles.verticalBarChart}>
            {platformData.map(item => (
              <div key={item.platform} className={styles.verticalBarItem}>
                <div className={styles.verticalBarContainer}>
                  <div 
                    className={`${styles.verticalBar} ${item.platform === 'Instagram' ? styles.instagramBar : styles.twitterBar}`}
                    style={{height: `${Math.max(item.percentage, 5)}%`}}
                  >
                    <div className={styles.barTooltip}>
                      <div>投稿: {item.count}</div>
                      <div>❤️ {item.likes}</div>
                      <div>💬 {item.comments}</div>
                    </div>
                  </div>
                  <div className={styles.barValues}>
                    <div className={styles.barValue}>{item.count}投稿</div>
                    <div className={styles.barEngagement}>❤️ {item.likes.toLocaleString()}</div>
                  </div>
                </div>
                <div className={styles.verticalBarLabel}>
                  <div className={`${styles.platformIcon} ${item.platform === 'Instagram' ? styles.instagram : styles.twitter}`}>
                    {item.platform === 'Instagram' ? 'IG' : 'TW'}
                  </div>
                  {item.platform}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>投稿トレンド（過去7日間）</div>
          <div className={styles.trendChart}>
            <div className={styles.trendBars}>
              {trendData.map((item, index) => {
                const maxCount = Math.max(...trendData.map(d => d.Instagram.count + d.Twitter.count));
                const totalCount = item.Instagram.count + item.Twitter.count;
                const heightPercent = maxCount > 0 ? (totalCount / maxCount * 100) : 0;

                return (
                  <div key={index} className={styles.trendBarGroup}>
                    <div className={styles.trendBarContainer}>
                      <div 
                        className={styles.trendBarInstagram}
                        style={{height: `${item.Instagram.count / maxCount * 100}%`}}
                      >
                        <span className={styles.trendBarValue}>{item.Instagram.count}</span>
                      </div>
                      <div 
                        className={styles.trendBarTwitter}
                        style={{height: `${item.Twitter.count / maxCount * 100}%`}}
                      >
                        <span className={styles.trendBarValue}>{item.Twitter.count}</span>
                      </div>
                    </div>
                    <div className={styles.trendBarLabel}>{item.day}</div>
                  </div>
                );
              })}
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColor} ${styles.instagramBar}`}></div>
                <span>Instagram</span>
              </div>
              <div className={styles.legendItem}>
                <div className={`${styles.legendColor} ${styles.twitterBar}`}></div>
                <span>Twitter</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.chartCard} style={{marginBottom: '24px'}}>
        <div className={styles.chartTitle}>メニュー別パフォーマンス</div>
        <div className={styles.hashtagGrid}>
          {menuData.map(item => (
            <div key={item.menu} className={styles.hashtagCard}>
              <div className={styles.hashtagName}>{item.menu}</div>
              <div className={styles.hashtagStats}>
                <span>{item.count}投稿</span>
                <span>{item.avgEngagement}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.postsSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>最新の投稿</div>
        </div>

        <div className={styles.postsGrid}>
          {posts.map(post => (
            <div key={post.id} className={styles.postCard}>
              {post.media_url && post.platform === 'Instagram' && (
                <div className={styles.postImage}>
                  <img src={post.media_url} alt="投稿画像" />
                </div>
              )}
              <div className={styles.postHeader}>
                <div className={styles.postAvatar}>
                  {post.username ? post.username[0].toUpperCase() : post.platform[0]}
                </div>
                <div className={styles.postInfo}>
                  <div className={styles.postUsername}>
                    {post.username || `${post.platform}ユーザー`}
                  </div>
                  <div className={styles.postTime}>
                    {formatDate(post.post_date)} • {post.platform}
                  </div>
                </div>
              </div>
              <div className={styles.postContent}>
                <div className={styles.postText}>
                  {post.content?.substring(0, 150) || '投稿内容がありません'}
                  {post.content?.length > 150 && '...'}
                </div>
                <div className={styles.postHashtag}>
                  #{post.menu_keyword}
                </div>
              </div>
              <div className={styles.postStats}>
                <div className={styles.postStat}>❤️ {post.likes}</div>
                <div className={styles.postStat}>💬 {post.comments}</div>
                {post.shares > 0 && <div className={styles.postStat}>🔄 {post.shares}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

