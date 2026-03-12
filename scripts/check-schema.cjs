require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Fetching table columns for leads_cnpj...");
    
    // We can query the information_schema via a direct query if possible, 
    // or just fetch 1 row and print its keys.
    const { data, error } = await supabase
        .from('leads_cnpj')
        .select('*')
        .limit(1);
        
    if (error) {
        console.error("Fetch error:", error);
    } else {
        if (data.length > 0) {
            console.log("Columns:", Object.keys(data[0]));
        } else {
            console.log("No data found to infer columns. Please check manually.");
        }
    }
}

checkSchema();
