
import { supabase, isSupabaseConfigured } from '../supabaseClient';
import { UserProfile } from '../types';

// --- Types ---
interface User {
  id: string;
  email: string;
  user_metadata: { full_name: string };
}

// --- Mock/Local Implementation ---
const MOCK_STORAGE_KEY = 'loopgenie_mock_user';

const getMockUser = (): User | null => {
  const stored = localStorage.getItem(MOCK_STORAGE_KEY);
  return stored ? JSON.parse(stored) : null;
};

const setMockUser = (user: User | null) => {
  if (user) localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(user));
  else localStorage.removeItem(MOCK_STORAGE_KEY);
  
  // Trigger event for UI update
  window.dispatchEvent(new Event('auth-change'));
};

// --- Service Methods ---

export const getSession = async () => {
  if (!isSupabaseConfigured()) {
    const user = getMockUser();
    return { data: { session: user ? { user } : null }, error: null };
  }
  return supabase.auth.getSession();
};

export const getUserProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!isSupabaseConfigured()) {
    return { id: userId, email: 'mock@demo.com', credits_balance: 5 };
  }
  
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // PGRST116: JSON object requested, multiple (or no) rows returned
      // This happens if the user exists in Auth but not in the profiles table yet
      if (error.code === 'PGRST116') {
        console.warn("Profile not found for user (PGRST116). Returning default free tier profile.");
        return { 
          id: userId, 
          email: '', // Email is not critical for credit checks
          credits_balance: 5 
        };
      }
      
      // PGRST42P01: Relation does not exist (Table missing)
      if (error.code === '42P01') {
         console.warn("Profiles table missing. Returning default free tier profile.");
         return { id: userId, email: '', credits_balance: 5 };
      }

      console.error("Error fetching profile:", error.message || error);
      // Return default instead of null to allow app to function
      return { id: userId, email: '', credits_balance: 5 };
    }
    
    // Return data, defaulting credits to 5 if the column is missing/null
    return {
        ...data,
        credits_balance: (data as any).credits_balance ?? 5
    } as UserProfile;

  } catch (err: any) {
      console.error("Unexpected error in getUserProfile:", err.message || err);
      // Fallback to prevent app crash
      return { id: userId, email: '', credits_balance: 5 };
  }
};

export const onAuthStateChange = (callback: (event: string, session: any) => void) => {
  if (!isSupabaseConfigured()) {
    // Listen for local storage events to simulate auth state change
    const handler = () => {
      const user = getMockUser();
      callback(user ? 'SIGNED_IN' : 'SIGNED_OUT', user ? { user } : null);
    };
    window.addEventListener('auth-change', handler);
    // Initial call
    handler();
    
    return { data: { subscription: { unsubscribe: () => window.removeEventListener('auth-change', handler) } } };
  }
  return supabase.auth.onAuthStateChange(callback);
};

export const signUp = async (email: string, password: string, fullName: string) => {
  if (!isSupabaseConfigured()) {
    // Simulate Signup
    const newUser: User = {
      id: `user_${Date.now()}`,
      email,
      user_metadata: { full_name: fullName }
    };
    // Auto login for better UX in mock mode
    setMockUser(newUser);
    return { data: { user: newUser, session: { user: newUser } }, error: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  });
  if (error) throw error;
  return data;
};

export const signIn = async (email: string, password: string) => {
  if (!isSupabaseConfigured()) {
    // Simulate Login (Accept any password for demo)
    const mockUser: User = {
      id: 'mock_user_123',
      email,
      user_metadata: { full_name: 'Demo User' }
    };
    setMockUser(mockUser);
    return { data: { user: mockUser, session: { user: mockUser } }, error: null };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
};

export const signOut = async () => {
  if (!isSupabaseConfigured()) {
    setMockUser(null);
    return { error: null };
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const resetPassword = async (email: string) => {
  if (!isSupabaseConfigured()) {
    // Simulate success
    return { error: null };
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) throw error;
};

export const getCurrentUser = async () => {
  if (!isSupabaseConfigured()) {
    return getMockUser();
  }
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};
