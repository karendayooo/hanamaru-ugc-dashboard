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
  const [menuData, setMenuData] = useState([]);
  const [posts, setPosts] = useState([]);
  const [filters, setFilters] = useState({
    platform: 'すべて',
    menu: 'すべて'
  });

  useEffect(() => {
    fetchDashboardData();
  }, [filters]);

  async function fetchDashboardData() {
    await Promise.all([
      fetchStats(),
      fetchPlatformData(),
      fetchMenuData(),
      fetchPosts()
    ]);
  }

  async function fetchStats() {
    let query = supabase.from('posts').select('*');
    
    if (filters.platform !== 'すべて') {
      query = query.eq('platform', filters.platform);
    }
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
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
    let query = supabase.from('posts').select('platform');
    
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const { data } = await query;

    if (data) {
      const counts = data.reduce((acc, post) => {
        acc[post.platform] = (acc[post.platform] || 0) + 1;
        return acc;
      }, {});

      const total = data.length;
      setPlatformData([
        { 
          platform: 'Instagram', 
          count: counts.Instagram || 0, 
          percentage: total > 0 ? (counts.Instagram || 0) / total * 100 : 0 
        },
        { 
          platform: 'Twitter', 
          count: counts.Twitter || 0, 
          percentage: total > 0 ? (counts.Twitter || 0) / total * 100 : 0 
        }
      ]);
    }
  }

  async function fetchMenuData() {
    let query = supabase.from('posts').select('menu_keyword, likes, comments, shares');
    
    if (filters.platform !== 'すべて') {
      query = query.eq('platform', filters.platform);
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
      .limit(6);

    if (filters.platform !== 'すべて') {
      query = query.eq('platform', filters.platform);
    }
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const { data, error } = await query;
    
    // デバッグ用
    if (error) {
      console.error('Error fetching posts:', error);
    }
    if (data) {
      console.log('Fetched posts:', data);
    }
    
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
      </div>

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
          <div className={styles.chartTitle}>プラットフォーム別投稿数</div>
          <div className={styles.barChart}>
            {platformData.map(item => (
              <div key={item.platform} className={styles.barItem}>
                <div className={styles.barLabel}>
                  <div className={`${styles.platformIcon} ${item.platform === 'Instagram' ? styles.instagram : styles.twitter}`}>
                    {item.platform === 'Instagram' ? 'IG' : 'TW'}
                  </div>
                  {item.platform}
                </div>
                <div className={styles.barContainer}>
                  <div className={styles.barFill} style={{width: `${item.percentage}%`}}>
                    <span className={styles.barValue}>{item.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.chartCard}>
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
      </div>

      <div className={styles.postsSection}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>最新の投稿</div>
        </div>

        <div className={styles.postsGrid}>
          {posts.map(post => (
            <div key={post.id} className={styles.postCard}>
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
