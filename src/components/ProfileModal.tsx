import React from 'react';
import { X, Plus, ShieldCheck } from 'lucide-react';
import { User, UserProfile } from '../types';
import { switchProfile } from '../services/auth';

interface ProfileModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onSelectProfile: (profile: UserProfile) => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({
  user,
  isOpen,
  onClose,
  onSelectProfile,
}) => {
  if (!isOpen || !user) return null;

  const handleChoose = (p: UserProfile) => {
    switchProfile(p.id);
    onSelectProfile(p);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-[#141414]/95 backdrop-blur-xl transition-opacity"
      />

      <div className="relative z-10 w-full max-w-2xl text-center">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-0 right-0 p-2 text-gray-400 hover:text-white"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Header */}
        <h1 className="text-3xl sm:text-5xl font-black text-white mb-8 sm:mb-12 tracking-wide">
          正在使用 NETFLEX 的是谁？
        </h1>

        {/* Profile Avatars Grid */}
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {user.profiles.map((p) => {
            const isActive = p.id === user.currentProfileId;
            return (
              <div
                key={p.id}
                onClick={() => handleChoose(p)}
                className="group flex flex-col items-center cursor-pointer transition-transform duration-300"
              >
                <div
                  className={`relative w-24 sm:w-32 aspect-square rounded-lg overflow-hidden border-2 transition-all duration-300 ${
                    isActive
                      ? 'border-[#E50914] scale-105 shadow-2xl ring-4 ring-[#E50914]/40'
                      : 'border-transparent group-hover:border-white group-hover:scale-105'
                  }`}
                >
                  <img
                    src={p.avatar}
                    alt={p.name}
                    className="w-full h-full object-cover filter group-hover:brightness-110"
                  />
                  {p.isKids && (
                    <span className="absolute bottom-0 inset-x-0 bg-[#E50914] text-[10px] font-bold py-0.5 text-white">
                      KIDS
                    </span>
                  )}
                </div>
                <span
                  className={`mt-3 text-sm sm:text-base font-medium transition-colors ${
                    isActive ? 'text-white font-bold' : 'text-gray-400 group-hover:text-white'
                  }`}
                >
                  {p.name}
                </span>
              </div>
            );
          })}
        </div>

        {/* Manage Profiles Button */}
        <div className="mt-12 sm:mt-16">
          <button
            onClick={onClose}
            className="border border-gray-500 text-gray-400 hover:text-white hover:border-white text-xs sm:text-sm tracking-wider uppercase px-6 py-2.5 rounded font-semibold transition-colors"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
};
