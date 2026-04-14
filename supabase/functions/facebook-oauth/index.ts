import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Debug info structure
interface FetchDebugInfo {
  meAccountsCount: number;
  meAccountsError: string | null;
  businessesCount: number;
  businessesError: string | null;
  ownedPagesCount: number;
  ownedPagesErrors: string[];
  totalBeforeDedup: number;
  totalAfterDedup: number;
}

// Helper function to fetch all pages from Facebook with debug info
async function fetchAllFacebookPagesWithDebug(userAccessToken: string): Promise<{ pages: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[]; debug: FetchDebugInfo }> {
  const allPages: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[] = []
  const debug: FetchDebugInfo = {
    meAccountsCount: 0,
    meAccountsError: null,
    businessesCount: 0,
    businessesError: null,
    ownedPagesCount: 0,
    ownedPagesErrors: [],
    totalBeforeDedup: 0,
    totalAfterDedup: 0,
  }

  // 1) Pages user has direct access to via /me/accounts
  try {
    let nextUrl: string | null = `https://graph.facebook.com/v18.0/me/accounts?access_token=${userAccessToken}&limit=100&fields=id,name,access_token,instagram_business_account{id,username}`
    while (nextUrl) {
      const pagesResponse = await fetch(nextUrl)
      const pagesData = await pagesResponse.json() as {
        data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[]
        paging?: { next?: string }
        error?: { message: string }
      }
      console.log('Pages response (/me/accounts):', JSON.stringify({ count: pagesData.data?.length, hasNext: !!pagesData.paging?.next }))

      if (pagesData.error) {
        debug.meAccountsError = pagesData.error.message
        break
      }

      if (pagesData.data) {
        debug.meAccountsCount += pagesData.data.length
        allPages.push(...pagesData.data)
      }

      nextUrl = pagesData.paging?.next || null
    }
  } catch (e) {
    debug.meAccountsError = e instanceof Error ? e.message : String(e)
  }

  // 2) Also try Business-owned pages (requires business_management)
  try {
    const bizRes = await fetch(
      `https://graph.facebook.com/v18.0/me/businesses?access_token=${userAccessToken}&limit=100&fields=id,name`
    )
    const bizData = await bizRes.json() as {
      data?: { id: string; name: string }[]
      error?: { message: string }
    }

    if (bizData.error) {
      debug.businessesError = bizData.error.message
      console.log('Businesses fetch skipped:', bizData.error.message)
    } else {
      const businesses = bizData.data || []
      debug.businessesCount = businesses.length
      console.log('Businesses found:', businesses.length)

      for (const biz of businesses) {
        try {
          let ownedNext: string | null = `https://graph.facebook.com/v18.0/${biz.id}/owned_pages?access_token=${userAccessToken}&limit=100&fields=id,name,access_token,instagram_business_account{id,username}`
          while (ownedNext) {
            const ownedRes = await fetch(ownedNext)
            const ownedData = await ownedRes.json() as {
              data?: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[]
              paging?: { next?: string }
              error?: { message: string }
            }

            console.log('Pages response (owned_pages):', JSON.stringify({ business: biz.id, count: ownedData.data?.length, hasNext: !!ownedData.paging?.next }))

            if (ownedData.error) {
              debug.ownedPagesErrors.push(`${biz.name}: ${ownedData.error.message}`)
              break
            }

            if (ownedData.data) {
              debug.ownedPagesCount += ownedData.data.length
              allPages.push(...ownedData.data)
            }

            ownedNext = ownedData.paging?.next || null
          }
        } catch (e) {
          debug.ownedPagesErrors.push(`${biz.name}: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
  } catch (e) {
    debug.businessesError = e instanceof Error ? e.message : String(e)
    console.log('Business pages fetch failed (non-fatal):', debug.businessesError)
  }

  debug.totalBeforeDedup = allPages.length

  // De-dupe by page id
  const uniq = new Map<string, { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }>()
  for (const p of allPages) {
    if (!uniq.has(p.id)) uniq.set(p.id, p)
  }

  const deduped = Array.from(uniq.values())
  debug.totalAfterDedup = deduped.length
  console.log('Total pages fetched from Facebook (deduped):', deduped.length)
  
  return { pages: deduped, debug }
}

// Helper function to save pages to database
type OAuthActionBody = {
  action?: string
  userId?: string
  redirect_uri?: string
  code?: string
  redirectUri?: string
}

async function savePagesToDatabase(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  pages: { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username: string } }[]
) {
  if (pages.length === 0) {
    return { fbPages: [], igPages: [] }
  }
  
  // Prepare all pages for upsert
  const pagesToUpsert = pages.map(page => ({
    user_id: userId,
    page_id: page.id,
    page_name: page.name,
    access_token: page.access_token,
  }))

  // 1. Upsert all FB pages first to get their database UUIDs
  const { data: savedData, error: upsertError } = await supabase
    .from('facebook_pages')
    .upsert(pagesToUpsert, {
      onConflict: 'user_id,page_id'
    })
    .select('id, page_id, page_name')

  if (upsertError) {
    console.error('Error saving FB pages:', upsertError)
    throw new Error('Failed to save pages: ' + upsertError.message)
  }

  // 2. Map FB page API IDs to database UUIDs for Instagram linking
  const pageIdToUuid = new Map(savedData?.map(p => [p.page_id, p.id]) || [])

  // 3. Prepare Instagram accounts for upsert with correct UUID foreign keys
  const instagramPagesToUpsert = pages
    .filter(p => p.instagram_business_account)
    .map(p => ({
      user_id: userId,
      instagram_account_id: p.instagram_business_account!.id,
      instagram_username: p.instagram_business_account!.username,
      facebook_page_id: pageIdToUuid.get(p.id) // This is now a UUID
    }))
  
  console.log('Upserting FB pages:', pagesToUpsert.length, 'IG pages:', instagramPagesToUpsert.length)
  
  let savedIgData = null
  if (instagramPagesToUpsert.length > 0) {
    const { data, error } = await supabase
      .from('instagram_accounts')
      .upsert(instagramPagesToUpsert, {
         onConflict: 'user_id,instagram_account_id'
      })
      .select('id, instagram_account_id, instagram_username')
    
    if (error) {
      console.error('Error saving IG accounts:', error)
    } else {
      savedIgData = data
    }
  }
  
  console.log('Successfully saved pages details.')
  return { fbPages: savedData || [], igPages: savedIgData || [] }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const url = new URL(req.url)
    let action = url.searchParams.get('action')

    // Allow calling via supabase.functions.invoke (action in JSON body)
    let parsedBody: OAuthActionBody | null = null
    if (req.method === 'POST') {
      try {
        parsedBody = await req.json() as OAuthActionBody
        if (!action) action = parsedBody?.action
      } catch (_error) {
        parsedBody = null
      }
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

      const facebookAppId = await getUserApiKey(userId, 'facebook_app_id')
      if (!facebookAppId) {
        return new Response(
          JSON.stringify({ error: 'Facebook App ID is missing. Add it in Settings.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get redirect URI from body, query params or use default
      const redirectUri = (parsedBody?.redirect_uri as string) || 
                          url.searchParams.get('redirect_uri') || 
                          `${url.origin}/facebook-callback`
      const state = crypto.randomUUID()
      
      // Request all page-related permissions
      // Note: business_management will be ignored if your app isn't approved for it.
      const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
        `client_id=${facebookAppId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=pages_show_list,pages_read_engagement,pages_manage_posts,pages_read_user_content,business_management,instagram_basic,instagram_content_publish,instagram_manage_comments,instagram_manage_insights&` +
        `state=${state}&` +
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

      const facebookAppId = await getUserApiKey(userId, 'facebook_app_id')
      const facebookAppSecret = await getUserApiKey(userId, 'facebook_app_secret')
      if (!facebookAppId || !facebookAppSecret) {
        return new Response(
          JSON.stringify({ error: 'Facebook App credentials are missing. Add App ID and App Secret in Settings.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Exchange code for short-lived access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${facebookAppId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `client_secret=${facebookAppSecret}&` +
        `code=${code}`
      )

      const tokenData = await tokenResponse.json()
      console.log('Token exchange response:', JSON.stringify({ hasToken: !!tokenData.access_token }))

      if (tokenData.error) {
        return new Response(
          JSON.stringify({ error: tokenData.error.message }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const shortLivedToken = tokenData.access_token

      // Exchange for long-lived token (60 days)
      const longLivedResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `grant_type=fb_exchange_token&` +
        `client_id=${facebookAppId}&` +
        `client_secret=${facebookAppSecret}&` +
        `fb_exchange_token=${shortLivedToken}`
      )
      
      const longLivedData = await longLivedResponse.json()
      const userAccessToken = longLivedData.access_token || shortLivedToken
      console.log('Got long-lived token:', !!longLivedData.access_token)

      // Store the user access token for future syncs
      const { error: connectionError } = await supabase
        .from('facebook_connections')
        .upsert({
          user_id: userId,
          user_access_token: userAccessToken,
        }, {
          onConflict: 'user_id'
        })

      if (connectionError) {
        console.error('Error saving connection:', connectionError)
        return new Response(
          JSON.stringify({ error: 'Failed to save Facebook connection: ' + connectionError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch all pages from Facebook
      const { pages: allPages, debug } = await fetchAllFacebookPagesWithDebug(userAccessToken)
      
      // Save pages to database
      const savedPages = await savePagesToDatabase(supabase, userId, allPages)

      return new Response(
        JSON.stringify({ pages: savedPages, debug }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'sync-pages') {
      const body = parsedBody ?? await req.json()
      const { userId } = body

      if (!userId) {
        return new Response(
          JSON.stringify({ error: 'Missing userId' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get stored user access token
      const { data: connection, error: connectionError } = await supabase
        .from('facebook_connections')
        .select('user_access_token')
        .eq('user_id', userId)
        .maybeSingle()

      if (connectionError || !connection) {
        console.error('No Facebook connection found:', connectionError)
        return new Response(
          JSON.stringify({ error: 'No Facebook connection found. Please reconnect your Facebook account.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Fetch all pages from Facebook using stored token
      try {
        const { pages: allPages, debug } = await fetchAllFacebookPagesWithDebug(connection.user_access_token)
        
        // Save pages to database
        const savedPages = await savePagesToDatabase(supabase, userId, allPages)

        return new Response(
          JSON.stringify({ pages: savedPages, synced: true, debug }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      } catch (error) {
        console.error('Error syncing pages:', error)
        return new Response(
          JSON.stringify({ error: 'Failed to sync pages. Your Facebook token may have expired. Please reconnect.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in facebook-oauth function:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
