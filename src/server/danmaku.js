import crypto from 'crypto';
import zlib from 'zlib';

// In-memory danmaku cache (TTL: 2 hours)
const danmakuCache = new Map();
// In-memory user-submitted comments store: key -> DanmakuItem[]
const customCommentsStore = new Map();

// Bilibili WBI table and cache
const WBI_MIXIN_KEY_TABLE = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
  61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
  36, 20, 34, 44, 52,
];

let wbiKeyCache = { key: '', expire: 0 };

async function getWbiMixinKey() {
  const now = Date.now();
  if (wbiKeyCache.key && now < wbiKeyCache.expire) {
    return wbiKeyCache.key;
  }
  try {
    const res = await fetch('https://api.bilibili.com/x/web-interface/nav', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (!res.ok) throw new Error('Nav request failed');
    const json = await res.json();
    const wbiImg = json.data?.wbi_img || {};
    const imgKey = (wbiImg.img_url || '').split('/').pop()?.split('.')[0] || '';
    const subKey = (wbiImg.sub_url || '').split('/').pop()?.split('.')[0] || '';
    const rawKey = imgKey + subKey;
    const mixinKey = WBI_MIXIN_KEY_TABLE.map((i) => rawKey[i]).join('').slice(0, 32);
    if (mixinKey && mixinKey.length === 32) {
      wbiKeyCache = { key: mixinKey, expire: now + 3600 * 1000 };
      return mixinKey;
    }
  } catch (e) {
    console.warn('[Danmaku] Failed to fetch Bilibili WBI key, using fallback:', e.message);
  }
  return 'dba4a5925b345b4598b7452c75070bca';
}

export function cleanVideoTitle(rawTitle) {
  if (!rawTitle) return '';
  return rawTitle
    .replace(/\s*(?:第[一二三四五六七八九十0-9]+[季部期]|Season\s*\d+|S\d+)/gi, '')
    .replace(/[【】\[\]()（）]/g, ' ')
    .replace(/(?:4K|1080P|720P|HD|BD|无修|生肉|国语|普通话|粤语|中字|简中|繁中)/gi, '')
    .trim();
}

export function parseEpisodeIndex(epInput) {
  if (typeof epInput === 'number') return epInput;
  if (!epInput) return 1;
  const str = String(epInput).trim();
  // Don't match promo words without numbers
  if (!/\d/.test(str)) {
    if (str.includes('正片') || str.includes('全片') || str.includes('全集')) return 1;
    return null;
  }
  const m1 = str.match(/第\s*(\d+)\s*[集话話期P]/i);
  if (m1) return parseInt(m1[1], 10);
  const m2 = str.match(/(?:ep|e|p)\s*(\d+)/i);
  if (m2) return parseInt(m2[1], 10);
  const m3 = str.match(/0*(\d+)(?:[-_.]\d+)?/);
  if (m3) return parseInt(m3[1], 10);
  return null;
}

// Resilient decompressor
function decompressBuffer(buffer) {
  if (buffer[0] === 0x3c) {
    // Already uncompressed XML (starts with '<')
    return buffer.toString('utf-8');
  }
  try {
    return zlib.inflateSync(buffer).toString('utf-8');
  } catch {
    try {
      return zlib.inflateRawSync(buffer).toString('utf-8');
    } catch {
      try {
        return zlib.gunzipSync(buffer).toString('utf-8');
      } catch {
        return buffer.toString('utf-8');
      }
    }
  }
}

// Parse Bilibili list.so XML
function parseBilibiliXml(xmlText) {
  const comments = [];
  const regex = /<d\s+p="([^"]+)">([^<]*)<\/d>/g;
  let match;
  while ((match = regex.exec(xmlText)) !== null) {
    const p = match[1].split(',');
    const text = match[2];
    if (!text || !p || p.length < 4) continue;

    const time = parseFloat(p[0]) || 0;
    const modeNum = parseInt(p[1], 10) || 1;
    let mode = 'right';
    if (modeNum === 4) mode = 'bottom';
    else if (modeNum === 5) mode = 'top';

    const size = parseInt(p[2], 10) || 25;
    const colorInt = parseInt(p[3], 10) || 16777215;
    const color = '#' + colorInt.toString(16).padStart(6, '0');

    comments.push({
      time: Math.round(time * 100) / 100,
      mode,
      size,
      color,
      text: decodeXmlEntities(text),
    });
  }

  comments.sort((a, b) => a.time - b.time);
  return comments;
}

function decodeXmlEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

// DanDanPlay API client
async function fetchDanDanPlayComments(animeTitle, episodeNum) {
  const appId = process.env.DANDAN_APPID || process.env.DANDANAPI_APPID;
  const appKey = process.env.DANDAN_APPKEY || process.env.DANDANAPI_KEY;
  if (!appId || !appKey) return null;

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const searchPath = '/api/v2/search/episodes';
    const signData = appId + timestamp + searchPath + appKey;
    const signature = crypto.createHash('sha256').update(signData).digest('base64');

    const searchUrl = `https://api.dandanplay.net${searchPath}?anime=${encodeURIComponent(animeTitle)}&v2=true`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Netflex/1.0',
        'X-AppId': appId,
        'X-Timestamp': String(timestamp),
        'X-Signature': signature,
      },
    });
    if (!searchRes.ok) return null;
    const searchJson = await searchRes.json();
    const animes = searchJson.animes || [];
    if (!animes.length) return null;

    let targetEpisodeId = null;
    for (const anime of animes) {
      const episodes = anime.episodes || [];
      const matchEp =
        episodes.find((e) => {
          const ep = parseEpisodeIndex(e.episodeTitle || e.title);
          return ep === episodeNum;
        }) || (episodes.length >= episodeNum ? episodes[episodeNum - 1] : null);
      if (matchEp) {
        targetEpisodeId = matchEp.episodeId;
        break;
      }
    }

    if (!targetEpisodeId) return null;

    const commentPath = `/api/v2/comment/${targetEpisodeId}`;
    const commentTimestamp = Math.floor(Date.now() / 1000);
    const commentSignData = appId + commentTimestamp + commentPath + appKey;
    const commentSignature = crypto.createHash('sha256').update(commentSignData).digest('base64');

    const commentUrl = `https://api.dandanplay.net${commentPath}?withRelated=true&chConvert=1`;
    const commentRes = await fetch(commentUrl, {
      headers: {
        'User-Agent': 'Netflex/1.0',
        'X-AppId': appId,
        'X-Timestamp': String(commentTimestamp),
        'X-Signature': commentSignature,
      },
    });
    if (!commentRes.ok) return null;
    const commentJson = await commentRes.json();
    const rawComments = commentJson.comments || [];

    return rawComments.map((c) => {
      const p = (c.p || '').split(',');
      const time = parseFloat(p[0]) || c.time || 0;
      const modeNum = parseInt(p[1], 10) || 1;
      let mode = 'right';
      if (modeNum === 4) mode = 'bottom';
      else if (modeNum === 5) mode = 'top';

      const colorInt = parseInt(p[2], 10) || 16777215;
      const color = '#' + colorInt.toString(16).padStart(6, '0');

      return {
        time: Math.round(time * 100) / 100,
        mode,
        size: 25,
        color,
        text: c.m || c.text || '',
      };
    });
  } catch (err) {
    console.warn('[Danmaku] DanDanPlay fetch error:', err.message);
    return null;
  }
}

// Helper to query Bilibili videos
async function searchBilibiliVideos(keyword, mixinKey) {
  const params = {
    keyword,
    search_type: 'video',
    wts: Math.floor(Date.now() / 1000),
  };
  const sortedQuery = Object.keys(params)
    .sort()
    .map((k) => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
    .join('&');
  const w_rid = crypto.createHash('md5').update(sortedQuery + mixinKey).digest('hex');

  const url = `https://api.bilibili.com/x/web-interface/wbi/search/type?${sortedQuery}&w_rid=${w_rid}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'https://www.bilibili.com/',
    },
  });
  if (!res.ok) return [];
  const json = await res.json();
  return json.data?.result || [];
}

// Bilibili Danmaku Fetcher
async function fetchBilibiliComments(title, episodeNum) {
  try {
    const cleanTitle = cleanVideoTitle(title);
    const mixinKey = await getWbiMixinKey();

    // Query candidates
    let results = await searchBilibiliVideos(`${cleanTitle} 第${episodeNum}集`, mixinKey);
    if (!results.length) {
      results = await searchBilibiliVideos(`${cleanTitle} 第${episodeNum}话`, mixinKey);
    }
    if (!results.length) {
      results = await searchBilibiliVideos(cleanTitle, mixinKey);
    }
    if (!results.length) return [];

    let selectedCid = null;

    // Check pagelist of the top candidates
    for (const v of results.slice(0, 6)) {
      if (!v.bvid) continue;
      const pageRes = await fetch(`https://api.bilibili.com/x/player/pagelist?bvid=${v.bvid}`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        },
      });
      if (!pageRes.ok) continue;
      const pageJson = await pageRes.json();
      const pages = pageJson.data || [];
      if (!pages.length) continue;

      // 1. Check exact episode match in parts
      const exactMatch = pages.find((p) => {
        const ep = parseEpisodeIndex(p.part);
        return ep === episodeNum;
      });

      if (exactMatch) {
        selectedCid = exactMatch.cid;
        break;
      }

      // 2. If video has multiple parts and episodeNum <= pages.length
      if (pages.length > 1 && pages.length >= episodeNum) {
        selectedCid = pages[episodeNum - 1].cid;
        break;
      }

      // 3. If video is a single video and episodeNum === 1
      if (pages.length === 1 && !selectedCid) {
        selectedCid = pages[0].cid;
      }
    }

    if (!selectedCid) return [];

    // Fetch Danmaku list.so XML
    const dmRes = await fetch(`https://api.bilibili.com/x/v1/dm/list.so?oid=${selectedCid}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });

    if (!dmRes.ok) return [];
    const buf = await dmRes.arrayBuffer();
    const xmlText = decompressBuffer(Buffer.from(buf));

    return parseBilibiliXml(xmlText);
  } catch (err) {
    console.error('[Danmaku] Bilibili fetch error:', err.message);
    return [];
  }
}

export async function getDanmakuComments({ title, episode }) {
  if (!title) return [];
  const epNum = parseEpisodeIndex(episode);
  const cacheKey = `dm_${title.trim().toLowerCase()}_${epNum}`;

  // Check cache
  const cached = danmakuCache.get(cacheKey);
  if (cached && Date.now() - cached.time < 3600 * 1000) {
    const custom = customCommentsStore.get(cacheKey) || [];
    return [...cached.data, ...custom];
  }

  // 1. Try DanDanPlay if configured
  let list = await fetchDanDanPlayComments(title, epNum);

  // 2. Fallback to Bilibili WBI
  if (!list || !list.length) {
    list = await fetchBilibiliComments(title, epNum);
  }

  danmakuCache.set(cacheKey, {
    time: Date.now(),
    data: list || [],
  });

  const custom = customCommentsStore.get(cacheKey) || [];
  return [...(list || []), ...custom];
}

export function addDanmakuComment({ title, episode, text, time, color = '#ffffff', mode = 'right', size = 25 }) {
  if (!title || !text) return null;
  const epNum = parseEpisodeIndex(episode);
  const cacheKey = `dm_${title.trim().toLowerCase()}_${epNum}`;

  const item = {
    time: Math.max(0, Math.round(Number(time) * 100) / 100),
    text: String(text).trim().slice(0, 100),
    color: String(color),
    mode: ['right', 'top', 'bottom'].includes(mode) ? mode : 'right',
    size: Number(size) || 25,
    isLocal: true,
    createdAt: Date.now(),
  };

  if (!customCommentsStore.has(cacheKey)) {
    customCommentsStore.set(cacheKey, []);
  }
  const store = customCommentsStore.get(cacheKey);
  store.push(item);
  return item;
}
