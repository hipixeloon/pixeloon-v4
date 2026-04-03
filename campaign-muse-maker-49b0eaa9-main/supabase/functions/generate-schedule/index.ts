import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ============ Google Drive API Authentication ============

function base64UrlEncode(data: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < data.length; i++) {
    binary += String.fromCharCode(data[i])
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function textToBase64Url(text: string): string {
  const encoder = new TextEncoder()
  return base64UrlEncode(encoder.encode(text))
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  let processed = pem
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
  
  const b64 = processed
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/[\r\n\s]/g, '')
  
  const binaryString = atob(b64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const keyData = pemToArrayBuffer(pem)
  return await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )
}

async function createSignedJwt(email: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }
  
  const headerB64 = textToBase64Url(JSON.stringify(header))
  const payloadB64 = textToBase64Url(JSON.stringify(payload))
  const unsignedToken = `${headerB64}.${payloadB64}`
  
  const key = await importPrivateKey(privateKey)
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsignedToken))
  return `${unsignedToken}.${base64UrlEncode(new Uint8Array(signature))}`
}

async function getGoogleAccessToken(): Promise<string> {
  const email = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
  const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')
  
  if (!email || !privateKey) {
    throw new Error('Google service account credentials not configured')
  }
  
  const jwt = await createSignedJwt(email, privateKey)
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ 
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', 
      assertion: jwt 
    })
  })
  
  if (!response.ok) {
    throw new Error(`Google OAuth error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.access_token
}

// ============ Folder Video Fetching (Parallel + Optimized) ============

// Process folders in parallel batches for speed
async function processFoldersInParallel<T>(
  items: T[],
  processor: (item: T) => Promise<string[]>,
  batchSize: number = 10
): Promise<string[]> {
  const results: string[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    for (const r of batchResults) results.push(...r)
  }
  return results
}

// Recursively list all videos in a folder and its subfolders (parallel)
async function getVideosFromFolderRecursive(
  folderId: string, 
  accessToken: string,
  maxDepth: number = 10
): Promise<string[]> {
  if (maxDepth <= 0) return []
  
  const videos: string[] = []
  const subfolders: string[] = []
  let pageToken: string | undefined
  
  do {
    const query = `'${folderId}' in parents and trashed = false`
    let listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)&pageSize=1000&orderBy=name`
    if (pageToken) {
      listUrl += `&pageToken=${pageToken}`
    }
    
    const listResp = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!listResp.ok) {
      throw new Error(`Failed to list folder: ${listResp.status}`)
    }

    const listData = await listResp.json()
    
    for (const file of (listData.files || [])) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        subfolders.push(file.id)
        continue
      }
      
      if (file.mimeType === 'application/vnd.google-apps.shortcut') {
        if (file.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder') {
          subfolders.push(file.shortcutDetails.targetId)
        } else if (file.shortcutDetails?.targetId) {
          videos.push(`https://drive.google.com/file/d/${file.shortcutDetails.targetId}/view`)
        }
        continue
      }
      
      if (file.mimeType?.startsWith('video/')) {
        videos.push(`https://drive.google.com/file/d/${file.id}/view`)
      }
    }
    
    pageToken = listData.nextPageToken
  } while (pageToken)
  
  // Process subfolders in parallel (10 at a time)
  if (subfolders.length > 0) {
    const subVideos = await processFoldersInParallel(
      subfolders,
      (subfolderId) => getVideosFromFolderRecursive(subfolderId, accessToken, maxDepth - 1),
      10
    )
    videos.push(...subVideos)
  }
  
  return videos
}

async function getVideosFromFolder(folderId: string, accessToken: string): Promise<string[]> {
  console.log(`Fetching videos recursively from folder: ${folderId}`)
  const videos = await getVideosFromFolderRecursive(folderId, accessToken, 10)
  console.log(`Found ${videos.length} videos total (including nested folders)`)
  return videos
}

// Quality thresholds
const MIN_DIMENSION = 720
const EXTREME_RATIO_MIN = 0.4 // 2:5 extreme portrait
const EXTREME_RATIO_MAX = 2.5 // 5:2 extreme landscape

// Check video quality via Google Drive API
async function checkVideoQuality(
  fileId: string, 
  accessToken: string
): Promise<{ pass: boolean; reason?: string; width?: number; height?: number }> {
  try {
    // Get video metadata including dimensions
    const metadataResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,videoMediaMetadata`, 
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    
    if (!metadataResp.ok) {
      return { pass: false, reason: 'Cannot access file' }
    }
    
    const metadata = await metadataResp.json()
    
    // Check if video has metadata
    if (!metadata.videoMediaMetadata) {
      // No video metadata available - allow it through (will be checked at post time)
      return { pass: true }
    }
    
    const { width, height } = metadata.videoMediaMetadata
    
    if (!width || !height) {
      return { pass: true } // Allow if no dimensions
    }
    
    const minDim = Math.min(width, height)
    const aspectRatio = width / height
    
    // Check minimum resolution
    if (minDim < MIN_DIMENSION) {
      return { 
        pass: false, 
        reason: `Resolution too low (${width}x${height}) - min 720p required`,
        width,
        height
      }
    }
    
    // Check extreme aspect ratio
    if (aspectRatio < EXTREME_RATIO_MIN || aspectRatio > EXTREME_RATIO_MAX) {
      return { 
        pass: false, 
        reason: `Extreme aspect ratio (${aspectRatio.toFixed(2)}) - may be rejected`,
        width,
        height
      }
    }
    
    return { pass: true, width, height }
  } catch (error) {
    console.error(`Error checking quality for ${fileId}:`, error)
    return { pass: true } // Allow on error (will be checked at post time)
  }
}

// Extract file ID from Drive URL
function extractFileId(url: string): string | null {
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

// Batch insert helper to bypass Supabase row limits
async function batchInsertPosts(
  supabase: any,
  posts: any[],
  batchSize: number = 500
): Promise<void> {
  console.log(`Batch inserting ${posts.length} posts in chunks of ${batchSize}`)
  
  for (let i = 0; i < posts.length; i += batchSize) {
    const batch = posts.slice(i, i + batchSize)
    const { error } = await supabase.from('scheduled_posts').insert(batch)
    
    if (error) {
      console.error(`Batch insert error at index ${i}:`, error)
      throw error
    }
    
    console.log(`Inserted batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(posts.length / batchSize)}`)
  }
}

// Function to add random offset to a time
function applyRandomOffset(baseTime: Date, randomize: boolean, rangeMinutes: number): Date {
  if (!randomize) return baseTime
  
  // Random offset between -rangeMinutes and +rangeMinutes
  const offsetMinutes = Math.floor(Math.random() * (rangeMinutes * 2 + 1)) - rangeMinutes
  const result = new Date(baseTime)
  result.setMinutes(result.getMinutes() + offsetMinutes)
  return result
}

// Helper: Get current time in a specific timezone
function getNowInTimezone(timezone: string): Date {
  // Create a date string in the target timezone, then parse it back
  const nowStr = new Date().toLocaleString('en-US', { timeZone: timezone })
  return new Date(nowStr)
}

// Helper: Create a date at specific time in a timezone, returned as UTC
function createDateInTimezone(
  baseDate: Date, 
  hours: number, 
  minutes: number, 
  timezone: string
): Date {
  // Format: YYYY-MM-DDTHH:MM:SS
  const year = baseDate.getFullYear()
  const month = String(baseDate.getMonth() + 1).padStart(2, '0')
  const day = String(baseDate.getDate()).padStart(2, '0')
  const h = String(hours).padStart(2, '0')
  const m = String(minutes).padStart(2, '0')
  
  const dateStr = `${year}-${month}-${day}T${h}:${m}:00`
  
  // Use Intl to get the UTC offset for this specific date/time in the timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
  
  // Create a Date object and adjust for timezone
  // This approach: create the date as if it were UTC, then adjust
  const localDate = new Date(dateStr)
  
  // Get the offset by comparing local interpretation vs UTC
  const utcDate = new Date(dateStr + 'Z')
  const tzDate = new Date(utcDate.toLocaleString('en-US', { timeZone: timezone }))
  const offset = utcDate.getTime() - tzDate.getTime()
  
  return new Date(localDate.getTime() + offset)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const { 
      campaignId, 
      days, 
      generateAI = true, 
      scheduleAllVideos = true, 
      skipLowQuality = false,
      timezone = 'Asia/Kolkata', // Default to IST
      startFromTomorrow = false 
    } = await req.json()

    if (!campaignId) {
      return new Response(
        JSON.stringify({ error: 'campaignId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Generating schedule for campaign:', campaignId, 'days:', days, 'generateAI:', generateAI, 'scheduleAllVideos:', scheduleAllVideos, 'skipLowQuality:', skipLowQuality, 'timezone:', timezone, 'startFromTomorrow:', startFromTomorrow)

    // Get campaign with video links and folder info
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .select('*')
      .eq('id', campaignId)
      .single()

    if (campaignError || !campaign) {
      throw new Error('Campaign not found')
    }

    // Get campaign pages
    const { data: campaignPages, error: pagesError } = await supabase
      .from('campaign_pages')
      .select('facebook_page_id')
      .eq('campaign_id', campaignId)

    if (pagesError) throw pagesError

    // Get campaign Instagram accounts
    const { data: campaignInstagram, error: igError } = await supabase
      .from('campaign_instagram_accounts')
      .select('instagram_account_id')
      .eq('campaign_id', campaignId)

    if (igError) throw igError

    // Get campaign YouTube channels
    const { data: campaignYouTube, error: ytError } = await supabase
      .from('campaign_youtube_channels')
      .select('youtube_channel_id')
      .eq('campaign_id', campaignId)

    if (ytError) throw ytError

    // Get post times
    const { data: postTimes, error: timesError } = await supabase
      .from('campaign_post_times')
      .select('*')
      .eq('campaign_id', campaignId)
      .order('post_time', { ascending: true })

    if (timesError) throw timesError

    if (!campaignPages?.length && !campaignInstagram?.length && !campaignYouTube?.length) {
      return new Response(
        JSON.stringify({ error: 'Campaign missing platform connections' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!postTimes?.length) {
      return new Response(
        JSON.stringify({ error: 'Campaign missing post times' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get ALL existing scheduled posts for this campaign to prevent duplicates
    // Fetch in batches since there could be thousands
    let existingVideoUrls: Set<string> = new Set()
    let hasMore = true
    let offset = 0
    const batchSize = 1000

    console.log('Fetching existing scheduled posts to prevent duplicates...')
    
    while (hasMore) {
      const { data: existingPosts, error: existingError } = await supabase
        .from('scheduled_posts')
        .select('video_url')
        .eq('campaign_id', campaignId)
        .range(offset, offset + batchSize - 1)
      
      if (existingError) throw existingError
      
      if (existingPosts && existingPosts.length > 0) {
        existingPosts.forEach(p => existingVideoUrls.add(p.video_url))
        offset += batchSize
        hasMore = existingPosts.length === batchSize
      } else {
        hasMore = false
      }
    }
    
    console.log(`Found ${existingVideoUrls.size} videos already scheduled for this campaign`)

    // Determine video sources: either from folder or manual links
    let videoLinks: string[] = []
    
    if (campaign.drive_folder_id) {
      // Fetch videos from Google Drive folder
      console.log('Fetching videos from folder:', campaign.drive_folder_id)
      const accessToken = await getGoogleAccessToken()
      videoLinks = await getVideosFromFolder(campaign.drive_folder_id, accessToken)
      
      if (videoLinks.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No videos found in the linked folder' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
    } else if (campaign.video_links?.length) {
      // Use manually specified video links
      videoLinks = campaign.video_links as string[]
    } else {
      return new Response(
        JSON.stringify({ error: 'Campaign has no folder or video links configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Found ${videoLinks.length} total videos from source`)

    // Filter out already scheduled videos to prevent duplicates
    let newVideoLinks = videoLinks.filter(url => !existingVideoUrls.has(url))
    const duplicatesSkipped = videoLinks.length - newVideoLinks.length
    
    console.log(`${newVideoLinks.length} new videos to schedule (${duplicatesSkipped} already scheduled)`)

    // Quality filtering if enabled
    let qualitySkipped = 0
    if (skipLowQuality && newVideoLinks.length > 0) {
      console.log('Checking video quality (skipLowQuality enabled)...')
      const accessToken = campaign.drive_folder_id ? await getGoogleAccessToken() : null
      
      if (accessToken) {
        const qualityChecks = await Promise.all(
          newVideoLinks.slice(0, 100).map(async (url) => { // Limit to 100 for speed
            const fileId = extractFileId(url)
            if (!fileId) return { url, pass: true }
            const result = await checkVideoQuality(fileId, accessToken)
            return { url, ...result }
          })
        )
        
        const failedUrls = new Set(qualityChecks.filter(r => !r.pass).map(r => r.url))
        qualitySkipped = failedUrls.size
        newVideoLinks = newVideoLinks.filter(url => !failedUrls.has(url))
        
        console.log(`Quality check: ${qualitySkipped} videos skipped (low quality), ${newVideoLinks.length} passed`)
      }
    }

    if (newVideoLinks.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          postsCreated: 0,
          videosScheduled: 0,
          videosFound: videoLinks.length,
          duplicatesSkipped,
          qualitySkipped,
          daysSpanned: 0,
          sourceType: campaign.drive_folder_id ? 'folder' : 'manual',
          message: `No videos to schedule. ${duplicatesSkipped} already scheduled, ${qualitySkipped} skipped for quality.`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const scheduledPosts: any[] = []
    const isAIEnabled = campaign.template_type === 'ai'
    const postsPerDay = postTimes.length

    // Calculate how many days needed to schedule ALL NEW videos
    let totalDays: number
    if (scheduleAllVideos && !days) {
      totalDays = Math.ceil(newVideoLinks.length / postsPerDay)
      console.log(`Auto-calculated ${totalDays} days needed to schedule all ${newVideoLinks.length} new videos (${postsPerDay} posts/day)`)
    } else {
      totalDays = days || 7
    }

    let videoIndex = 0
    const totalVideos = newVideoLinks.length

    // Get current time in user's timezone for comparison
    const nowInTz = getNowInTimezone(timezone)
    const nowUtc = new Date()
    
    console.log(`Current time - UTC: ${nowUtc.toISOString()}, User timezone (${timezone}): ${nowInTz.toLocaleString()}`)

    // Determine starting day offset
    // If startFromTomorrow is true, always start from day 1 (tomorrow)
    // Otherwise start from day 0 (today) but skip past times
    const startDayOffset = startFromTomorrow ? 1 : 0

    // Generate posts - iterate through all NEW videos
    for (let dayIndex = 0; dayIndex < totalDays && videoIndex < totalVideos; dayIndex++) {
      // Create base date in user's timezone
      const baseDate = new Date(nowInTz)
      baseDate.setDate(baseDate.getDate() + dayIndex + startDayOffset)
      
      console.log(`Scheduling for day ${dayIndex + 1} (${startFromTomorrow ? 'tomorrow+' + dayIndex : 'today+' + dayIndex}): ${baseDate.toDateString()}`)

      // For each post time slot
      for (const postTime of postTimes) {
        if (videoIndex >= totalVideos) break

        const [hours, minutes] = postTime.post_time.split(':').map(Number)
        
        // Create scheduled time in user's timezone, converted to UTC for storage
        const scheduledDate = createDateInTimezone(baseDate, hours, minutes, timezone)

        // Skip if the time is in the past (compare UTC times)
        if (scheduledDate <= nowUtc) {
          console.log(`Skipping past time: ${scheduledDate.toISOString()} (${hours}:${minutes} ${timezone})`)
          continue
        }

        // Apply randomization
        const actualScheduledTime = applyRandomOffset(
          scheduledDate,
          postTime.randomize,
          postTime.random_range_minutes
        )

        // Get next video (use each video once)
        const videoUrl = newVideoLinks[videoIndex]
        videoIndex++

        // For AI mode: caption will be generated at post time
        // For manual mode: use the custom caption
        const caption = isAIEnabled ? null : (campaign.custom_caption || campaign.description || '')
        const hashtags: string[] = isAIEnabled ? [] : (campaign.hashtags || [])

        // Create a post for each Facebook page
        if (campaignPages && campaignPages.length > 0) {
          for (const page of campaignPages) {
            scheduledPosts.push({
              campaign_id: campaignId,
              facebook_page_id: page.facebook_page_id,
              platform: 'facebook',
              video_url: videoUrl,
              caption,
              hashtags,
              scheduled_time: actualScheduledTime.toISOString(),
              status: 'pending',
              needs_ai_caption: isAIEnabled && generateAI,
            })
          }
        }

        // Create a post for each Instagram account
        if (campaignInstagram && campaignInstagram.length > 0) {
          for (const ig of campaignInstagram) {
            scheduledPosts.push({
              campaign_id: campaignId,
              instagram_account_id: ig.instagram_account_id,
              platform: 'instagram',
              video_url: videoUrl,
              caption,
              hashtags,
              scheduled_time: actualScheduledTime.toISOString(),
              status: 'pending',
              needs_ai_caption: isAIEnabled && generateAI,
            })
          }
        }

        // Create a post for each YouTube channel
        if (campaignYouTube && campaignYouTube.length > 0) {
          for (const yt of campaignYouTube) {
            scheduledPosts.push({
              campaign_id: campaignId,
              youtube_channel_id: yt.youtube_channel_id,
              platform: 'youtube',
              video_url: videoUrl,
              caption,
              hashtags,
              scheduled_time: actualScheduledTime.toISOString(),
              status: 'pending',
              needs_ai_caption: isAIEnabled && generateAI,
            })
          }
        }
      }
    }

    console.log(`Generated ${scheduledPosts.length} scheduled posts for ${videoIndex} new videos across ${totalDays} days`)

    // Batch insert all scheduled posts (500 at a time to avoid limits)
    if (scheduledPosts.length > 0) {
      await batchInsertPosts(supabase, scheduledPosts, 500)
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        postsCreated: scheduledPosts.length,
        videosScheduled: videoIndex,
        videosFound: videoLinks.length,
        duplicatesSkipped,
        daysSpanned: totalDays,
        sourceType: campaign.drive_folder_id ? 'folder' : 'manual',
        message: `Created ${scheduledPosts.length} scheduled posts for ${videoIndex} new videos across ${totalDays} days.${duplicatesSkipped > 0 ? ` Skipped ${duplicatesSkipped} already scheduled.` : ''}`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Schedule generator error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
