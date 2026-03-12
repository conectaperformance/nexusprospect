import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLeads() {
    console.log("Fetching last 10 leads...");
    const { data, error } = await supabase
        .from('leads')
        .select('id, name, company, source, created_at')
        .order('created_at', { ascending: false })
        .limit(10);
        
    if (error) {
        console.error("Error:", error);
    } else {
        console.log("Recent leads:");
        console.table(data);
    }
}

checkLeads();
