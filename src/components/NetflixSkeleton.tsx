import React from 'react';

interface SkeletonProps {
  className?: string;
}

/**
 * Single Netflix-styled Poster Card Skeleton
 */
export const NetflixCardSkeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`relative select-none aspect-[2/3] rounded-md overflow-hidden bg-[#1a1a1a] border border-white/5 flex flex-col justify-between p-3 ${
        className ? className : 'w-32 sm:w-44 md:w-52 flex-none'
      }`}
    >
      {/* Shimmer sweep overlay */}
      <div className="absolute inset-0 netflix-skeleton-shimmer z-10 pointer-events-none" />

      {/* Top placeholder tags (badge / remarks) */}
      <div className="w-full flex justify-between items-center z-20">
        <div className="w-12 h-3.5 bg-white/10 rounded" />
        <div className="w-8 h-3.5 bg-white/10 rounded" />
      </div>

      {/* Netflix watermark background */}
      <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
        <span className="text-[#E50914] font-black text-5xl">N</span>
      </div>

      {/* Bottom title & rating placeholder bars */}
      <div className="space-y-1.5 z-20">
        <div className="w-4/5 h-3.5 bg-white/20 rounded" />
        <div className="w-1/2 h-2.5 bg-white/10 rounded" />
      </div>
    </div>
  );
};

/**
 * Netflix-styled Horizontal Carousel Row Skeleton
 */
export const NetflixRowSkeleton: React.FC<{ title?: string; count?: number }> = ({
  title,
  count = 6,
}) => {
  return (
    <div className="relative my-6 sm:my-8 px-4 sm:px-6 lg:px-8">
      {/* Row Header Title */}
      <div className="flex items-center justify-between mb-3">
        {title ? (
          <h2 className="text-lg sm:text-2xl font-bold text-white tracking-wide flex items-center">
            {title}
          </h2>
        ) : (
          <div className="w-44 sm:w-60 h-6 sm:h-7 rounded-md bg-white/10 netflix-skeleton-shimmer" />
        )}
      </div>

      {/* Scrollable Container with Skeleton Cards */}
      <div className="flex items-center space-x-3 sm:space-x-4 overflow-x-hidden py-3">
        {Array.from({ length: count }).map((_, i) => (
          <NetflixCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
};

/**
 * Netflix-styled Billboard Hero Banner Skeleton
 */
export const NetflixHeroSkeleton: React.FC = () => {
  return (
    <div className="relative h-[65vh] sm:h-[80vh] w-full bg-[#181818] overflow-hidden select-none">
      {/* Shimmer sweep over background */}
      <div className="absolute inset-0 netflix-skeleton-shimmer z-0 opacity-40 pointer-events-none" />

      {/* Netflix Watermark in center of Hero */}
      <div className="absolute inset-0 flex items-center justify-center opacity-5 pointer-events-none">
        <span className="text-[#E50914] font-black text-[18vw]">N</span>
      </div>

      {/* Bottom & Top Gradients to match HeroBanner */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-transparent to-transparent z-10" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#141414]/90 via-[#141414]/40 to-transparent z-10" />

      {/* Hero Content Skeletons */}
      <div className="absolute bottom-16 sm:bottom-24 left-4 sm:left-12 max-w-2xl z-20 space-y-4">
        {/* Title placeholder */}
        <div className="w-64 sm:w-96 h-10 sm:h-16 rounded-xl bg-white/15 netflix-skeleton-shimmer" />

        {/* Metadata pills placeholder */}
        <div className="flex items-center space-x-3 pt-1">
          <div className="w-16 h-5 rounded bg-emerald-500/20 netflix-skeleton-shimmer" />
          <div className="w-12 h-5 rounded bg-white/10 netflix-skeleton-shimmer" />
          <div className="w-20 h-5 rounded bg-white/10 netflix-skeleton-shimmer" />
        </div>

        {/* Synopsis placeholder lines */}
        <div className="space-y-2 pt-1 max-w-lg">
          <div className="w-full h-3.5 rounded bg-white/10 netflix-skeleton-shimmer" />
          <div className="w-5/6 h-3.5 rounded bg-white/10 netflix-skeleton-shimmer" />
          <div className="w-2/3 h-3.5 rounded bg-white/10 netflix-skeleton-shimmer" />
        </div>

        {/* Action Buttons placeholder */}
        <div className="flex items-center space-x-4 pt-3">
          <div className="w-28 sm:w-36 h-10 sm:h-12 rounded-lg bg-white/30 netflix-skeleton-shimmer" />
          <div className="w-28 sm:w-36 h-10 sm:h-12 rounded-lg bg-white/10 netflix-skeleton-shimmer" />
        </div>
      </div>
    </div>
  );
};

/**
 * Complete Netflix-style Home Page Loading Skeleton
 */
export const NetflixHomeSkeleton: React.FC = () => {
  return (
    <div className="w-full min-h-screen bg-[#141414]">
      {/* Hero Banner Skeleton */}
      <NetflixHeroSkeleton />

      {/* Netflix Rows Skeleton */}
      <div className="relative -mt-16 sm:-mt-24 z-20 space-y-2 sm:space-y-4 pb-20">
        <NetflixRowSkeleton title="今日全网 Top 10" count={6} />
        <NetflixRowSkeleton title="热门电影精选" count={6} />
        <NetflixRowSkeleton title="人气热播剧集" count={6} />
      </div>
    </div>
  );
};

/**
 * Grid Skeleton for InfiniteCatalogView, HuakaiPage, and SearchPage
 */
export const NetflixGridSkeleton: React.FC<{ count?: number }> = ({ count = 18 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <NetflixCardSkeleton key={i} className="w-full" />
      ))}
    </div>
  );
};
