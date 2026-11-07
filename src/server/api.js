import express from 'express';
import cors from 'cors';
import { VIDEO_SOURCES } from '../config/sources.js';

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

// 1. Status API
api.get('/api/status', (req, res) => {
  res.json({
    status: 'ok',
    totalSources: VIDEO_SOURCES.length,
    sources: VIDEO_SOURCES,
  });
});

// 2. Douban Catalog API
api.get('/api/douban', async (req, res) => {
  const { type = 'movie', tag = '热门', limit = 20, start = 0 } = req.query;
  const cacheKey = `douban_${type}_${tag}_${limit}_${start}`;
  const cached = getCache(cacheKey, 600000);
  if (cached) return res.json(cached);

  try {
    const url = `https://movie.douban.com/j/search_subjects?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}&page_limit=${limit}&page_start=${start}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
        Referer: 'https://movie.douban.com/',
      },
    });
    if (!response.ok) throw new Error(`Douban returned ${response.status}`);
    const data = await response.json();
    setCache(cacheKey, data);
    res.json(data);
  } catch (err) {
    console.error('Douban API error:', err.message);
    res.status(500).json({ error: 'Failed to fetch Douban catalog' });
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

// 4. Concurrent Search Across 31 Sources
api.get('/api/search', async (req, res) => {
  const { wd, sourceId, limit = 40 } = req.query;
  if (!wd || !wd.trim()) {
    return res.status(400).json({ error: 'Keyword required' });
  }

  const keyword = wd.trim();
  const targetSources = sourceId
    ? VIDEO_SOURCES.filter((s) => s.id === sourceId)
    : VIDEO_SOURCES;

  const searchPromises = targetSources.map(async (source) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
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
      return list.map((item) => ({
        id: `${source.id}_${item.vod_id}`,
        vod_id: item.vod_id,
        sourceId: source.id,
        sourceName: source.name,
        sourceUrl: source.url,
        title: item.vod_name,
        pic: item.vod_pic,
        actor: item.vod_actor || '',
        director: item.vod_director || '',
        remarks: item.vod_remarks || '',
        area: item.vod_area || '',
        year: item.vod_year || '',
        type_name: item.type_name || '',
        content: item.vod_content || '',
        playUrlRaw: item.vod_play_url || '',
      }));
    } catch {
      clearTimeout(timeoutId);
      return [];
    }
  });

  const results = await Promise.allSettled(searchPromises);
  const allVideos = [];
  const titleGroups = new Map();

  for (const r of results) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) {
      for (const item of r.value) {
        allVideos.push(item);
        const normTitle = item.title.trim().toLowerCase();
        if (!titleGroups.has(normTitle)) {
          titleGroups.set(normTitle, {
            primary: item,
            sources: [
              {
                sourceId: item.sourceId,
                sourceName: item.sourceName,
                sourceUrl: item.sourceUrl,
                vod_id: item.vod_id,
                remarks: item.remarks,
                playUrlRaw: item.playUrlRaw,
              },
            ],
          });
        } else {
          titleGroups.get(normTitle).sources.push({
            sourceId: item.sourceId,
            sourceName: item.sourceName,
            sourceUrl: item.sourceUrl,
            vod_id: item.vod_id,
            remarks: item.remarks,
            playUrlRaw: item.playUrlRaw,
          });
        }
      }
    }
  }

  const aggregated = Array.from(titleGroups.values()).map((group) => ({
    ...group.primary,
    availableSources: group.sources,
  }));

  res.json({
    total: aggregated.length,
    list: aggregated.slice(0, Number(limit)),
  });
});

// 5. Video Details & Episode Parser
api.get('/api/detail', async (req, res) => {
  const { sourceUrl, id } = req.query;
  if (!sourceUrl || !id) {
    return res.status(400).json({ error: 'sourceUrl and id required' });
  }

  try {
    const detailUrl = `${sourceUrl}?ac=detail&ids=${id}`;
    const resp = await fetch(detailUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
    });
    if (!resp.ok) throw new Error(`Source returned ${resp.status}`);
    const json = await resp.json();
    const item = (json.list && json.list[0]) || null;
    if (!item) return res.status(404).json({ error: 'Not found' });

    const playListGroups = [];
    const rawPlayUrl = item.vod_play_url || '';
    const rawPlayFrom = item.vod_play_from || '';
    const playFroms = rawPlayFrom.split('$$$');
    const playUrlSets = rawPlayUrl.split('$$$');

    playUrlSets.forEach((setStr, idx) => {
      const fromName = playFroms[idx] || `线路 ${idx + 1}`;
      const episodes = [];
      const epStrings = setStr.split('#');
      epStrings.forEach((epStr) => {
        const parts = epStr.split('$');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const url = parts.slice(1).join('$').trim();
          if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            episodes.push({ name, url });
          }
        }
      });
      if (episodes.length > 0) {
        playListGroups.push({ from: fromName, episodes });
      }
    });

    res.json({
      title: item.vod_name,
      pic: item.vod_pic,
      actor: item.vod_actor || '',
      director: item.vod_director || '',
      year: item.vod_year || '',
      area: item.vod_area || '',
      remarks: item.vod_remarks || '',
      content: item.vod_content || '',
      groups: playListGroups,
    });
  } catch (err) {
    console.error('Detail error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// 6. Anti-hotlinking Image Proxy
api.get('/api/proxy/image', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send('URL required');
  try {
    const imgResp = await fetch(url, {
      headers: {
        Referer: '',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
    });
    if (!imgResp.ok) return res.status(imgResp.status).send('Failed to fetch image');
    const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const arrayBuffer = await imgResp.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    res.status(500).send(err.message);
  }
});

export default api;
