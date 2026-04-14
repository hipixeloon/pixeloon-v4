import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    const { niche, tone, country, referenceText, userId: bodyUserId } = await req.json();

    if (!niche) {
      return new Response(
        JSON.stringify({ error: "Niche is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Identify user
    let userId = bodyUserId;
    if (!userId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await supabase.auth.getUser(token)
        userId = user?.id
      }
    }

    // Require user-specific Gemini key
    let GEMINI_API_KEY: string | null = null;
    
    if (userId) {
      const { data: keyData } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', userId)
        .eq('key_name', 'gemini')
        .single();
      
      if (keyData?.api_key) {
        GEMINI_API_KEY = keyData.api_key;
        console.log(`Using user-specific Gemini key for user ${userId}`);
      }
    }

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "No Gemini API key found. Please configure it in Settings." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const systemPrompt = `You are a world-class social media strategist and brand assistant. Your job is to generate a comprehensive profile strategy for a new creator/brand based on the inputs provided.

INPUTS:
- Niche: ${niche}
- Desired Tone: ${tone || 'Professional yet engaging'}
- Target Country/Audience: ${country || 'Global'}
${referenceText ? `- Reference Material to match style: "${referenceText}"` : ''}

CRITICAL RULES:
1. Provide exactly 10 username suggestions.
2. Provide 2 Bio options each for Instagram, Facebook, and YouTube. Bios must include a Call To Action (CTA).
3. Provide 3 branding tone/word-choice suggestions (e.g., words to rely on).
4. Provide 3 hook styles that work well for this niche.

Return ONLY a valid JSON object matching the function schema.`;

    const requestBody = {
      contents: [{ role: 'user', parts: [{ text: "Generate the profile assistant strategy." }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        temperature: 0.9,
      },
      tools: [{
        functionDeclarations: [{
          name: 'generate_profile_strategy',
          description: 'Outputs a detailed profile setup strategy',
          parameters: {
            type: 'OBJECT',
            properties: {
              usernames: { type: 'ARRAY', items: { type: 'STRING' }, description: '10 unique username ideas' },
              instagramBios: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 IG bio options with emojis and CTAs' },
              facebookBios: { type: 'ARRAY', items: { type: 'STRING' }, description: "2 Facebook 'About' section options" },
              youtubeBios: { type: 'ARRAY', items: { type: 'STRING' }, description: '2 YouTube Channel description options' },
              brandingToneSuggestions: { type: 'ARRAY', items: { type: 'STRING' }, description: '3 specific branding/tone tips or power words' },
              hookStyles: { type: 'ARRAY', items: { type: 'STRING' }, description: '3 specific hook formulas for their videos' }
            },
            required: ['usernames', 'instagramBios', 'facebookBios', 'youtubeBios', 'brandingToneSuggestions', 'hookStyles']
          }
        }]
      }],
      toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['generate_profile_strategy'] } }
    };

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const functionCall = candidate?.content?.parts?.find((p: any) => p.functionCall)?.functionCall;
    
    if (functionCall?.args) {
      return new Response(
        JSON.stringify({ success: true, data: functionCall.args }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    throw new Error('Failed to parse Gemini response');

  } catch (error) {
    console.error("profile-assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
