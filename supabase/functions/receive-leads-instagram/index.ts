import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-host',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

serve(async (req) => {
    // 1. CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        if (req.method !== 'POST') {
            return new Response(JSON.stringify({ error: 'Método não permitido.' }), {
                status: 405,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 2. Extrair a chave do webhook (webhook_key)
        const url = new URL(req.url)
        let webhookKey = url.searchParams.get('key')

        if (!webhookKey) {
            const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || ''
            const hostMatch = host.match(/^([^.]+)\.conectalab\.sbs$/i)
            if (hostMatch && hostMatch[1]) {
                webhookKey = hostMatch[1]
            }
        }

        if (!webhookKey) {
            return new Response(JSON.stringify({
                error: 'Chave do webhook ausente. Adicione ?key=SUACHAVE na URL ou use o domínio correto.'
            }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 3. Conectar ao Supabase (com bypass de RLS via Service Role)
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

        // 4. Buscar o usuário correspondente a essa webhook_key (Case-insensitive para domínios)
        const { data: profile, error: profileErr } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .ilike('webhook_key', webhookKey)
            .single()

        if (profileErr || !profile) {
            console.error(`Webhook Inválido ou Usuário Não Encontrado para a chave "${webhookKey}":`, profileErr);
            return new Response(JSON.stringify({ error: `Webhook inválido ou não autorizado. Chave recebida: ${webhookKey}` }), {
                status: 401,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        const userId = profile.id;

        // 5. Ler o Payload (Array de leads)
        let incomingLeads: any;
        try {
            const bodyText = await req.text()
            if (!bodyText) {
                return new Response(JSON.stringify({ error: 'Body vazio.' }), { status: 400, headers: corsHeaders })
            }
            incomingLeads = JSON.parse(bodyText)
        } catch (err) {
            return new Response(JSON.stringify({ error: 'Payload JSON inválido.' }), {
                status: 400,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        if (!Array.isArray(incomingLeads)) {
            // Se o payload for um objeto embrulhado { source: '...', items: [...] } (Extensão CNPJ/CDD)
            if (incomingLeads && Array.isArray(incomingLeads.items)) {
                incomingLeads = incomingLeads.items;
            } else if (incomingLeads && Array.isArray(incomingLeads.data)) {
                incomingLeads = incomingLeads.data;
            } else {
                incomingLeads = [incomingLeads];
            }
        }

        if (incomingLeads.length === 0) {
            return new Response(JSON.stringify({ success: true, message: 'Nenhum lead recebido.' }), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            })
        }

        // 6. Mapear os dados recebidos para o formato do banco de dados (Forçado para Instagram)
        const mappedLeads = incomingLeads.map((item: any) => {
            console.log("Recebido lead Instagram:", JSON.stringify(item).substring(0, 500));
            
            return {
                user_id: userId,
                name: item.nome_empresa || item.name || item.razao_social || item.Nome || item.razaoSocial || item.fantasia || 'Sem Nome',
                company: item.nome_empresa || item.company || item.razao_social || item.Nome || item.razaoSocial || item.fantasia || null,
                phone: item.telefone || item.phone || item.telefone1 || item.telefone2 || item.celular || null,
                address: item.endereco || item.address || item.logradouro || item.municipio || null,
                website: item.website || item.site || null,
                rating: item.rating ? String(item.rating).replace(',', '.') : null,
                reviews: item.reviews ? String(item.reviews).replace(/\D/g, '') : null,
                specialties: item.especialidades || item.specialties || item.cnpj || item.cnae_principal_descricao || item.atividade_principal || null,
                source: 'instagram',
                search_term: JSON.stringify(item).substring(0, 1000),
            };
        });

        // Opcional: Lote (batch) insert para não estourar payload se houver muitos leads (> 1000)
        const BATCH_SIZE = 500;
        let insertedCount = 0;

        for (let i = 0; i < mappedLeads.length; i += BATCH_SIZE) {
            const batch = mappedLeads.slice(i, i + BATCH_SIZE);
            const { error: insertErr } = await supabaseAdmin
                .from('leads_instagram') // <--- Inserindo na tabela dedicada
                .insert(batch)
            
            if (insertErr) {
                console.error(`Erro ao inserir lote ${i} a ${i + BATCH_SIZE}:`, insertErr);
                throw new Error(`Erro de inserção no banco: ${insertErr.message}`);
            }
            insertedCount += batch.length;
        }

        // 7. Sucesso!
        return new Response(JSON.stringify({
            success: true,
            message: `${insertedCount} leads recebidos e inseridos com sucesso na tabela leads_instagram.`
        }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })

    } catch (error: any) {
        console.error('Erro na Edge Function receive-leads-instagram:', error)
        return new Response(JSON.stringify({ error: 'Erro interno no servidor.', details: error.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
    }
})
