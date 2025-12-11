/*
Simple verification script to create a test user (optional) and ensure default categories exist.
Usage:

# Recommended (requires SUPABASE_SERVICE_ROLE_KEY): create a test user and seed defaults
SUPABASE_URL=https://... SUPABASE_SERVICE_ROLE_KEY=sr.... TEST_EMAIL=test+1@example.com TEST_PASSWORD=Passw0rd! node scripts/verify-default-categories.js

# Without service role key (will attempt signUp and signIn; email confirmation may be required)
SUPABASE_URL=https://... SUPABASE_ANON_KEY=anon... TEST_EMAIL=you@example.com TEST_PASSWORD=yourpass node scripts/verify-default-categories.js

The script will:
- create a user (if service role key provided) or sign up the given email
- ensure the personal default categories exist (won't duplicate)
- print the user's personal categories
*/

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const TEST_EMAIL = process.env.TEST_EMAIL;
const TEST_PASSWORD = process.env.TEST_PASSWORD || 'Test1234!';
const TEST_NAME = process.env.TEST_NAME || 'testuser';

if (!SUPABASE_URL) {
  console.error('Set SUPABASE_URL or EXPO_PUBLIC_SUPABASE_URL');
  process.exit(1);
}

if (!TEST_EMAIL) {
  console.error('Set TEST_EMAIL env var to the email to use for the test');
  process.exit(1);
}

(async () => {
  try {
    const adminKey = SERVICE_KEY || ANON_KEY;
    if (!adminKey) {
      console.error('Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY/EXPO_PUBLIC_SUPABASE_ANON_KEY');
      process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, adminKey);

    let userId = null;

    if (SERVICE_KEY) {
      console.log('Using service role key: creating user via admin API');
      const { data: createData, error: createErr } = await supabase.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        user_metadata: { name: TEST_NAME },
      });
      if (createErr) throw createErr;
      userId = createData.user.id || createData.id || (createData.user && createData.user.id);
      console.log('Created user id:', userId);
    } else {
      console.log('No service role key: attempting signUp via anon key');
      const supAnon = createClient(SUPABASE_URL, ANON_KEY);
      const { data: signUpData, error: signUpErr } = await supAnon.auth.signUp({ email: TEST_EMAIL, password: TEST_PASSWORD });
      if (signUpErr) {
        // if user already exists, try signIn
        console.warn('signUp returned error:', signUpErr.message || signUpErr);
      } else {
        userId = (signUpData.user && signUpData.user.id) || (signUpData.user_id || null);
        console.log('signUp response user id:', userId);
      }

      // Try sign in to obtain session and user id
      const { data: signInData, error: signInErr } = await supAnon.auth.signInWithPassword({ email: TEST_EMAIL, password: TEST_PASSWORD });
      if (signInErr) {
        console.warn('signIn error:', signInErr.message || signInErr);
      }
      userId = userId || (signInData?.session?.user?.id);
      if (!userId) console.warn('No user id available yet (email confirm might be required). You can still check DB manually.');
    }

    // Ensure defaults for the user
    if (!userId) {
      console.error('User id not available; aborting default creation. Consider using SUPABASE_SERVICE_ROLE_KEY or confirming email.');
      process.exit(1);
    }

    console.log('Ensuring default categories for user:', userId);

    // Load existing personal categories
    const { data: existingData, error: fetchErr } = await supabase
      .from('categories')
      .select('type,name')
      .eq('user_id', userId)
      .is('party_id', null);

    if (fetchErr) throw fetchErr;

    const existingSet = new Set((existingData || []).map((r) => `${r.type}::${r.name}`));

    const defaults = [
      { type: 'income', name: '월급' },
      { type: 'income', name: '기타' },
      { type: 'expense', name: '식비' },
      { type: 'expense', name: '생필품' },
      { type: 'expense', name: '공과금' },
      { type: 'expense', name: '월세' },
      { type: 'expense', name: '기타' },
    ];

    const toInsert = defaults
      .filter((d) => !existingSet.has(`${d.type}::${d.name}`))
      .map((d) => ({ id: cryptoRandomUUID(), user_id: userId, party_id: null, type: d.type, name: d.name }));

    if (toInsert.length > 0) {
      const { error: insertErr } = await supabase.from('categories').insert(toInsert);
      if (insertErr) throw insertErr;
      console.log('Inserted', toInsert.length, 'default categories');
    } else {
      console.log('No categories to insert; defaults already present');
    }

    // Print resulting categories
    const { data: finalCats, error: finalErr } = await supabase
      .from('categories')
      .select('*')
      .eq('user_id', userId)
      .is('party_id', null)
      .order('type', { ascending: true })
      .order('name', { ascending: true });

    if (finalErr) throw finalErr;

    console.log('Personal categories for user:', TEST_EMAIL);
    console.table((finalCats || []).map(c => ({ id: c.id, type: c.type, name: c.name })));

    console.log('\nManual SQL checks you can run in Supabase SQL editor:');
    console.log(`SELECT id, type, name FROM categories WHERE user_id = '${userId}' AND party_id IS NULL ORDER BY type, name;`);

    // helper UUID
    function cryptoRandomUUID() {
      // Node 14+ has crypto.randomUUID
      try { return require('crypto').randomUUID(); } catch (e) {
        // fallback
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); });
      }
    }

  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
})();
