export interface MediaItem {
  id: string;
  title: string;
  rate?: string;
  cover: string;
  isNew?: boolean;
  category?: string;
  sourceCategory?: string;
  year?: string;
  remarks?: string;
  overview?: string;
  actor?: string;
  director?: string;
  area?: string;
  type_name?: string;
  vod_id?: string | number;
  sourceId?: string;
  sourceName?: string;
  sourceUrl?: string;
  groups?: EpisodeGroup[];
  sequelOrder?: number | null;
  sequelBadge?: string;
  availableSources?: Array<{
    sourceId: string;
    sourceName: string;
    sourceUrl: string;
    sourceCategory?: string;
    vod_id: string | number;
    remarks: string;
    playUrlRaw: string;
    groups?: EpisodeGroup[];
  }>;
}

export interface Episode {
  name: string;
  url: string;
}

export interface EpisodeGroup {
  from: string;
  episodes: Episode[];
}

export interface VideoDetail {
  title: string;
  pic: string;
  actor: string;
  director: string;
  year: string;
  area: string;
  remarks: string;
  content: string;
  groups: EpisodeGroup[];
}

export interface WatchHistoryItem {
  id: string;
  title: string;
  cover: string;
  sourceUrl: string;
  vodId: string | number;
  sourceName?: string;
  episodeIndex: number;
  episodeName: string;
  episodeUrl: string;
  currentTime: number;
  duration: number;
  updatedAt: number;
}

export interface WatchlistItem {
  id: string;
  title: string;
  cover: string;
  rate?: string;
  remarks?: string;
  addedAt: number;
  sourceUrl?: string;
  vod_id?: string | number;
}

export interface UserProfile {
  id: string;
  name: string;
  avatar: string;
  isKids?: boolean;
}

export interface User {
  id: string;
  email: string;
  username: string;
  profiles: UserProfile[];
  currentProfileId: string;
}

export type NavTab = 'home' | 'movies' | 'tv' | 'anime' | 'variety' | 'huakai' | 'mylist' | 'search';

