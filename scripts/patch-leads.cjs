require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function patchLeads() {
    const { error } = await supabase
        .from('leads')
        .update({ source: 'cnpj' })
        .eq('source', 'cdd-extension');
        
    if (error) {
        console.error("Error patching leads:", error);
    } else {
        console.log("Successfully patched `cdd-extension` to `cnpj` in database.");
    }
}

patchLeads();
