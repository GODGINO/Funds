// 新浪基金盘中估值代理（2026-10-09）：同花顺 gz-fund 停推盘中点后的备用源。
// 浏览器直连 hq.sinajs.cn 会因 Referer 被 403，故由 Netlify Function 代为请求并转 JSON。
// GET /.netlify/functions/fu?codes=008888,002611  →  { "008888": { estimatedNAV, estimatedChange, estimationTime, name }, ... }
export default async (req) => {
  const url = new URL(req.url);
  const codes = (url.searchParams.get('codes') || '').split(',').map(s => s.trim()).filter(s => /^\d{6}$/.test(s)).slice(0, 80);
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };
  if (!codes.length) return new Response('{}', { status: 400, headers });
  try {
    const resp = await fetch(`https://hq.sinajs.cn/list=${codes.map(c => 'fu_' + c).join(',')}`, {
      headers: { 'Referer': 'https://finance.sina.com.cn/', 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!resp.ok) return new Response(JSON.stringify({ error: `sina HTTP ${resp.status}` }), { status: 502, headers });
    const text = new TextDecoder('gbk').decode(await resp.arrayBuffer());
    const out = {};
    for (const line of text.split('\n')) {
      const m = line.match(/hq_str_fu_(\d{6})="([^"]*)"/);
      if (!m || !m[2]) continue;
      const v = m[2].split(',');
      const gsz = parseFloat(v[2]); const prev = parseFloat(v[3]);
      if (v.length < 8 || !isFinite(gsz) || gsz <= 0 || !isFinite(prev) || prev <= 0) continue;
      out[m[1]] = {
        name: v[0],
        estimatedNAV: gsz,
        estimatedChange: ((gsz / prev - 1) * 100).toFixed(2),
        estimationTime: `${v[7]} ${(v[1] || '').slice(0, 5)}`,
        dataDate: v[7],
      };
    }
    return new Response(JSON.stringify(out), { status: 200, headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 502, headers });
  }
};
export const config = { path: '/.netlify/functions/fu' };
