import express from 'express';
import cors from 'cors';
import { VIDEO_SOURCES } from '../config/sources.js';
import { NETFLIX_ARTWORK } from '../config/netflixArtwork.js';

const api = express();
api.use(cors());
api.use(express.json());

// In-memory cache
const cache = new Map();
function getCache(key, ttlMs = 300000) {
  const item = cache.get(key);
  if (item && Date.now() - item.time < ttlMs) {
    return item.data;
  }
  return null;
}
function setCache(key, data) {
  cache.set(key, { time: Date.now(), data });
}

// Helper: check if a URL is a directly playable media stream (not an unplayable web player/share page)
function isPlayableStreamUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const clean = url.trim().toLowerCase();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) return false;
  // Non-stream web player / share / embed iframe pages that cannot be played inside <video> or Hls.js
  if (clean.includes('/share/') || (clean.includes('/play/') && !clean.includes('.m3u8') && !clean.includes('.mp4'))) {
    return false;
  }
  if (clean.endsWith('.html') || clean.endsWith('.htm') || clean.endsWith('.php')) {
    return false;
  }
  return true;
}

// Utility: parse MacCMS vod_play_url and vod_play_from into structured episode groups with priority for playable direct streams
function parseVodPlayUrl(rawPlayUrl, rawPlayFrom) {
  if (!rawPlayUrl) return [];
  const playListGroups = [];
  const playFroms = (rawPlayFrom || '').split('$$$');
  const playUrlSets = rawPlayUrl.split('$$$');

  playUrlSets.forEach((setStr, idx) => {
    const rawFrom = (playFroms[idx] || '').trim();
    const fromName = rawFrom || `线路 ${idx + 1}`;
    const episodes = [];
    // Split episodes by #, \r\n, \n, or \r
    const epStrings = setStr.split(/#|[\r\n]+/);
    epStrings.forEach((epStr) => {
      const trimmed = epStr.trim();
      if (!trimmed) return;
      const parts = trimmed.split('$');
      let name = '';
      let url = '';
      if (parts.length >= 2) {
        name = parts[0].trim();
        url = parts.slice(1).join('$').replace(/[\r\n\t]/g, '').trim();
      } else if (parts.length === 1 && /^https?:\/\//i.test(parts[0].trim())) {
        name = `第 ${episodes.length + 1} 集`;
        url = parts[0].replace(/[\r\n\t]/g, '').trim();
      }
      if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
        episodes.push({ name: name || `第 ${episodes.length + 1} 集`, url });
      }
    });
    if (episodes.length > 0) {
      playListGroups.push({ from: fromName, episodes });
    }
  });

  if (playListGroups.length <= 1) return playListGroups;

  // Rank and prioritize playable stream lines (e.g. .m3u8, .mp4) over web player / share wrapper pages
  const scoredGroups = playListGroups.map((group) => {
    let m3u8Count = 0;
    let playableCount = 0;
    group.episodes.forEach((ep) => {
      const u = ep.url.toLowerCase();
      if (u.includes('.m3u8') || u.includes('.mp4') || u.includes('.m4v') || u.includes('.webm')) {
        m3u8Count++;
        playableCount++;
      } else if (isPlayableStreamUrl(ep.url)) {
        playableCount++;
      }
    });

    const fromLower = group.from.toLowerCase();
    const isM3u8From = fromLower.includes('m3u8');
    const isWebEmbed = fromLower.includes('yun') || fromLower.includes('share') || fromLower.includes('dp');

    let score = m3u8Count * 2 + playableCount;
    if (isM3u8From) score += 100;
    if (isWebEmbed && !isM3u8From) score -= 50;

    return { group, score, m3u8Count, playableCount };
  });

  // If there are groups with valid media streams, filter out unplayable web-player iframe wrapper pages
  const hasPlayable = scoredGroups.some((sg) => sg.playableCount > 0);
  const filtered = hasPlayable ? scoredGroups.filter((sg) => sg.playableCount > 0) : scoredGroups;

  filtered.sort((a, b) => b.score - a.score);
  return filtered.map((sg) => sg.group);
}

function hasValidCover(cover) {
  if (!cover || typeof cover !== 'string') return false;
  const trimmed = cover.trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  if (
    lower === 'nopic' ||
    lower === 'no_pic' ||
    lower === 'default' ||
    lower === 'null' ||
    lower === 'undefined' ||
    lower.includes('nopic') ||
    lower.includes('no_pic') ||
    lower.includes('default.jpg') ||
    lower.includes('default.png')
  ) {
    return false;
  }
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith('/api/proxy/image');
}

// 1. Status API
api.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    totalSources: VIDEO_SOURCES.length,
    sources: VIDEO_SOURCES,
  });
});

// 2. Douban Catalog API (Supports legacy tags & modern multi-dimensional Sort & Filter)
api.get('/api/douban', async (req, res) => {
  const {
    type = 'movie',
    tag,
    sort = 'U',
    genres,
    countries,
    year_range,
    range = '0,10',
    limit = 24,
    start = 0,
  } = req.query;

  const hasAdvancedFilters = genres || countries || year_range || sort !== 'U' || range !== '0,10';
  const cacheKey = `douban_${type}_${tag || 'none'}_${sort}_${genres || 'all'}_${countries || 'all'}_${year_range || 'all'}_${range}_${limit}_${start}`;
  const cached = getCache(cacheKey, 600000);
  if (cached) return res.json(cached);

  try {
    let url;
    if (hasAdvancedFilters || !tag) {
      // Use Douban's multi-dimensional filter API
      const tagsParam = type === 'tv' ? '电视剧' : '电影';
      const q = new URLSearchParams({
        sort: String(sort),
        range: String(range),
        tags: tagsParam,
        start: String(start),
        limit: String(limit),
      });
      if (genres && genres !== 'all') q.set('genres', String(genres));
      if (countries && countries !== 'all') q.set('countries', String(countries));
      if (year_range && year_range !== 'all') q.set('year_range', String(year_range));

      url = `https://movie.douban.com/j/new_search_subjects?${q.toString()}`;
    } else {
      url = `https://movie.douban.com/j/search_subjects?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}&page_limit=${limit}&page_start=${start}`;
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Referer: 'https://movie.douban.com/',
      },
    });
    if (!response.ok) throw new Error(`Douban returned ${response.status}`);
    const data = await response.json();

    let subjects = [];
    if (data.data && Array.isArray(data.data)) {
      subjects = data.data.map((item) => ({
        id: item.id,
        title: item.title,
        rate: item.rate,
        cover: item.cover,
        directors: item.directors,
        casts: item.casts,
      }));
    } else if (data.subjects && Array.isArray(data.subjects)) {
      subjects = data.subjects;
    }

    // Strict filter for Movie category: filter out domestic variety shows & gala specials
    if (type === 'movie') {
      const varietyRegex = /(综艺|真人秀|脱口秀|大侦探|明星大侦探|密室大逃脱|奔跑吧|跑男|极限挑战|王牌对王牌|乘风破浪|披荆斩棘|再见爱人|花儿与少年|五十公里桃花坞|桃花坞|向往的生活|声生不息|种地吧|喜人奇妙夜|一年一度喜剧大赛|你好星期六|快乐大本营|天天向上|这就是街舞|非诚勿扰|中餐厅|天赐的声音|中国好声音|中国新说唱|说唱新世代|萌探|萌探探探案|半熟恋人|心动的信号|奇葩说|吐槽大会|乐队的夏天|最强大脑|创造营|青春有你|偶像练习生|歌手|爸爸去哪儿|欢乐喜剧人|笑傲江湖|跨界歌王|蒙面唱将|时光音乐会|我们的歌|少年之名|中国达人秀|无限超越班|毛雪汪|女子推理社|跳进地理书的旅行|森林进化论|名侦探学院|超新星|德云斗笑社|春晚|春节联欢晚会|跨年晚会|跨年演唱会|元宵晚会|中秋晚会|第[0-9一二三四五六七八九十]+期|第[0-9一二三四五六七八九十]+季|\b20\d\d[-/年]\d+[-/月]\d+期?)/i;
      subjects = subjects.filter((item) => {
        if (!item || !item.title) return false;
        if (varietyRegex.test(item.title)) return false;
        if (item.episodes_info && /期|集/.test(item.episodes_info)) return false;
        return true;
      });
    }

    const result = { subjects };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Douban API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Douban catalog' });
  }
});

// Netflix Chinese Title & Poster Mapping for Global Hits
const NETFLIX_TITLE_MAP = {
  'Wednesday': '星期三',
  'Squid Game': '鱿鱼游戏',
  'Stranger Things': '怪奇物语',
  'Stranger Things 4': '怪奇物语 第四季',
  'Stranger Things 5': '怪奇物语 第五季',
  'Red Notice': '红色通缉令',
  'The Queen\'s Gambit': '后翼弃兵',
  'Money Heist': '纸钞屋',
  'Lupin': '绅士怪盗',
  'Bridgerton': '布里奇顿',
  'Don\'t Look Up': '不要抬头',
  'The Adam Project': '亚当计划',
  'Bird Box': '蒙上你的眼',
  'Leave the World Behind': '断讯',
  'Troll': '山怪巨魔',
  'Under Paris': '巴黎深渊',
  'Society of the Snow': '绝境盟约',
  'The Platform': '饥饿站台',
  'Nowhere': '无处逢生',
  'Animals': '动物',
  'Carry-On': '随身行李',
  'Back in Action': '重返行动',
  'War Machine': '战争机器',
  'Exterritorial': '治外法权',
  'The Great Flood': '大洪水',
  'Counterattack': '反击',
  'Adolescence': '青春期',
  'DAHMER': '达莫',
  'The Diplomat': '头号外交官',
  'Nobody Wants This': '没人想要这个',
  'Below': '下层',
  'Love Is Blind': '盲婚试爱',
  'Ice Age': '冰川时代',
  'Ice Age 4': '冰川时代4：大陆漂移',
  'Ice Age 5': '冰川时代5：星际碰撞',
  'This Is Not a Test': '这绝非演习',
  'Aliens in the Attic': '楼上的外星人',
  'Baththa': '巴塔',
  'You, Me, Us': '你，我，我们',
  'Dorothy': '桃乐丝',
  'The Birthday Gift': '生日礼物',
  'Dhoomakethu': '彗星',
  'Minimum Wage': '最低工资',
  'Return to Sender': '退件',
  'Surviving Hurricane Otis': '幸存奥蒂斯飓风',
  'Collision Course': '碰撞轨迹',
  'East of Eden': '伊甸之东',
  'From': '梦魇绝镇',
  'KPop Demon Hunters': '猎魔女团',
  'Hot Wheels Let\'s Race': '风火轮大飞车',
  'Swapped': '身份互换',
  'Ad Vitam': '永生',
  'Brick': '砖块',
  'Gajab Raat': '奇妙之夜',
  'The Paradise': '天堂',
  'The Secret Woman': '秘密女人',
  'The One About Matthew Perry': '致敬马修·派瑞',
  'Raw': 'WWE Raw',
  'Raw: 2026': 'WWE Raw 2026',
  'Instadocs': '简·多伊案',
  'The Fall of El Mayo': '大毒枭的陨落',
  'Dead-End Job': '绝路工作',
  'Doctor X': 'X医生：白衣黑帮',
  'Doctor X: Mafia in White': 'X医生：白衣黑帮',
  'Teach You a Lesson': '给你上一课',
  'A Couple of Lies': '谎言夫妇',
  'Where the Mask Ends': '面具之下',
  'The Gift of Deceit': '欺骗之礼',
  'I Will Find You': '我会找到你',
  'La Palma': '拉帕尔马海啸',
};

// Helper: extract sized image URLs from Netflix GraphQL pulse image object
function getArtworkUrl(artObj) {
  if (!artObj) return '';
  for (const [k, v] of Object.entries(artObj)) {
    if (k.startsWith('urlsSized') && Array.isArray(v) && v.length > 0) {
      return v[0]?.url || '';
    }
  }
  return '';
}

function normalizeNetflixCategory(cat) {
  if (!cat) return '';
  const upper = cat.toUpperCase();
  if (upper.includes('ENGLISH') && upper.includes('MOVIES') && !upper.includes('NON')) return 'films_en';
  if (upper.includes('NON') && upper.includes('MOVIES')) return 'films_non_en';
  if (upper.includes('ENGLISH') && upper.includes('SERIES') && !upper.includes('NON')) return 'tv_en';
  if (upper.includes('NON') && upper.includes('SERIES')) return 'tv_non_en';
  return cat.toLowerCase();
}

let netflixArtworkCache = { weekly: null, popular: null, time: 0 };

async function fetchNetflixArtworkMap(mode = 'weekly') {
  const now = Date.now();
  if (netflixArtworkCache[mode] && now - netflixArtworkCache.time < 21600000) {
    return netflixArtworkCache[mode];
  }

  const urls = mode === 'popular'
    ? [
        'https://top10.netflix.com/most-popular',
        'https://top10.netflix.com/most-popular/films-non-english',
        'https://top10.netflix.com/most-popular/tv',
        'https://top10.netflix.com/most-popular/tv-non-english',
      ]
    : [
        'https://top10.netflix.com/films',
        'https://top10.netflix.com/films-non-english',
        'https://top10.netflix.com/tv',
        'https://top10.netflix.com/tv-non-english',
      ];

  const map = new Map();
  try {
    const fetchPromises = urls.map(async (url) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        });
        clearTimeout(timeoutId);
        if (!res.ok) return;
        const html = await res.text();
        const marker = "netflix.reactContext.models.graphql = JSON.parse('";
        const idx = html.indexOf(marker);
        if (idx === -1) return;
        const endMarker = "');";
        const endIdx = html.indexOf(endMarker, idx + marker.length);
        const jsonStr = html.substring(idx + marker.length, endIdx).replace(/\\'/g, "'").replace(/\\\\/g, '\\');
        const parsed = JSON.parse(jsonStr);
        const items = Object.values(parsed.data || {}).filter((x) => x && x.__typename === 'PulseTop10ItemEntity');
        for (const it of items) {
          const catKey = normalizeNetflixCategory(it.top10?.category);
          const rank = it.top10?.weeklyRank;
          const cover = getArtworkUrl(it.artwork?.storyArt) || getArtworkUrl(it.artwork?.sdpArt);
          const thumb = getArtworkUrl(it.artwork?.sdpArt) || cover;
          const logo = getArtworkUrl(it.artwork?.logoArt);
          const synopsis = it.top10Video?.shortSynopsis || '';
          const title = it.top10Video?.title || '';
          const parentTitle = it.top10Video?.parentShow?.title || '';
          const year = it.top10Video?.releaseYear;
          const rating = it.top10Video?.maturityRating;

          const artData = { cover, thumb, logo, synopsis, title, parentTitle, year, rating };
          if (catKey && rank) map.set(`${catKey}_${rank}`, artData);
          if (title) map.set(title.toLowerCase().trim(), artData);
          if (parentTitle) map.set(parentTitle.toLowerCase().trim(), artData);
        }
      } catch {
        clearTimeout(timeoutId);
      }
    });

    await Promise.allSettled(fetchPromises);
    if (map.size > 0) {
      netflixArtworkCache[mode] = map;
      netflixArtworkCache.time = now;
      return map;
    }
  } catch (err) {
    console.error('Error fetching live Netflix artwork:', err.message);
  }

  return null;
}

function resolveNetflixArtwork(artMap, mode, catKey, rank, showTitle) {
  if (artMap) {
    const byRank = artMap.get(`${catKey}_${rank}`);
    if (byRank && byRank.cover) return byRank;
    const byTitle = artMap.get(showTitle.toLowerCase().trim());
    if (byTitle && byTitle.cover) return byTitle;
  }
  const fallbackMode = NETFLIX_ARTWORK[mode] || {};
  if (fallbackMode[`${catKey}_${rank}`]) {
    return fallbackMode[`${catKey}_${rank}`];
  }
  const byTitleFallback = NETFLIX_ARTWORK.byTitle || {};
  if (byTitleFallback[showTitle.toLowerCase().trim()]) {
    return byTitleFallback[showTitle.toLowerCase().trim()];
  }
  return {};
}

// 3. Netflix Official Top 10 Public Data API (top10.netflix.com)
api.get('/api/netflix', async (req, res) => {
  const { mode = 'weekly', category = 'all' } = req.query; // mode: 'weekly' | 'popular'
  const cacheKey = `netflix_top10_${mode}_${category}`;
  const cached = getCache(cacheKey, 1800000); // 30 min cache
  if (cached) return res.json(cached);

  try {
    const artworkMap = await fetchNetflixArtworkMap(mode);

    if (mode === 'popular') {
      const url = 'https://top10.netflix.com/data/most-popular.tsv';
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      if (!response.ok) throw new Error(`Netflix responded ${response.status}`);
      const text = await response.text();
      const lines = text.split(/\r?\n|\r/).filter(Boolean);
      const items = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length >= 7) {
          const rawCat = cols[0].trim();
          const rank = parseInt(cols[1], 10);
          const showTitle = cols[2].trim();
          const seasonTitle = cols[3].trim() === 'N/A' ? '' : cols[3].trim();
          const hours = Number(cols[4]) || 0;
          const runtime = Number(cols[5]) || 0;
          const views = Number(cols[6]) || 0;

          let catKey = 'other';
          if (rawCat.includes('Films') && rawCat.includes('English') && !rawCat.includes('Non-English')) catKey = 'films_en';
          else if (rawCat.includes('Films') && rawCat.includes('Non-English')) catKey = 'films_non_en';
          else if (rawCat.includes('TV') && rawCat.includes('English') && !rawCat.includes('Non-English')) catKey = 'tv_en';
          else if (rawCat.includes('TV') && rawCat.includes('Non-English')) catKey = 'tv_non_en';

          if (category === 'all' || category === catKey) {
            const cnName = NETFLIX_TITLE_MAP[showTitle] || '';
            const displayTitle = cnName ? `${showTitle} (${cnName})` : showTitle;
            const viewsStr = views >= 100000000 ? `${(views / 100000000).toFixed(2)}亿次` : `${(views / 10000).toFixed(0)}万次`;
            const hoursStr = hours >= 100000000 ? `${(hours / 100000000).toFixed(2)}亿小时` : `${(hours / 10000).toFixed(0)}万小时`;
            const art = resolveNetflixArtwork(artworkMap, 'popular', catKey, rank, showTitle);

            items.push({
              id: `netflix_pop_${catKey}_${rank}`,
              rank,
              title: displayTitle,
              originalTitle: showTitle,
              cnTitle: cnName,
              season: seasonTitle,
              category: rawCat.includes('Films') ? '电影' : '剧集',
              netflixCategory: rawCat,
              catKey,
              hours,
              runtime,
              views,
              hoursFormatted: hoursStr,
              viewsFormatted: viewsStr,
              remarks: `总观看 ${viewsStr}`,
              cover: art.cover || art.thumb || '',
              thumb: art.thumb || art.cover || '',
              backdrop: art.cover || '',
              logo: art.logo || '',
              overview: art.synopsis || '',
              content: art.synopsis || '',
              year: art.year ? String(art.year) : '',
              rate: art.rating || '',
            });
          }
        }
      }
      const result = { mode, category, total: items.length, items };
      setCache(cacheKey, result);
      return res.json(result);
    } else {
      // mode === 'weekly'
      const url = 'https://top10.netflix.com/data/all-weeks-global.tsv';
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      if (!response.ok) throw new Error(`Netflix responded ${response.status}`);
      const text = await response.text();
      const lines = text.split(/\r?\n|\r/).filter(Boolean);
      let latestWeek = '';
      if (lines.length > 1) {
        latestWeek = lines[1].split('\t')[0].trim();
      }
      const items = [];
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (cols.length >= 9) {
          const week = cols[0].trim();
          if (week !== latestWeek) break;
          const rawCat = cols[1].trim();
          const rank = parseInt(cols[2], 10);
          const showTitle = cols[3].trim();
          const seasonTitle = cols[4].trim() === 'N/A' ? '' : cols[4].trim();
          const hours = Number(cols[5]) || 0;
          const runtime = Number(cols[6]) || 0;
          const views = Number(cols[7]) || 0;
          const cumulativeWeeks = parseInt(cols[8], 10) || 1;

          let catKey = 'other';
          if (rawCat.includes('Films') && rawCat.includes('English') && !rawCat.includes('Non-English')) catKey = 'films_en';
          else if (rawCat.includes('Films') && rawCat.includes('Non-English')) catKey = 'films_non_en';
          else if (rawCat.includes('TV') && rawCat.includes('English') && !rawCat.includes('Non-English')) catKey = 'tv_en';
          else if (rawCat.includes('TV') && rawCat.includes('Non-English')) catKey = 'tv_non_en';

          if (category === 'all' || category === catKey) {
            const cnName = NETFLIX_TITLE_MAP[showTitle] || '';
            const displayTitle = cnName ? `${showTitle} (${cnName})` : showTitle;
            const viewsStr = views >= 100000000 ? `${(views / 100000000).toFixed(2)}亿次` : `${(views / 10000).toFixed(0)}万次`;
            const hoursStr = hours >= 100000000 ? `${(hours / 100000000).toFixed(2)}亿小时` : `${(hours / 10000).toFixed(0)}万小时`;
            const art = resolveNetflixArtwork(artworkMap, 'weekly', catKey, rank, showTitle);

            items.push({
              id: `netflix_week_${catKey}_${rank}`,
              rank,
              title: displayTitle,
              originalTitle: showTitle,
              cnTitle: cnName,
              season: seasonTitle,
              category: rawCat.includes('Films') ? '电影' : '剧集',
              netflixCategory: rawCat,
              catKey,
              week,
              hours,
              runtime,
              views,
              cumulativeWeeks,
              hoursFormatted: hoursStr,
              viewsFormatted: viewsStr,
              remarks: `周观看 ${viewsStr} • 在榜 ${cumulativeWeeks} 周`,
              cover: art.cover || art.thumb || '',
              thumb: art.thumb || art.cover || '',
              backdrop: art.cover || '',
              logo: art.logo || '',
              overview: art.synopsis || '',
              content: art.synopsis || '',
              year: art.year ? String(art.year) : '',
              rate: art.rating || '',
            });
          }
        }
      }
      const result = { mode, category, week: latestWeek, total: items.length, items };
      setCache(cacheKey, result);
      return res.json(result);
    }
  } catch (err) {
    console.error('Netflix API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Netflix top 10 data', message: err.message });
  }
});

// 3. Bangumi Weekly Anime Calendar API
api.get('/api/bangumi', async (req, res) => {
  const cacheKey = 'bangumi_calendar';
  const cached = getCache(cacheKey, 1800000);
  if (cached) return res.json(cached);

  try {
    const response = await fetch('https://api.bgm.tv/calendar', {
      headers: {
        'User-Agent': 'Netflex/1.0.0 (https://github.com/li000592/netflex)',
      },
    });
    if (!response.ok) throw new Error(`Bangumi returned ${response.status}`);
    const data = await response.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('Bangumi API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Bangumi calendar' });
  }
});

// 3.5. Huakai Dedicated Portal API (Direct 155zy catalog with pagination & subcategory filters)
api.get('/api/huakai', async (req, res) => {
  const { pg = 1, t: typeId, wd } = req.query;
  const cacheKey = `huakai_catalog_${pg}_${typeId || 'all'}_${wd || 'none'}`;
  const cached = getCache(cacheKey, 300000); // 5 min cache
  if (cached) return res.json(cached);

  try {
    let url = `https://155api.com/api.php/provide/vod?ac=videolist&pg=${pg}`;
    if (typeId) {
      url += `&t=${encodeURIComponent(typeId)}`;
    }
    if (wd && wd.trim()) {
      url += `&wd=${encodeURIComponent(wd.trim())}`;
    }
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });
    if (!response.ok) throw new Error(`155api returned ${response.status}`);
    const data = await response.json();
    const list = (data.list || []).map((item) => {
      const parsedGroups = parseVodPlayUrl(item.vod_play_url, item.vod_play_from);
      return {
        id: `155zy_${item.vod_id}`,
        vod_id: item.vod_id,
        sourceId: '155zy',
        sourceName: '155动漫',
        sourceUrl: 'https://155api.com/api.php/provide/vod',
        title: item.vod_name,
        pic: hasValidCover(item.vod_pic) ? item.vod_pic.trim() : '',
        actor: item.vod_actor || '',
        director: item.vod_director || '',
        remarks: item.vod_remarks || '',
        area: item.vod_area || '',
        year: item.vod_year || '',
        type_name: item.type_name || '',
        content: item.vod_content || '',
        playUrlRaw: item.vod_play_url || '',
        groups: parsedGroups,
      };
    });

    // Move items without covers to the back
    list.sort((a, b) => {
      const aHas = hasValidCover(a.pic) ? 1 : 0;
      const bHas = hasValidCover(b.pic) ? 1 : 0;
      return bHas - aHas;
    });

    const result = {
      page: Number(data.page) || Number(pg),
      pagecount: Number(data.pagecount) || 1,
      total: Number(data.total) || list.length,
      list,
    };
    setCache(cacheKey, result);
    res.json(result);
  } catch (err) {
    console.error('Huakai API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Huakai content' });
  }
});

// 4. Concurrent Search Across Sources (with High-Speed Priority & 1600ms Timeout)
api.get('/api/search', async (req, res) => {
  const { wd, sourceId, category, limit = 40, huakai } = req.query;
  if (!wd || !wd.trim()) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  const huakaiAllowed = huakai === 'true' || huakai === '1';
  const keyword = wd.trim();
  const cacheKey = `search_${keyword.toLowerCase()}_${sourceId || 'all'}_${category || 'all'}_${huakaiAllowed ? 'hk1' : 'hk0'}`;
  const cached = getCache(cacheKey, 600000); // 10 min cache
  if (cached) {
    return res.json(cached);
  }

  let targetSources = VIDEO_SOURCES;
  const adultRegex = /(伦理|倫理|理论片|情色|三级|福利|里番|无码|有码|麻豆|自拍|人妻|乱伦|性爱|色情|福利姬|调教|偷拍|探花|主播秀色|巨乳|萝莉|av解说|换脸|91制片|蜜桃影像|天美传媒|精东影业|星空无限|swag|糖心|写真|写真热舞|成人|做爱|内射|高潮|潮吹|迷奸|强暴|强奸|轮奸|操逼|肉棒|大胸|情趣|女优|淫乱|春药|野战|车震|黑料|门事件|SM调教|叫床|出轨约炮|私房写真|极度诱惑)/i;
  const avCodeRegex = /\b(fc2|ppv)[-_]?\d+|\b(ssni|ipx|mide|midv|abp|snis|wanz|pred|star|stars|jul|jufe|atid|adn|hnd|dasd|cawd|fsdss|miae|ssis|juq|dldss|sone|pppd|ebod|meyd|mey|das|stars|tek|soe)[-_]?\d+/i;

  if (!huakaiAllowed) {
    // Huakai mode is OFF: Never search huakai sources
    if (category === 'huakai' || adultRegex.test(keyword) || avCodeRegex.test(keyword)) {
      return res.json({ total: 0, list: [] });
    }
    if (sourceId) {
      const match = VIDEO_SOURCES.find((s) => s.id === sourceId);
      if (!match || match.category === 'huakai') {
        return res.json({ total: 0, list: [] });
      }
      targetSources = [match];
    } else if (category && category !== 'all') {
      targetSources = VIDEO_SOURCES.filter((s) => s.category === category && s.category !== 'huakai');
    } else {
      targetSources = VIDEO_SOURCES.filter((s) => s.category !== 'huakai');
    }
  } else {
    // Huakai mode is ON:
    if (sourceId) {
      targetSources = VIDEO_SOURCES.filter((s) => s.id === sourceId);
    } else if (category && category !== 'all') {
      targetSources = VIDEO_SOURCES.filter((s) => s.category === category);
    } else {
      targetSources = VIDEO_SOURCES;
    }
  }

  const isHuakaiContent = (item, sourceCat) => {
    if (sourceCat === 'huakai' || item.sourceCategory === 'huakai' || item.category === 'huakai' || item.category === '花开') return true;
    if (item.type_name && adultRegex.test(item.type_name)) return true;
    if (item.title && (adultRegex.test(item.title) || avCodeRegex.test(item.title))) return true;
    if (item.vod_name && (adultRegex.test(item.vod_name) || avCodeRegex.test(item.vod_name))) return true;
    return false;
  };

  const searchPromises = targetSources.map(async (source) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1600); // 1.6s fast cut-off
    try {
      const searchUrl = `${source.url}?ac=videolist&wd=${encodeURIComponent(keyword)}`;
      const resp = await fetch(searchUrl, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      });
      clearTimeout(timeoutId);
      if (!resp.ok) return [];
      const json = await resp.json();
      const list = json.list || [];
      return list.map((item) => {
        const parsedGroups = parseVodPlayUrl(item.vod_play_url, item.vod_play_from);
        return {
          id: `${source.id}_${item.vod_id}`,
          vod_id: item.vod_id,
          sourceId: source.id,
          sourceName: source.name,
          sourceUrl: source.url,
          sourceCategory: source.category,
          title: item.vod_name,
          pic: hasValidCover(item.vod_pic) ? item.vod_pic.trim() : '',
          actor: item.vod_actor || '',
          director: item.vod_director || '',
          remarks: item.vod_remarks || '',
          area: item.vod_area || '',
          year: item.vod_year || '',
          type_name: item.type_name || '',
          content: item.vod_content || '',
          playUrlRaw: item.vod_play_url || '',
          groups: parsedGroups,
        };
      });
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  });

  const results = await Promise.allSettled(searchPromises);
  const titleGroups = new Map();

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const item of r.value) {
        if (!huakaiAllowed && isHuakaiContent(item, item.sourceCategory)) {
          continue;
        }
        const normTitle = item.title.trim().toLowerCase();
        const sourceEntry = {
          sourceId: item.sourceId,
          sourceName: item.sourceName,
          sourceUrl: item.sourceUrl,
          sourceCategory: item.sourceCategory,
          vod_id: item.vod_id,
          remarks: item.remarks,
          playUrlRaw: item.playUrlRaw,
          groups: item.groups,
        };

        if (!titleGroups.has(normTitle)) {
          titleGroups.set(normTitle, {
            primary: item,
            sources: [sourceEntry],
          });
        } else {
          const group = titleGroups.get(normTitle);
          group.sources.push(sourceEntry);

          // If current primary has no valid cover, but this incoming item has one, update primary cover!
          if (!hasValidCover(group.primary.pic) && hasValidCover(item.pic)) {
            group.primary.pic = item.pic;
          }
          // Backfill missing metadata
          if (!group.primary.actor && item.actor) group.primary.actor = item.actor;
          if (!group.primary.director && item.director) group.primary.director = item.director;
          if (!group.primary.content && item.content) group.primary.content = item.content;
          if (!group.primary.year && item.year) group.primary.year = item.year;
          if (!group.primary.area && item.area) group.primary.area = item.area;
          if ((!group.primary.groups || group.primary.groups.length === 0) && item.groups && item.groups.length > 0) {
            group.primary.groups = item.groups;
          }
        }
      }
    }
  }

  const aggregated = Array.from(titleGroups.values()).map((group) => ({
    ...group.primary,
    availableSources: group.sources,
  }));

  // Sort: items with valid covers first, items without covers to the back
  aggregated.sort((a, b) => {
    const aHas = hasValidCover(a.pic) ? 1 : 0;
    const bHas = hasValidCover(b.pic) ? 1 : 0;
    return bHas - aHas;
  });

  const resultData = {
    total: aggregated.length,
    list: aggregated.slice(0, Number(limit)),
  };

  setCache(cacheKey, resultData);
  res.json(resultData);
});

// 5. Video Details & Episode Parser (with Cache)
api.get('/api/detail', async (req, res) => {
  const { sourceUrl, id } = req.query;
  if (!sourceUrl || !id) {
    return res.status(400).json({ error: 'sourceUrl and id required' });
  }

  const cacheKey = `detail_${sourceUrl}_${id}`;
  const cached = getCache(cacheKey, 1800000); // 30 min cache
  if (cached) return res.json(cached);

  try {
    const detailUrl = `${sourceUrl}?ac=detail&ids=${id}`;
    const resp = await fetch(detailUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (!resp.ok) throw new Error(`Source returned ${resp.status}`);
    const json = await resp.json();
    const item = (json.list && json.list[0]) || null;
    if (!item) return res.status(404).json({ error: 'Not found' });

    const playListGroups = parseVodPlayUrl(item.vod_play_url, item.vod_play_from);

    const detailData = {
      title: item.vod_name,
      pic: item.vod_pic,
      actor: item.vod_actor || '',
      director: item.vod_director || '',
      year: item.vod_year || '',
      area: item.vod_area || '',
      remarks: item.vod_remarks || '',
      content: item.vod_content || '',
      groups: playListGroups,
    };

    setCache(cacheKey, detailData);
    res.json(detailData);
  } catch (err) {
    console.error('Detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Image in-memory buffer cache for instant poster serving
const imageCache = new Map();

// 6. Anti-hotlinking Image Proxy (specifically handles Douban & TencentEdgeOne CDN)
api.get('/api/proxy/image', async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).send('URL required');

  // Automatically upgrade Douban low-res thumbnails to crystal-clear HD
  if (typeof url === 'string' && url.includes('doubanio.com')) {
    url = url
      .replace('/s_ratio_poster/', '/l_ratio_poster/')
      .replace('/m_ratio_poster/', '/l_ratio_poster/')
      .replace('/photo/s/', '/photo/l/')
      .replace('/photo/m/', '/photo/l/');
  }

  if (imageCache.has(url)) {
    const cached = imageCache.get(url);
    res.setHeader('Content-Type', cached.contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(cached.buffer);
  }

  try {
    const isDouban = url.includes('doubanio.com') || url.includes('douban.com');
    const referer = isDouban ? 'https://movie.douban.com/' : '';

    const imgResp = await fetch(url, {
      headers: {
        Referer: referer,
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    });

    if (!imgResp.ok) {
      return res.status(imgResp.status).send('Failed to fetch image');
    }

    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await imgResp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Cache image buffer
    imageCache.set(url, { contentType, buffer });
    // Limit cache size to 300 images
    if (imageCache.size > 300) {
      const firstKey = imageCache.keys().next().value;
      imageCache.delete(firstKey);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(buffer);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default api;
