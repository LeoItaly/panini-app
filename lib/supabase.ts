/**
 * Supabase client — paste your credentials from:
 * supabase.com → Project Settings → API
 *
 *   SUPABASE_URL     = Project URL
 *   SUPABASE_ANON_KEY = anon / public key
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://hiscxstqogunloawfutu.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_F_zMLQKicEJp5BB2UDItYg_XSOWyAPa';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/** Name of the Storage bucket that holds panino photos. */
export const PHOTOS_BUCKET = 'panino-photos';
