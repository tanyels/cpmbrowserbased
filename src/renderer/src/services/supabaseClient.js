// Browser-compatible Supabase client
import { createClient } from '@supabase/supabase-js';

const SUPABASE_CONFIG = {
  url: 'https://dacksekeosjkaoqaqzpu.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRhY2tzZWtlb3Nqa2FvcWFxenB1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMDQxNTQsImV4cCI6MjA4NTc4MDE1NH0.Yd3ObfJB8K3N92IZMOlUE1D4_F-zQHH_rMcilOiM9i4',
  storageBucket: 'cpme-files'
};

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
export { SUPABASE_CONFIG };
