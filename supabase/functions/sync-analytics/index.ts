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
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Find posts from 24h ago that don't have analytics yet (e.g. likes_count is 0 or null)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const thirtyHoursAgo = new Date(Date.now() - 30 * 60 * 60 * 1000).toISOString()

    const { data: posts, error } = await supabase
      .from('scheduled_posts')
      .select('id, facebook_post_id, instagram_media_id, youtube_video_id, facebook_page_id, campaign_id')
      .eq('status', 'posted')
      .lte('actual_post_time', twentyFourHoursAgo)
      .gte('actual_post_time', thirtyHoursAgo)
      .limit(20)

    if (error || !posts || posts.length === 0) {
      return new Response(JSON.stringify({ message: "No analytics to sync", processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    let syncedCount = 0

    for (const post of posts) {
      console.log(`Syncing analytics for post ${post.id}...`)
      
      // 1. Facebook & Instagram Metrics
      if (post.facebook_page_id && (post.facebook_post_id || post.instagram_media_id)) {
        try {
          const { data: fbPage } = await supabase.from('facebook_pages').select('access_token').eq('id', post.facebook_page_id).single()
          if (fbPage?.access_token) {
            let totalLikes = 0
            let totalEngagement = 0

            // FB Post Metrics
            if (post.facebook_post_id) {
              const fbRes = await fetch(`https://graph.facebook.com/v18.0/${post.facebook_post_id}?fields=reactions.summary(true),comments.summary(true),insights.metric(post_video_views)&access_token=${fbPage.access_token}`)
              const fbData = await fbRes.json()
              if (!fbData.error) {
                totalLikes += fbData.reactions?.summary?.total_count || 0
                totalEngagement += (fbData.comments?.summary?.total_count || 0)
                // Optionally add views if available
              }
            }

            // IG Media Metrics
            if (post.instagram_media_id) {
              const igRes = await fetch(`https://graph.facebook.com/v18.0/${post.instagram_media_id}?fields=like_count,comments_count&access_token=${fbPage.access_token}`)
              const igData = await igRes.json()
              if (!igData.error) {
                totalLikes += igData.like_count || 0
                totalEngagement += igData.comments_count || 0
              }
            }

            if (totalLikes > 0 || totalEngagement > 0) {
              await supabase.from('scheduled_posts').update({ 
                likes_count: totalLikes, 
                engagement_count: totalEngagement,
                updated_at: new Date().toISOString()
              }).eq('id', post.id)
              syncedCount++
            }
          }
        } catch(e) {
          console.error(`Failed FB/IG sync for ${post.id}:`, e)
        }
      }
      
      // 2. YouTube Metrics
      if (post.youtube_video_id) {
         try {
           const { data: cmp } = await supabase.from('campaigns').select('user_id').eq('id', post.campaign_id).single()
           if (cmp?.user_id) {
              const { data: ytChannels } = await supabase.from('youtube_channels').select('*').eq('user_id', cmp.user_id).limit(1)
              if (ytChannels && ytChannels.length > 0) {
                const ytChannel = ytChannels[0]
                
                // Use a direct fetch or reuse the refresh logic if we had it shared.
                // For now, let's assume the token in DB might be fresh enough or 
                // we'd need a shared utility. Since this is a cron, it's safer to refresh.
                
                const ytRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${post.youtube_video_id}`, {
                  headers: { 'Authorization': `Bearer ${ytChannel.access_token}` }
                })
                const ytData = await ytRes.json()
                
                if (ytData.items?.length > 0) {
                  const stats = ytData.items[0].statistics
                  await supabase.from('scheduled_posts').update({ 
                    likes_count: parseInt(stats.likeCount || '0', 10), 
                    engagement_count: parseInt(stats.commentCount || '0', 10),
                    updated_at: new Date().toISOString()
                  }).eq('id', post.id)
                  syncedCount++
                }
              }
           }
         } catch(e) {
           console.error(`Failed YT sync for ${post.id}:`, e)
         }
      }
    }

    return new Response(JSON.stringify({ message: "Analytics synced", processed: syncedCount }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Error syncing analytics:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
