require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteLeads() {
    const { error } = await supabase
        .from('leads')
        .delete()
        .eq('source', 'cdd-extension');
        
    if (error) {
        console.error("Error deleting leads:", error);
    } else {
        console.log("Successfully deleted invalid leads.");
    }
}

deleteLeads();
