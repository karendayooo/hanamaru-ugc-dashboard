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
  const [platformEngagementData, setPlatformEngagementData] = useState([]);
  const [menuData, setMenuData] = useState([]);
  const [instagramPosts, setInstagramPosts] = useState([]);
  const [twitterPosts, setTwitterPosts] = useState([]);
  const [filters, setFilters] = useState({
    platform: 'すべて',
    menu: 'すべて',
    period: '全期間'
  });
  const [loading, setLoading] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    let mounted = true;
    
    async function loadData() {
      if (mounted) {
        await fetchDashboardData();
      }
    }
    
    loadData();
    
    return () => {
      mounted = false;
    };
  }, [filters.platform, filters.menu, filters.period]);

  async function fetchDashboardData() {
    await Promise.all([
      fetchStats(),
      fetchPlatformData(),
      fetchPlatformEngagementData(),
      fetchMenuData(),
      fetchInstagramPosts(),
      fetchTwitterPosts()
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

  async function fetchPlatformEngagementData() {
    let query = supabase.from('posts').select('post_date, platform, likes');
    
    if (filters.menu !== 'すべて') {
      query = query.eq('menu_keyword', filters.menu);
    }

    const dateFilter = getDateFilter();
    if (dateFilter) {
      query = query.gte('post_date', dateFilter);
    } else {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      query = query.gte('post_date', fiveDaysAgo);
    }

    query = query.order('post_date');

    const { data } = await query;

    if (data && data.length > 0) {
      const today = new Date();
      const last5Days = [];
      for (let i = 4; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        last5Days.push(date);
      }

      const dayData = {};

      data.forEach(post => {
        const date = new Date(post.post_date);
        const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
        
        if (!dayData[dateKey]) {
          dayData[dateKey] = { 
            day: dateKey,
            Instagram: { count: 0, likes: 0 },
            Twitter: { count: 0, likes: 0 }
          };
        }

        if (post.platform === 'Instagram') {
          dayData[dateKey].Instagram.count += 1;
          dayData[dateKey].Instagram.likes += post.likes || 0;
        } else {
          dayData[dateKey].Twitter.count += 1;
          dayData[dateKey].Twitter.likes += post.likes || 0;
        }
      });

      const trends = last5Days.map(date => {
        const dateKey = `${date.getMonth() + 1}/${date.getDate()}`;
        return dayData[dateKey] || {
          day: dateKey,
          Instagram: { count: 0, likes: 0 },
          Twitter: { count: 0, likes: 0 }
        };
      });

      setPlatformEngagementData(trends);
    } else {
      setPlatformEngagementData([]);
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

  async function fetchInstagramPosts() {
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('platform', 'Instagram')
        .not('menu_keyword', 'in', '("_キーワード設定","キーワード設定")')
        .order('post_date', { ascending: false })
        .limit(6);

      if (filters.menu !== 'すべて') {
        query = query.eq('menu_keyword', filters.menu);
      }

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('post_date', dateFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Instagram投稿取得エラー:', error);
        setInstagramPosts([]);
      } else {
        setInstagramPosts(data || []);
      }
    } catch (error) {
      console.error('Instagram投稿取得エラー:', error);
      setInstagramPosts([]);
    }
  }

  async function fetchTwitterPosts() {
    try {
      let query = supabase
        .from('posts')
        .select('*')
        .eq('platform', 'Twitter')
        .not('menu_keyword', 'in', '("_キーワード設定","キーワード設定")')
        .order('post_date', { ascending: false })
        .limit(6);

      if (filters.menu !== 'すべて') {
        query = query.eq('menu_keyword', filters.menu);
      }

      const dateFilter = getDateFilter();
      if (dateFilter) {
        query = query.gte('post_date', dateFilter);
      }

      const { data, error } = await query;
      
      if (error) {
        console.error('Twitter投稿取得エラー:', error);
        setTwitterPosts([]);
      } else {
        setTwitterPosts(data || []);
      }
    } catch (error) {
      console.error('Twitter投稿取得エラー:', error);
      setTwitterPosts([]);
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
        {/* プラットフォーム別投稿数・エンゲージメント（時間軸） */}
        <div className={styles.chartCard} style={{gridColumn: '1 / -1'}}>
          <div className={styles.chartTitle}>プラットフォーム別投稿数・エンゲージメント（過去5日間）</div>

          {platformEngagementData.length === 0 ? (
            <div className={styles.noData}>データがありません</div>
          ) : (
            <div className={styles.comboChart}>
              <div className={styles.comboChartContainer}>
                <div className={styles.yAxisLeft}>
                  <div className={styles.yAxisLabel}>投稿数</div>
                  <div className={styles.yAxisTicks}>
                    {(() => {
                      const maxCount = Math.max(
                        ...platformEngagementData.map(d => Math.max(d.Instagram.count, d.Twitter.count)), 
                        1
                      );
                      const step = Math.max(2, Math.ceil(maxCount / 5) * 2);
                      return [5, 4, 3, 2, 1, 0].map(i => (
                        <div key={i} className={styles.yAxisTick}>{step * i}</div>
                      ));
                    })()}
                  </div>
                </div>

                <div className={styles.comboChartArea}>
                  <div className={styles.gridLines}>
                    {[0, 1, 2, 3, 4, 5].map(i => (
                      <div key={i} className={styles.gridLine}></div>
                    ))}
                  </div>

                  <div className={styles.barsContainer}>
                    {platformEngagementData.map((item, index) => {
                      const maxCount = Math.max(
                        ...platformEngagementData.map(d => Math.max(d.Instagram.count, d.Twitter.count)), 
                        1
                      );
                      const step = Math.max(2, Math.ceil(maxCount / 5) * 2);
                      const maxValue = step * 5;
                      
                      const instagramHeight = (item.Instagram.count / maxValue) * 100;
                      const twitterHeight = (item.Twitter.count / maxValue) * 100;

                      return (
                        <div key={index} className={styles.barWrapper}>
                          <div className={styles.stackedBars}>
                            {item.Instagram.count > 0 && (
                              <div 
                                className={`${styles.comboBar} ${styles.instagramBar}`}
                                style={{height: `${Math.max(instagramHeight, 8)}%`}}
                              >
                                <div className={styles.barValueTop}>{item.Instagram.count}</div>
                              </div>
                            )}
                            {item.Twitter.count > 0 && (
                              <div 
                                className={`${styles.comboBar} ${styles.twitterBar}`}
                                style={{height: `${Math.max(twitterHeight, 8)}%`}}
                              >
                                <div className={styles.barValueTop}>{item.Twitter.count}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {platformEngagementData && platformEngagementData.length >= 2 && (
                    <div className={styles.lineChartWrapper}>
                      <svg 
                        className={styles.lineChart} 
                        viewBox="0 0 100 100" 
                        preserveAspectRatio="none"
                      >
                        {/* Instagram いいね数の折れ線 */}
                        <polyline
                          points={platformEngagementData.map((item, index) => {
                            const maxLikes = Math.max(
                              ...platformEngagementData.map(d => Math.max(d.Instagram.likes, d.Twitter.likes)), 
                              1
                            );
                            const step = Math.max(10, Math.ceil(maxLikes / 5 / 10) * 10);
                            const maxValue = step * 5;
                            const x = ((index + 0.5) / platformEngagementData.length) * 100;
                            const y = 95 - ((item.Instagram.likes / maxValue) * 85);
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#f97316"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            filter: 'drop-shadow(0 2px 4px rgba(249, 115, 22, 0.4))',
                            vectorEffect: 'non-scaling-stroke'
                          }}
                        />
                        
                        {/* Twitter いいね数の折れ線 */}
                        <polyline
                          points={platformEngagementData.map((item, index) => {
                            const maxLikes = Math.max(
                              ...platformEngagementData.map(d => Math.max(d.Instagram.likes, d.Twitter.likes)), 
                              1
                            );
                            const step = Math.max(10, Math.ceil(maxLikes / 5 / 10) * 10);
                            const maxValue = step * 5;
                            const x = ((index + 0.5) / platformEngagementData.length) * 100;
                            const y = 95 - ((item.Twitter.likes / maxValue) * 85);
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke="#1DA1F2"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            filter: 'drop-shadow(0 2px 4px rgba(29, 161, 242, 0.4))',
                            vectorEffect: 'non-scaling-stroke'
                          }}
                        />
                        
                        {/* Instagram ポイント */}
                        {platformEngagementData.map((item, index) => {
                          if (item.Instagram.likes === 0) return null;
                          
                          const maxLikes = Math.max(
                            ...platformEngagementData.map(d => Math.max(d.Instagram.likes, d.Twitter.likes)), 
                            1
                          );
                          const step = Math.max(10, Math.ceil(maxLikes / 5 / 10) * 10);
                          const maxValue = step * 5;
                          const x = ((index + 0.5) / platformEngagementData.length) * 100;
                          const y = 95 - ((item.Instagram.likes / maxValue) * 85);
                          return (
                            <g key={`ig-${index}`}>
                              <ellipse 
                                cx={x} 
                                cy={y} 
                                rx="0.6"
                                ry="1.5"
                                fill="#f97316"
                                stroke="white"
                                strokeWidth="1"
                                style={{
                                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
                                }}
                                vectorEffect="non-scaling-stroke"
                              />
                              <text 
                                x={x} 
                                y={y - 3} 
                                fill="#f97316"
                                fontSize="3.5"
                                fontWeight="600"
                                textAnchor="middle"
                                stroke="white"
                                strokeWidth="0.7"
                                paintOrder="stroke"
                                style={{
                                  transform: 'scale(0.35, 1)',
                                  transformOrigin: `${x}% ${y}%`
                                }}
                              >
                                {item.Instagram.likes}
                              </text>
                            </g>
                          );
                        })}
                        
                        {/* Twitter ポイント */}
                        {platformEngagementData.map((item, index) => {
                          if (item.Twitter.likes === 0) return null;
                          
                          const maxLikes = Math.max(
                            ...platformEngagementData.map(d => Math.max(d.Instagram.likes, d.Twitter.likes)), 
                            1
                          );
                          const step = Math.max(10, Math.ceil(maxLikes / 5 / 10) * 10);
                          const maxValue = step * 5;
                          const x = ((index + 0.5) / platformEngagementData.length) * 100;
                          const y = 95 - ((item.Twitter.likes / maxValue) * 85);
                          return (
                            <g key={`tw-${index}`}>
                              <ellipse 
                                cx={x} 
                                cy={y} 
                                rx="0.6"
                                ry="1.5"
                                fill="#1DA1F2"
                                stroke="white"
                                strokeWidth="1"
                                style={{
                                  filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))'
                                }}
                                vectorEffect="non-scaling-stroke"
                              />
                              <text 
                                x={x} 
                                y={y + 8}
                                fill="#1DA1F2"
                                fontSize="3.5"
                                fontWeight="600"
                                textAnchor="middle"
                                stroke="white"
                                strokeWidth="0.7"
                                paintOrder="stroke"
                                style={{
                                  transform: 'scale(0.35, 1)',
                                  transformOrigin: `${x}% ${y}%`
                                }}
                              >
                                {item.Twitter.likes}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>
                  )}
                </div>

                <div className={styles.yAxisRight}>
                  <div className={styles.yAxisLabel}>いいね数</div>
                  <div className={styles.yAxisTicks}>
                    {(() => {
                      const maxLikes = Math.max(
                        ...platformEngagementData.map(d => Math.max(d.Instagram.likes, d.Twitter.likes)), 
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

              <div className={styles.xAxisLabels}>
                {platformEngagementData.map((item, index) => (
                  <div key={index} className={styles.xAxisLabel}>
                    {item.day}
                  </div>
                ))}
              </div>

              <div className={styles.chartLegend}>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendColor} ${styles.instagramBar}`}></div>
                  <span>Instagram 投稿数</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={`${styles.legendColor} ${styles.twitterBar}`}></div>
                  <span>Twitter 投稿数</span>
                </div>
                <div className={styles.legendItem}>
                  <div style={{width: '28px', height: '3px', background: '#f97316', borderRadius: '2px'}}></div>
                  <span>Instagram いいね</span>
                </div>
                <div className={styles.legendItem}>
                  <div style={{width: '28px', height: '3px', background: '#1DA1F2', borderRadius: '2px'}}></div>
                  <span>Twitter いいね</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instagram & Twitter 投稿セクション */}
      <div className={styles.postsSection}>
        <div className={styles.sectionHeader}>
          <h2 className={styles.sectionTitle}>最新の投稿</h2>
        </div>
        
        <div className={styles.platformPostsContainer}>
          {/* Instagram投稿 */}
          <div className={styles.platformColumn}>
            <div className={styles.platformColumnHeader}>
              <div className={`${styles.platformIcon} ${styles.instagram}`}>IG</div>
              <h3>Instagram</h3>
            </div>
            <div className={styles.postsColumn}>
              {instagramPosts.length > 0 ? (
                instagramPosts.map((post, index) => (
                  <div key={index} className={styles.postCard}>
                    {post.media_url && (
                      <div className={styles.postImage}>
                        <img src={post.media_url} alt="Instagram投稿" />
                      </div>
                    )}
                    <div className={styles.postHeader}>
                      <div className={styles.postAvatar}>
                        {post.username ? post.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className={styles.postInfo}>
                        <div className={styles.postUsername}>@{post.username || 'unknown'}</div>
                        <div className={styles.postTime}>{formatDate(post.post_date)}</div>
                      </div>
                    </div>
                    <div className={styles.postContent}>
                      <p className={styles.postText}>
                        {post.content && post.content.trim() !== '' 
                          ? (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)
                          : post.menu_keyword && post.menu_keyword !== '_キーワード設定' && post.menu_keyword !== 'キーワード設定'
                            ? `#${post.menu_keyword} についての投稿`
                            : 'Instagram投稿'}
                      </p>
                      {post.menu_keyword && post.menu_keyword !== '_キーワード設定' && post.menu_keyword !== 'キーワード設定' && (
                        <span className={styles.postHashtag}>#{post.menu_keyword}</span>
                      )}
                    </div>
                    <div className={styles.postStats}>
                      <div className={styles.postStat}>❤️ {(post.likes || 0).toLocaleString()}</div>
                      <div className={styles.postStat}>💬 {(post.comments || 0).toLocaleString()}</div>
                      <div className={styles.postStat}>🔄 {(post.shares || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noData}>投稿がありません</div>
              )}
            </div>
          </div>

          {/* Twitter投稿 */}
          <div className={styles.platformColumn}>
            <div className={styles.platformColumnHeader}>
              <div className={`${styles.platformIcon} ${styles.twitter}`}>X</div>
              <h3>Twitter</h3>
            </div>
            <div className={styles.postsColumn}>
              {twitterPosts.length > 0 ? (
                twitterPosts.map((post, index) => (
                  <div key={index} className={styles.postCard}>
                    {post.media_url && (
                      <div className={styles.postImage}>
                        <img src={post.media_url} alt="Twitter投稿" />
                      </div>
                    )}
                    <div className={styles.postHeader}>
                      <div className={styles.postAvatar}>
                        {post.username ? post.username.charAt(0).toUpperCase() : 'U'}
                      </div>
                      <div className={styles.postInfo}>
                        <div className={styles.postUsername}>@{post.username || 'unknown'}</div>
                        <div className={styles.postTime}>{formatDate(post.post_date)}</div>
                      </div>
                    </div>
                    <div className={styles.postContent}>
                      <p className={styles.postText}>
                        {post.content && post.content.trim() !== '' 
                          ? (post.content.length > 150 ? post.content.substring(0, 150) + '...' : post.content)
                          : post.menu_keyword && post.menu_keyword !== '_キーワード設定' && post.menu_keyword !== 'キーワード設定'
                            ? `#${post.menu_keyword} についての投稿`
                            : 'Twitter投稿'}
                      </p>
                      {post.menu_keyword && post.menu_keyword !== '_キーワード設定' && post.menu_keyword !== 'キーワード設定' && (
                        <span className={styles.postHashtag}>#{post.menu_keyword}</span>
                      )}
                    </div>
                    <div className={styles.postStats}>
                      <div className={styles.postStat}>❤️ {(post.likes || 0).toLocaleString()}</div>
                      <div className={styles.postStat}>💬 {(post.comments || 0).toLocaleString()}</div>
                      <div className={styles.postStat}>🔄 {(post.shares || 0).toLocaleString()}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className={styles.noData}>投稿がありません</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
