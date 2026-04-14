import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const url = new URL(req.url)
    let action = url.searchParams.get('action')

    let parsedBody: any = null
    if (req.method === 'POST') {
      try {
        parsedBody = await req.json()
        if (!action) action = parsedBody?.action
      } catch { }
    }

    // Try to get userId from body or Authorization header (Supabase JWT)
    let userId = parsedBody?.userId
    if (!userId) {
      const authHeader = req.headers.get('Authorization')
      if (authHeader) {
        const token = authHeader.replace('Bearer ', '')
        const { data: { user } } = await createClient(supabaseUrl, supabaseServiceKey).auth.getUser(token)
        userId = user?.id
      }
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const getUserApiKey = async (uid: string, keyName: string): Promise<string | null> => {
      const { data } = await supabase
        .from('user_api_keys')
        .select('api_key')
        .eq('user_id', uid)
        .eq('key_name', keyName)
        .maybeSingle()
      return data?.api_key || null
    }

    if (action === 'get-auth-url') {
      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing user context' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const googleClientId = await getUserApiKey(userId, 'youtube_client_id')
      if (!googleClientId) {
        return new Response(
          JSON.stringify({ error: 'YouTube OAuth Client ID is missing. Add it in Settings.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const redirectUri = (parsedBody?.redirect_uri as string) || 
                          url.searchParams.get('redirect_uri') || 
                          `${url.origin}/youtube-callback`
      const state = crypto.randomUUID()
      
      const scopes = [
        'https://www.googleapis.com/auth/youtube.upload',
        'https://www.googleapis.com/auth/youtube.readonly'
      ].join(' ')

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${googleClientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `state=${state}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `response_type=code`

      return new Response(
        JSON.stringify({ authUrl, state }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'exchange-token') {
      const body = parsedBody ?? await req.json()
      const { code, redirectUri, userId } = body

      if (!code || !redirectUri || !userId) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const googleClientId = await getUserApiKey(userId, 'youtube_client_id')
      const googleClientSecret = await getUserApiKey(userId, 'youtube_client_secret')
      if (!googleClientId || !googleClientSecret) {
        return new Response(
          JSON.stringify({ error: 'YouTube OAuth credentials are missing. Add Client ID and Client Secret in Settings.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri
        })
      })

      const tokenData = await tokenResponse.json()
      
      if (tokenData.error) {
        return new Response(
          JSON.stringify({ error: tokenData.error_description || tokenData.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch user's YouTube channels
      const ytResponse = await fetch('https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true', {
        headers: { 'Authorization': `Bearer ${tokenData.access_token}` }
      })
      const ytData = await ytResponse.json()
      const tokenExpiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()

      // Fetch existing channels to preserve refresh tokens if Google doesn't send them again
      const { data: existingChannels } = await supabase
        .from('youtube_channels')
        .select('channel_id, refresh_token')
        .eq('user_id', userId)

      const channelsParams = (ytData.items || []).map((item: any) => {
        const existing = existingChannels?.find((ec: any) => ec.channel_id === item.id)
        return {
          user_id: userId,
          channel_id: item.id,
          channel_name: item.snippet.title,
          channel_thumbnail: item.snippet.thumbnails?.default?.url || null,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || existing?.refresh_token || null,
          token_expires_at: tokenExpiresAt
        }
      })

      if (channelsParams.length > 0) {
        const { data, error } = await supabase
          .from('youtube_channels')
          .upsert(channelsParams, { onConflict: 'user_id,channel_id' })
          .select('id, channel_id, channel_name, channel_thumbnail')

        if (error) throw error

        return new Response(
          JSON.stringify({ channels: data, success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ channels: [], success: true, message: "No YouTube channels found for this account." }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'refresh-token') {
      const body = parsedBody ?? await req.json()
      const { refreshToken, userId } = body

      if (!refreshToken || !userId) {
        return new Response(
          JSON.stringify({ error: 'Missing refreshToken or userId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const googleClientId = await getUserApiKey(userId, 'youtube_client_id')
      const googleClientSecret = await getUserApiKey(userId, 'youtube_client_secret')
      if (!googleClientId || !googleClientSecret) {
        return new Response(
          JSON.stringify({ error: 'YouTube OAuth credentials are missing. Add Client ID and Client Secret in Settings.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: googleClientId,
          client_secret: googleClientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token'
        })
      })

      const tokenData = await tokenResponse.json()
      
      if (tokenData.error) {
        return new Response(
          JSON.stringify({ error: tokenData.error_description || tokenData.error }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const expiry = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString()

      return new Response(
        JSON.stringify({ 
          access_token: tokenData.access_token, 
          expires_at: expiry 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in youtube-oauth:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
