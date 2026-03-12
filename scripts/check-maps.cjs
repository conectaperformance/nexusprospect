require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMapsLeads() {
    const { data, error } = await supabase
        .from('leads')
        .select('id, name, source, created_at')
        .eq('source', 'google_maps')
        .order('created_at', { ascending: false })
        .limit(2);
        
    console.log("LAST 2 MAPS LEADS:");
    console.log(JSON.stringify(data, null, 2));
}

checkMapsLeads();
