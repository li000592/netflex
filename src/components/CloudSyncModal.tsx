import React, { useState } from 'react';
import { X, Cloud, Database, Check, AlertCircle, ExternalLink, Key, Link2 } from 'lucide-react';
import { getSupabaseConfig, saveSupabaseConfig, isSupabaseConfigured, getSupabase } from '../services/supabase';

interface CloudSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const CloudSyncModal: React.FC<CloudSyncModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [anonKey, setAnonKey] = useState(currentConfig.anonKey);
  const [testing, setTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setStatusMessage(null);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl || !cleanKey) {
      saveSupabaseConfig('', '');
      setStatusMessage({ type: 'success', text: '已切换回本地模式 (Local Storage Mode)' });
      setTesting(false);
      onConfigChanged();
      return;
    }

    try {
      saveSupabaseConfig(cleanUrl, cleanKey);
      const supabase = getSupabase();
      if (!supabase) throw new Error('Invalid Supabase configuration');

      // Test query
      const { error } = await supabase.from('netflex_watchlist').select('id').limit(1);
      if (error && error.code !== 'PGRST116') {
        throw new Error(error.message);
      }

      setStatusMessage({ type: 'success', text: '🟢 连接成功！已接入 Supabase 云端数据库' });
      onConfigChanged();
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `连接失败: ${err.message || '请检查 URL、Key 以及是否在 SQL Editor 运行了建表语句'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const isConnected = isSupabaseConfigured();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-md" />

      <div className="relative z-10 w-full max-w-lg bg-[#181818] border border-white/10 rounded-xl p-6 sm:p-8 shadow-2xl text-white">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 text-gray-400 hover:text-white p-1"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-6">
          <div className="p-2.5 rounded-lg bg-[#E50914]/20 text-[#E50914] border border-[#E50914]/30">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white flex items-center">
              Supabase 免费云端数据库
              <span
                className={`ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                  isConnected
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-white/10 text-gray-400 border border-white/10'
                }`}
              >
                {isConnected ? '🟢 已连接云端' : '⚪ 本地存储模式'}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              多设备跨端实时同步账号、追剧进度与个人片单
            </p>
          </div>
        </div>

        {/* Status notification */}
        {statusMessage && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs flex items-center space-x-2 ${
              statusMessage.type === 'success'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-[#E50914]/20 text-red-300 border border-[#E50914]/40'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <Check className="w-4 h-4 flex-none" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-none" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center">
              <Link2 className="w-3.5 h-3.5 mr-1 text-[#E50914]" />
              Project URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-project.supabase.co"
              className="w-full bg-[#252525] text-white px-3.5 py-2.5 rounded-lg text-xs outline-none border border-white/10 focus:border-[#E50914] font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-300 mb-1.5 flex items-center">
              <Key className="w-3.5 h-3.5 mr-1 text-[#E50914]" />
              Anon Public API Key
            </label>
            <textarea
              rows={2}
              value={anonKey}
              onChange={(e) => setAnonKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="w-full bg-[#252525] text-white px-3.5 py-2 rounded-lg text-xs outline-none border border-white/10 focus:border-[#E50914] font-mono"
            />
          </div>

          <div className="flex items-center space-x-3 pt-2">
            <button
              type="submit"
              disabled={testing}
              className="flex-1 bg-[#E50914] hover:bg-[#b80710] text-white font-bold py-2.5 rounded-lg text-xs transition-transform active:scale-[0.98] disabled:opacity-50"
            >
              {testing ? '正在测试连接...' : '保存并连接 Supabase'}
            </button>

            {isConnected && (
              <button
                type="button"
                onClick={() => {
                  setUrl('');
                  setAnonKey('');
                  saveSupabaseConfig('', '');
                  setStatusMessage({ type: 'success', text: '已断开云端，恢复为本地模式' });
                  onConfigChanged();
                }}
                className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-gray-300 text-xs rounded-lg transition-colors"
              >
                断开
              </button>
            )}
          </div>
        </form>

        {/* Instructions */}
        <div className="mt-6 pt-5 border-t border-white/10 text-[11px] text-gray-400 space-y-2">
          <p className="font-semibold text-gray-300 flex items-center">
            <Cloud className="w-3.5 h-3.5 mr-1 text-[#E50914]" />
            如何获取免费 Supabase 凭据：
          </p>
          <ol className="list-decimal list-inside space-y-1 pl-1 text-gray-400">
            <li>
              注册登录{' '}
              <a
                href="https://supabase.com"
                target="_blank"
                rel="noreferrer"
                className="text-[#E50914] underline"
              >
                supabase.com
              </a>{' '}
              并免费创建新项目 (免费额度充足)。
            </li>
            <li>进入项目左侧 **SQL Editor**，粘贴项目根目录下的 `supabase_schema.sql` 并点击 Run。</li>
            <li>在 **Project Settings** ➔ **API** 中复制 `Project URL` 和 `anon public key`。</li>
          </ol>
        </div>
      </div>
    </div>
  );
};
