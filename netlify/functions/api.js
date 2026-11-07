import { VIDEO_SOURCES } from '../../src/config/sources.js';

// Serverless in-memory cache
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

// Utility: parse MacCMS vod_play_url and vod_play_from into structured episode groups
function parseVodPlayUrl(rawPlayUrl, rawPlayFrom) {
  if (!rawPlayUrl) return [];
  const playListGroups = [];
  const playFroms = (rawPlayFrom || '').split('$$$');
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
  return playListGroups;
}

export async function handler(event) {
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  const params = event.queryStringParameters || {};

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // 1. Status API
    if (path === '/status' || path === '') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          status: 'ok',
          totalSources: VIDEO_SOURCES.length,
          sources: VIDEO_SOURCES,
        }),
      };
    }

    // 2. Douban Catalog API
    if (path === '/douban') {
      const type = params.type || 'movie';
      const tag = params.tag || '热门';
      const limit = params.limit || 20;
      const start = params.start || 0;
      const cacheKey = `douban_${type}_${tag}_${limit}_${start}`;
      const cached = getCache(cacheKey, 600000);
      if (cached) {
        return { statusCode: 200, headers, body: JSON.stringify(cached) };
      }

      const url = `https://movie.douban.com/j/search_subjects?type=${encodeURIComponent(type)}&tag=${encodeURIComponent(tag)}&page_limit=${limit}&page_start=${start}`;
      const resp = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko)',
          Referer: 'https://movie.douban.com/',
        },
      });
      if (!resp.ok) throw new Error(`Douban returned ${resp.status}`);
      const data = await resp.json();
      setCache(cacheKey, data);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 3. Bangumi Calendar API
    if (path === '/bangumi') {
      const cacheKey = 'bangumi_calendar';
      const cached = getCache(cacheKey, 1800000);
      if (cached) {
        return { statusCode: 200, headers, body: JSON.stringify(cached) };
      }

      const resp = await fetch('https://api.bgm.tv/calendar', {
        headers: { 'User-Agent': 'Netflex/1.0.0 (https://github.com/li000592/netflex)' },
      });
      if (!resp.ok) throw new Error(`Bangumi returned ${resp.status}`);
      const data = await resp.json();
      setCache(cacheKey, data);
      return { statusCode: 200, headers, body: JSON.stringify(data) };
    }

    // 3.5 Huakai Dedicated Portal API (Direct 155zy catalog)
    if (path === '/huakai') {
      const pg = Number(params.pg) || 1;
      const typeId = params.t;
      const wd = (params.wd || '').trim();
      const cacheKey = `huakai_catalog_${pg}_${typeId || 'all'}_${wd || 'none'}`;
      const cached = getCache(cacheKey, 300000); // 5 min cache
      if (cached) {
        return { statusCode: 200, headers, body: JSON.stringify(cached) };
      }

      try {
        let url = `https://155api.com/api.php/provide/vod?ac=videolist&pg=${pg}`;
        if (typeId) {
          url += `&t=${encodeURIComponent(typeId)}`;
        }
        if (wd) {
          url += `&wd=${encodeURIComponent(wd)}`;
        }
        const resp = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
        });
        if (!resp.ok) throw new Error(`155api returned ${resp.status}`);
        const data = await resp.json();
        const list = (data.list || []).map((item) => {
          const parsedGroups = parseVodPlayUrl(item.vod_play_url, item.vod_play_from);
          return {
            id: `155zy_${item.vod_id}`,
            vod_id: item.vod_id,
            sourceId: '155zy',
            sourceName: '155动漫',
            sourceUrl: 'https://155api.com/api.php/provide/vod',
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
            groups: parsedGroups,
          };
        });
        const result = {
          page: Number(data.page) || pg,
          pagecount: Number(data.pagecount) || 1,
          total: Number(data.total) || list.length,
          list,
        };
        setCache(cacheKey, result);
        return { statusCode: 200, headers, body: JSON.stringify(result) };
      } catch (err) {
        return { statusCode: 500, headers, body: JSON.stringify({ error: 'Failed to fetch Huakai content' }) };
      }
    }

    // 4. Concurrent Search Across Sources (with Fast Cut-off & Pre-parsed Episodes)
    if (path === '/search') {
      const keyword = (params.wd || '').trim();
      const sourceId = params.sourceId;
      const category = params.category;
      const limit = Number(params.limit) || 40;

      if (!keyword) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Keyword required' }) };
      }

      const cacheKey = `search_${keyword.toLowerCase()}_${sourceId || 'all'}_${category || 'all'}`;
      const cached = getCache(cacheKey, 600000); // 10 min cache
      if (cached) {
        return { statusCode: 200, headers, body: JSON.stringify(cached) };
      }

      let targetSources = VIDEO_SOURCES;
      if (sourceId) {
        targetSources = VIDEO_SOURCES.filter((s) => s.id === sourceId);
      } else if (category && category !== 'all') {
        targetSources = VIDEO_SOURCES.filter((s) => s.category === category);
      } else {
        // Default or 'all': EXCLUDE 'huakai' so 155 data is never mixed into other categories or general search
        targetSources = VIDEO_SOURCES.filter((s) => s.category !== 'huakai');
      }

      const searchPromises = targetSources.map(async (source) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1600); // 1.6s timeout
        try {
          const searchUrl = `${source.url}?ac=videolist&wd=${encodeURIComponent(keyword)}`;
          const resp = await fetch(searchUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
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
                    groups: item.groups,
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
                groups: item.groups,
              });
            }
          }
        }
      }

      const aggregated = Array.from(titleGroups.values()).map((group) => ({
        ...group.primary,
        availableSources: group.sources,
      }));

      const resultData = {
        total: aggregated.length,
        list: aggregated.slice(0, limit),
      };

      setCache(cacheKey, resultData);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(resultData),
      };
    }

    // 5. Video Details & Episode Parser (with 30 min cache)
    if (path === '/detail') {
      const sourceUrl = params.sourceUrl;
      const id = params.id;
      if (!sourceUrl || !id) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'sourceUrl and id required' }) };
      }

      const cacheKey = `detail_${sourceUrl}_${id}`;
      const cached = getCache(cacheKey, 1800000);
      if (cached) {
        return { statusCode: 200, headers, body: JSON.stringify(cached) };
      }

      const detailUrl = `${sourceUrl}?ac=detail&ids=${id}`;
      const resp = await fetch(detailUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      if (!resp.ok) throw new Error(`Source returned ${resp.status}`);
      const json = await resp.json();
      const item = (json.list && json.list[0]) || null;
      if (!item) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
      }

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
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(detailData),
      };
    }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          title: item.vod_name,
          pic: item.vod_pic,
          actor: item.vod_actor || '',
          director: item.vod_director || '',
          year: item.vod_year || '',
          area: item.vod_area || '',
          remarks: item.vod_remarks || '',
          content: item.vod_content || '',
          groups: playListGroups,
        }),
      };
    }

    // 6. Anti-hotlinking Image Proxy (specifically handles Douban & TencentEdgeOne CDN)
    if (path === '/proxy/image') {
      const url = params.url;
      if (!url) return { statusCode: 400, headers, body: 'URL required' };

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
      if (!imgResp.ok) return { statusCode: imgResp.status, headers, body: 'Image fetch failed' };
      const contentType = imgResp.headers.get('content-type') || 'image/jpeg';
      const arrayBuffer = await imgResp.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');

      return {
        statusCode: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400',
        },
        isBase64Encoded: true,
        body: base64,
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
}
