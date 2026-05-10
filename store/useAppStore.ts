import { create } from 'zustand';
import { supabase } from '@/lib/supabase';

interface AppState {
  activeModal: 'none' | 'risk_calculator' | 'daily_briefing' | 'sessions' | 'calendar' | 'favorites' | 'market_cap';
  setActiveModal: (modal: AppState['activeModal']) => void;
  favoriteAssets: string[];
  toggleFavorite: (asset: string, telegramUserId?: number) => void;
  loadFavorites: (telegramUserId: number) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  activeModal: 'none',
  setActiveModal: (activeModal) => set({ activeModal }),
  favoriteAssets: ['BTCUSDT'],

  loadFavorites: async (telegramUserId: number) => {
    const { data } = await supabase
      .from('user_favorites')
      .select('asset')
      .eq('telegram_user_id', telegramUserId);
    if (data && data.length > 0) {
      set({ favoriteAssets: data.map(r => r.asset) });
    }
  },

  toggleFavorite: async (asset: string, telegramUserId?: number) => {
    const { favoriteAssets } = get();
    const isAdding = !favoriteAssets.includes(asset);
    
    // Optimistic update
    set({
      favoriteAssets: isAdding
        ? [...favoriteAssets, asset]
        : favoriteAssets.filter(a => a !== asset),
    });
    
    if (!telegramUserId) return;
    
    if (isAdding) {
      await supabase.from('user_favorites').insert({ telegram_user_id: telegramUserId, asset });
    } else {
      await supabase.from('user_favorites').delete()
        .eq('telegram_user_id', telegramUserId).eq('asset', asset);
    }
  },
}));
