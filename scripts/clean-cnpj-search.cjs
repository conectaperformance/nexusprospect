require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanSearchTerms() {
    console.log("Cleaning raw JSON from search_term...");
    const { data: leads, error: fetchErr } = await supabase
        .from('leads_cnpj')
        .select('id, search_term');
        
    if (fetchErr) {
        console.error("Fetch error:", fetchErr);
        return;
    }
    
    let updated = 0;
    for (const lead of leads) {
        if (lead.search_term) {
            const { error: updateErr } = await supabase
                .from('leads_cnpj')
                .update({ search_term: null })
                .eq('id', lead.id);
                
            if (updateErr) {
                console.error(`Failed to update lead ${lead.id}:`, updateErr);
            } else {
                updated++;
            }
        }
    }
    
    console.log(`Successfully cleaned ${updated} leads.`);
}

cleanSearchTerms();
