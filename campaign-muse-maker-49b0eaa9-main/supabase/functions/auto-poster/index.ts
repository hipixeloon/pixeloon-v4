import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { uploadVideoToInstagram } from './instagram.ts'
import { uploadVideoToYouTube } from './youtube.ts'
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ScheduledPost {
  id: string
  campaign_id: string
  facebook_page_id?: string | null
  instagram_account_id?: string | null
  youtube_channel_id?: string | null
  facebook_post_id?: string | null
  instagram_media_id?: string | null
  youtube_video_id?: string | null
  video_url: string
  caption: string | null
  hashtags: string[] | null
  scheduled_time: string
  status: string
  needs_ai_caption: boolean | null
  platforms: { facebook?: boolean; instagram?: boolean; youtube?: boolean } | null
}

interface FacebookPage {
  id: string
  page_id: string
  page_name: string
  access_token: string
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
  // Handle multiple formats: raw PEM, JSON-escaped \n, double-escaped \\n
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
    const errorText = await response.text()
    console.error('Google OAuth error:', errorText)
    throw new Error(`Google OAuth error: ${response.status}`)
  }
  
  const data = await response.json()
  return data.access_token
}

// ============ Folder Video Fetching ============

async function getVideosFromFolder(folderId: string, accessToken: string): Promise<string[]> {
  console.log(`Fetching videos from folder: ${folderId}`)
  
  const videos: string[] = []
  let pageToken: string | undefined
  
  do {
    const query = `'${folderId}' in parents and (mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.shortcut') and trashed = false`
    let listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,shortcutDetails)&pageSize=100&orderBy=name`
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
      if (file.mimeType === 'application/vnd.google-apps.shortcut' && file.shortcutDetails?.targetId) {
        // For shortcuts, use the target ID
        videos.push(`https://drive.google.com/file/d/${file.shortcutDetails.targetId}/view`)
      } else if (file.mimeType?.startsWith('video/')) {
        videos.push(`https://drive.google.com/file/d/${file.id}/view`)
      }
    }
    
    pageToken = listData.nextPageToken
  } while (pageToken)
  
  console.log(`Found ${videos.length} videos in folder`)
  return videos
}

// ============ Google Drive Download with Metadata ============

function getFileId(driveUrl: string): string | null {
  const match = driveUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

interface VideoMetadata {
  name: string
  mimeType: string
  size: number
  durationMillis?: number
  width?: number
  height?: number
}

async function getVideoMetadata(fileId: string, accessToken: string): Promise<VideoMetadata> {
  // Get extended metadata including video properties
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,shortcutDetails,videoMediaMetadata`
  const metadataResp = await fetch(metadataUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })
  
  if (!metadataResp.ok) {
    if (metadataResp.status === 404) throw new Error('File not found on Google Drive')
    if (metadataResp.status === 403) throw new Error('No permission to access file')
    throw new Error(`Failed to get file metadata: ${metadataResp.status}`)
  }
  
  const metadata = await metadataResp.json()
  
  // Handle shortcuts - resolve to actual target file
  let targetFileId = fileId
  if (metadata.mimeType === 'application/vnd.google-apps.shortcut') {
    if (!metadata.shortcutDetails?.targetId) {
      throw new Error('This is a shortcut but target file not found')
    }
    targetFileId = metadata.shortcutDetails.targetId
    
    // Get metadata of the actual file
    const targetResp = await fetch(
      `https://www.googleapis.com/drive/v3/files/${targetFileId}?fields=id,name,mimeType,size,videoMediaMetadata`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )
    
    if (targetResp.ok) {
      const targetData = await targetResp.json()
      return {
        name: targetData.name,
        mimeType: targetData.mimeType,
        size: parseInt(targetData.size || '0'),
        durationMillis: targetData.videoMediaMetadata?.durationMillis 
          ? parseInt(targetData.videoMediaMetadata.durationMillis) 
          : undefined,
        width: targetData.videoMediaMetadata?.width,
        height: targetData.videoMediaMetadata?.height,
      }
    }
  }
  
  return {
    name: metadata.name,
    mimeType: metadata.mimeType,
    size: parseInt(metadata.size || '0'),
    durationMillis: metadata.videoMediaMetadata?.durationMillis 
      ? parseInt(metadata.videoMediaMetadata.durationMillis) 
      : undefined,
    width: metadata.videoMediaMetadata?.width,
    height: metadata.videoMediaMetadata?.height,
  }
}

async function downloadFromGoogleDrive(fileId: string, accessToken: string): Promise<Blob> {
  console.log(`Downloading file ${fileId} via Google Drive API`)
  
  // First get metadata including shortcut target info
  const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,size,shortcutDetails`
  const metadataResp = await fetch(metadataUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })
  
  if (!metadataResp.ok) {
    if (metadataResp.status === 404) throw new Error('File not found on Google Drive')
    if (metadataResp.status === 403) throw new Error('No permission to access file')
    throw new Error(`Failed to get file metadata: ${metadataResp.status}`)
  }
  
  const metadata = await metadataResp.json()
  console.log('File metadata:', metadata.name, metadata.mimeType, metadata.size)
  
  // Handle shortcuts - resolve to actual target file
  let targetFileId = fileId
  if (metadata.mimeType === 'application/vnd.google-apps.shortcut') {
    if (!metadata.shortcutDetails?.targetId) {
      throw new Error('This is a shortcut but target file not found')
    }
    targetFileId = metadata.shortcutDetails.targetId
    console.log(`Resolved shortcut to target file: ${targetFileId}`)
  }
  
  const downloadUrl = `https://www.googleapis.com/drive/v3/files/${targetFileId}?alt=media`
  const downloadResp = await fetch(downloadUrl, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  })
  
  if (!downloadResp.ok) {
    if (downloadResp.status === 403) {
      throw new Error('No permission to download. Make sure the actual video file (not just shortcuts) is shared with the service account.')
    }
    throw new Error(`Failed to download file: ${downloadResp.status}`)
  }
  
  const blob = await downloadResp.blob()
  console.log(`Downloaded ${blob.size} bytes`)
  
  return blob
}

interface VideoDownloadResult {
  blob: Blob
  mimeType: string
  metadata: VideoMetadata
  isReel: boolean
  qualityValid: boolean
  aspectRatioIssue: 'none' | 'needs_padding' | 'extreme'
  originalAspectRatio: number
}

// Constants for video classification
const REEL_MAX_DURATION_SECONDS = 90 // Facebook Reels max duration
const MIN_HEIGHT_720P = 720
const REEL_MIN_ASPECT_RATIO = 0.5 // 1:2 minimum (very vertical)
const REEL_MAX_ASPECT_RATIO = 1.0 // 1:1 square maximum (vertical or square for reels)

// Facebook acceptable aspect ratio range for reels: 9:16 to 1:1 (0.5625 to 1.0)
// For feed videos: 16:9 to 9:16 (0.5625 to 1.77)
const FB_REEL_MIN_RATIO = 0.5 // Allow slightly more vertical than 9:16
const FB_REEL_MAX_RATIO = 1.0 // Square is max for reels
const FB_VIDEO_MIN_RATIO = 0.5625 // 9:16
const FB_VIDEO_MAX_RATIO = 1.91 // 16:9 + some margin
const EXTREME_RATIO_MIN = 0.3 // Below this is too extreme
const EXTREME_RATIO_MAX = 3.0 // Above this is too extreme

function isVerticalOrSquare(width: number, height: number): boolean {
  if (!width || !height) return true // Default to reel if unknown
  const aspectRatio = width / height
  return aspectRatio <= REEL_MAX_ASPECT_RATIO
}

function getAspectRatioString(width: number, height: number): string {
  if (!width || !height) return 'unknown'
  const ratio = width / height
  if (Math.abs(ratio - 9/16) < 0.1) return '9:16 (vertical)'
  if (Math.abs(ratio - 16/9) < 0.1) return '16:9 (horizontal)'
  if (Math.abs(ratio - 4/3) < 0.1) return '4:3'
  if (Math.abs(ratio - 1) < 0.1) return '1:1 (square)'
  return `${ratio.toFixed(2)} (${ratio < 1 ? 'vertical' : 'horizontal'})`
}

async function downloadVideoWithMetadata(driveUrl: string): Promise<VideoDownloadResult> {
  const fileId = getFileId(driveUrl)
  if (!fileId) throw new Error('Invalid Google Drive URL format')
  
  console.log('Getting Google access token...')
  const accessToken = await getGoogleAccessToken()
  
  // Get video metadata first
  console.log('Fetching video metadata...')
  const metadata = await getVideoMetadata(fileId, accessToken)
  
  const durationSeconds = metadata.durationMillis ? metadata.durationMillis / 1000 : 0
  const height = metadata.height || 0
  const width = metadata.width || 0
  
  console.log(`Video: ${metadata.name}`)
  console.log(`Duration: ${durationSeconds.toFixed(1)}s, Resolution: ${width}x${height}`)
  console.log(`Aspect ratio: ${getAspectRatioString(width, height)}`)
  
  // Check quality - reject videos below 720p (use the smaller dimension for vertical videos)
  const minDimension = Math.min(width, height) || height
  const qualityValid = minDimension >= MIN_HEIGHT_720P || height >= MIN_HEIGHT_720P
  if (!qualityValid) {
    console.log(`⚠️ Video quality too low: ${minDimension}p (minimum: ${MIN_HEIGHT_720P}p)`)
  }
  
  // Calculate aspect ratio
  const aspectRatio = width && height ? width / height : 1
  
  // Check aspect ratio for potential issues
  let aspectRatioIssue: 'none' | 'needs_padding' | 'extreme' = 'none'
  
  if (aspectRatio < EXTREME_RATIO_MIN || aspectRatio > EXTREME_RATIO_MAX) {
    // Extremely unusual aspect ratio - reject
    aspectRatioIssue = 'extreme'
    console.log(`⚠️ Extreme aspect ratio: ${aspectRatio.toFixed(3)} - will be rejected`)
  } else if (aspectRatio > FB_VIDEO_MAX_RATIO || aspectRatio < FB_VIDEO_MIN_RATIO) {
    // Outside FB acceptable range but not extreme - would need padding
    aspectRatioIssue = 'needs_padding'
    console.log(`⚠️ Aspect ratio ${aspectRatio.toFixed(3)} outside FB range - may need adjustment`)
  }
  
  // Determine if this should be a Reel:
  // - Duration must be <= 90 seconds
  // - Aspect ratio should be vertical or square (not horizontal) for best Reel experience
  const durationOkForReel = durationSeconds > 0 && durationSeconds <= REEL_MAX_DURATION_SECONDS
  
  // Calculate actual aspect ratio: width/height
  // Vertical: ratio < 1 (e.g., 9:16 = 0.5625)
  // Square: ratio = 1
  // Horizontal: ratio > 1 (e.g., 16:9 = 1.777)
  const isVertical = aspectRatio <= 1.0 // Vertical or square
  
  console.log(`Aspect ratio check: ${aspectRatio.toFixed(3)} (width: ${width}, height: ${height})`)
  console.log(`Is vertical/square: ${isVertical} (ratio <= 1.0)`)
  
  const isReel = durationOkForReel && isVertical
  
  if (!isReel && durationSeconds > REEL_MAX_DURATION_SECONDS) {
    console.log(`📹 LONG VIDEO detected (${durationSeconds.toFixed(1)}s > ${REEL_MAX_DURATION_SECONDS}s) - will preserve original aspect ratio ${aspectRatio.toFixed(2)}`)
  } else if (!isReel && !isVertical) {
    console.log(`📺 HORIZONTAL VIDEO detected (ratio: ${aspectRatio.toFixed(2)}) - will preserve original aspect ratio`)
  } else {
    console.log(`🎬 REEL detected (duration: ${durationSeconds.toFixed(1)}s, vertical: ${isVertical}, ratio: ${aspectRatio.toFixed(2)})`)
  }
  console.log(`Upload type: ${isReel ? 'REEL' : 'VIDEO'} (duration: ${durationSeconds.toFixed(1)}s, vertical: ${isVertical}, ratio: ${aspectRatio.toFixed(2)})`)
  
  // Download the video
  console.log('Downloading video content...')
  const videoBlob = await downloadFromGoogleDrive(fileId, accessToken)
  
  if (videoBlob.size < 10000) {
    throw new Error(`Downloaded file too small (${videoBlob.size} bytes)`)
  }
  
  return { 
    blob: videoBlob, 
    mimeType: videoBlob.type || 'video/mp4',
    metadata,
    isReel,
    qualityValid,
    aspectRatioIssue,
    originalAspectRatio: aspectRatio
  }
}

// ============ Cloudinary Video Watermarking ============

async function applyWatermark(videoBlob: Blob, logoUrl: string): Promise<Blob> {
  const cloudName = Deno.env.get('CLOUDINARY_CLOUD_NAME')
  const apiKey = Deno.env.get('CLOUDINARY_API_KEY')
  const apiSecret = Deno.env.get('CLOUDINARY_API_SECRET')

  if (!cloudName || !apiKey || !apiSecret) {
    console.log('⚠️ Cloudinary not configured (CLOUDINARY_CLOUD_NAME, API_KEY, SECRET). Skipping watermark.')
    return videoBlob
  }

  try {
    console.log('Watermarking video via Cloudinary...')
    
    // 1. Upload video to Cloudinary
    const timestamp = Math.floor(Date.now() / 1000)
    const signatureBase = `timestamp=${timestamp}${apiSecret}`
    const signature = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(signatureBase))
      .then(hash => Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join(''))

    const formData = new FormData()
    formData.append('file', videoBlob)
    formData.append('timestamp', timestamp.toString())
    formData.append('api_key', apiKey)
    formData.append('signature', signature)
    formData.append('resource_type', 'video')

    const uploadResp = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/video/upload`, {
      method: 'POST',
      body: formData
    })

    if (!uploadResp.ok) throw new Error(`Cloudinary upload failed: ${await uploadResp.text()}`)
    const uploadData = await uploadResp.json()
    const publicId = uploadData.public_id

    // 2. Generate watermark URL
    // Format: l_fetch:<base64_logo_url>/fl_layer_apply,g_south_east,x_20,y_20,w_150/
    const logoB64 = btoa(logoUrl).replace(/\//g, '_').replace(/\+/g, '-')
    const transformation = `l_fetch:${logoB64},fl_layer_apply,g_south_east,x_30,y_30,w_0.15/`
    const watermarkedUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${transformation}${publicId}.mp4`
    
    console.log('Downloading watermarked video:', watermarkedUrl)
    const finalResp = await fetch(watermarkedUrl)
    if (!finalResp.ok) throw new Error('Failed to download watermarked video from Cloudinary')
    
    return await finalResp.blob()
  } catch (err) {
    console.error('Watermarking error:', err)
    return videoBlob // Fallback to raw video on error
  }
}

// Facebook upload
// - Regular videos: Resumable Upload API via /{page-id}/videos
// - Reels: Dedicated Reels Publishing flow via /{page-id}/video_reels + rupload.facebook.com
async function uploadVideoToFacebook(
  pageId: string,
  accessToken: string,
  videoBlob: Blob,
  description: string,
  isReel: boolean = false
): Promise<{ id: string; type: string; permalinkUrl?: string } | { error: { message: string } }> {
  const fileSize = videoBlob.size
  const uploadType = isReel ? 'REEL' : 'VIDEO'

  // --- Reels flow (Meta docs: Publish a Reel) ---
  // This is required for reliable public visibility of reels.
  if (isReel) {
    try {
      console.log(`Starting Facebook REEL upload (reels publishing flow) for ${fileSize} bytes`)

      // Step 1: Initialize upload session
      const initResp = await fetch(`https://graph.facebook.com/v18.0/${pageId}/video_reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_phase: 'start', access_token: accessToken })
      })
      const initJson = await initResp.json()
      if (initJson.error) {
        console.error('Facebook reels init error:', initJson.error)
        return { error: initJson.error }
      }

      const videoId: string = initJson.video_id
      const uploadUrl: string = initJson.upload_url
      if (!videoId || !uploadUrl) {
        return { error: { message: 'Facebook reels init did not return video_id/upload_url' } }
      }

      console.log(`Reels upload session started. video_id=${videoId}`)

      // Step 2: Upload the video to rupload
      const arrayBuffer = await videoBlob.arrayBuffer()
      const uploadResp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Authorization': `OAuth ${accessToken}`,
          'offset': '0',
          'file_size': String(fileSize),
          'Content-Type': 'application/octet-stream',
        },
        body: new Uint8Array(arrayBuffer),
      })
      const uploadJson = await uploadResp.json().catch(() => ({}))
      if (!uploadResp.ok) {
        console.error('Facebook reels rupload error:', uploadJson)
        return { error: { message: uploadJson?.error?.message || `Reels upload failed (${uploadResp.status})` } }
      }
      console.log('Reels upload completed:', JSON.stringify(uploadJson))

      // Step 3: Publish the Reel
      const publishParams = new URLSearchParams({
        access_token: accessToken,
        video_id: videoId,
        upload_phase: 'finish',
        video_state: 'PUBLISHED',
        description: description,
      })

      const publishResp = await fetch(`https://graph.facebook.com/v18.0/${pageId}/video_reels`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: publishParams,
      })

      const publishJson = await publishResp.json()
      if (!publishResp.ok || publishJson?.error) {
        console.error('Facebook reels publish error:', publishJson?.error || publishJson)
        return { error: { message: publishJson?.error?.message || 'Failed to publish reel' } }
      }

      // Fetch permalink_url for the reel
      let permalinkUrl: string | undefined
      try {
        const verifyResp = await fetch(
          `https://graph.facebook.com/v18.0/${videoId}?fields=published,permalink_url,status&access_token=${accessToken}`
        )
        const verifyJson = await verifyResp.json()
        console.log('Facebook reel publish verification:', JSON.stringify(verifyJson))
        if (verifyJson.permalink_url) {
          // permalink_url is relative like "/reel/123456/", make it absolute
          permalinkUrl = verifyJson.permalink_url.startsWith('http') 
            ? verifyJson.permalink_url 
            : `https://www.facebook.com${verifyJson.permalink_url}`
        }
      } catch (e) {
        console.log('Facebook reel publish verification failed (non-fatal):', String(e))
      }

      console.log(`${uploadType} published successfully: ${videoId}, permalink: ${permalinkUrl || 'N/A'}`)
      return { id: videoId, type: uploadType, permalinkUrl }
    } catch (e) {
      console.error('Reels publishing flow error:', e)
      return { error: { message: e instanceof Error ? e.message : 'Unknown reels publishing error' } }
    }
  }

  // --- Regular video flow (resumable upload) ---
  console.log(`Starting Facebook VIDEO resumable upload for ${fileSize} bytes`)

  // Step 1: Initialize upload session
  // NOTE: We pass published=true up-front to avoid unpublished assets.
  const initUrl = `https://graph.facebook.com/v18.0/${pageId}/videos?upload_phase=start&access_token=${accessToken}&file_size=${fileSize}&published=true`
  const initResponse = await fetch(initUrl, { method: 'POST' })

  const initResult = await initResponse.json()
  if (initResult.error) {
    console.error('Facebook init error:', initResult.error)
    return { error: initResult.error }
  }

  const { upload_session_id, video_id } = initResult
  console.log(`Upload session started: ${upload_session_id}, video_id: ${video_id}`)

  // Step 2: Upload video chunks
  const CHUNK_SIZE = 50 * 1024 * 1024 // 50MB chunks
  let startOffset = 0

  while (startOffset < fileSize) {
    const endOffset = Math.min(startOffset + CHUNK_SIZE, fileSize)
    const chunk = videoBlob.slice(startOffset, endOffset)

    console.log(`Uploading chunk: ${startOffset}-${endOffset} of ${fileSize}`)

    const formData = new FormData()
    formData.append('access_token', accessToken)
    formData.append('upload_phase', 'transfer')
    formData.append('upload_session_id', upload_session_id)
    formData.append('start_offset', startOffset.toString())
    formData.append('video_file_chunk', chunk, 'video.mp4')

    const transferResponse = await fetch(
      `https://graph.facebook.com/v18.0/${pageId}/videos`,
      { method: 'POST', body: formData }
    )

    const transferResult = await transferResponse.json()
    if (transferResult.error) {
      console.error('Facebook transfer error:', transferResult.error)
      return { error: transferResult.error }
    }

    startOffset = parseInt(transferResult.end_offset, 10)
  }

  // Step 3: Finish upload with description
  const finishParams: Record<string, string> = {
    access_token: accessToken,
    upload_phase: 'finish',
    upload_session_id: upload_session_id,
    description: description,
    published: 'true'
  }

  const finishResponse = await fetch(
    `https://graph.facebook.com/v18.0/${pageId}/videos`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(finishParams)
    }
  )

  const finishResult = await finishResponse.json()
  if (finishResult.error) {
    console.error('Facebook finish error:', finishResult.error)
    return { error: finishResult.error }
  }

  const finalVideoId = finishResult.video_id || video_id

  // Fetch permalink_url for the video
  let permalinkUrl: string | undefined
  try {
    const verifyResp = await fetch(
      `https://graph.facebook.com/v18.0/${finalVideoId}?fields=published,permalink_url,status&access_token=${accessToken}`
    )
    const verifyJson = await verifyResp.json()
    console.log('Facebook video publish verification:', JSON.stringify(verifyJson))
    if (verifyJson.permalink_url) {
      permalinkUrl = verifyJson.permalink_url.startsWith('http') 
        ? verifyJson.permalink_url 
        : `https://www.facebook.com${verifyJson.permalink_url}`
    }
  } catch (e) {
    console.log('Facebook video publish verification failed (non-fatal):', String(e))
  }

  console.log(`${uploadType} uploaded successfully: ${finalVideoId}, permalink: ${permalinkUrl || 'N/A'}`)
  return { id: finalVideoId, type: uploadType, permalinkUrl }
}

// ============ AI Caption Generation with Video Analysis ============

const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"

async function getVideoThumbnailBase64(fileId: string, accessToken: string): Promise<string | null> {
  try {
    const metadataUrl = `https://www.googleapis.com/drive/v3/files/${fileId}?fields=thumbnailLink`
    const resp = await fetch(metadataUrl, { headers: { 'Authorization': `Bearer ${accessToken}` } })
    if (!resp.ok) return null
    
    const data = await resp.json()
    if (data.thumbnailLink) {
      const highResThumbnail = data.thumbnailLink.replace('=s220', '=s1000')
      const thumbResp = await fetch(highResThumbnail)
      if (thumbResp.ok) {
        const blob = await thumbResp.blob()
        const buffer = await blob.arrayBuffer()
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      }
    }
    return null
  } catch (err) {
    console.error('Error getting thumbnail:', err)
    return null
  }
}

async function generateVideoAwareCaption(
  categoryName: string, 
  videoMetadata: VideoMetadata, 
  thumbnail: string | null,
  postIndex: number = 0,
  userGeminiKey: string | null = null,
  captionLength: 'short' | 'medium' | 'long' = 'medium',
  hashtagCount: number = 8,
  targetingCountry: string | null = null,
  targetingTone: string | null = null,
  brandingLines: any | null = null,
  affiliateLinks: any | null = null
): Promise<{ caption: string; hashtags: string[] }> {
  // Only use user's API key from database - no system fallback
  if (!userGeminiKey) {
    console.log('No Gemini API key configured for this user, using fallback caption')
    return { caption: `${categoryName} 🔥`, hashtags: ['viral', 'trending', 'reels'].slice(0, hashtagCount) }
  }
  
  const GEMINI_API_KEY = userGeminiKey
  console.log(`Using user Gemini API key from database (length: ${captionLength}, hashtags: ${hashtagCount})`)

  const aspectRatio = videoMetadata.width && videoMetadata.height 
    ? (videoMetadata.width / videoMetadata.height).toFixed(2) 
    : 'unknown'
  const isVertical = (videoMetadata.height || 0) > (videoMetadata.width || 0)
  const durationSec = videoMetadata.durationMillis ? videoMetadata.durationMillis / 1000 : 0
  const isReel = durationSec > 0 && durationSec <= 90
  const formatType = isReel ? 'Reel/Short' : 'Long Video'

  const tones = ['excited', 'chill', 'dramatic', 'funny', 'romantic', 'motivational', 'sassy', 'nostalgic', 'savage']
  const randomTone = targetingTone || tones[Math.floor(Math.random() * tones.length)]
  const audienceContext = targetingCountry ? 'Target Audience: ' + targetingCountry : 'Target Audience: General'

  // Caption length instructions
  const captionLengthInstructions = {
    short: 'Write exactly 1 short, punchy sentence (under 50 characters). Be extremely concise.',
    medium: 'Write 2-3 sentences that are engaging and conversational (50-150 characters total).',
    long: 'Write 4-6 sentences that tell a story, build engagement, and include a call to action (150-300 characters total).'
  }

  const systemPrompt = `You are an expert social media caption writer. Create viral captions in ENGLISH or HINGLISH only.

VIDEO ANALYSIS CONTEXT:
- File name: "${videoMetadata.name}" (extract content clues from name)
- Duration: ${durationSec.toFixed(1)} seconds
- Aspect ratio: ${aspectRatio} (${isVertical ? 'Vertical/Portrait' : 'Horizontal/Landscape'})
- Format: ${formatType}
- Resolution: ${videoMetadata.width}x${videoMetadata.height}

${audienceContext}
CAMPAIGN/CATEGORY: "${categoryName}"
TONE: ${randomTone}

CAPTION LENGTH REQUIREMENT: ${captionLengthInstructions[captionLength]}
HASHTAG COUNT REQUIREMENT: Generate EXACTLY ${hashtagCount} hashtags (no more, no less).

CRITICAL LANGUAGE RULES:
1. USE LOCAL SLANG and language appropriate for ${targetingCountry || 'the detected audience'}. If Indian, use Hinglish (English + Roman Hindi).
2. NEVER use pure Devanagari script, ALWAYS Roman script.

CAPTION RULES:
1. The caption must be structured into components: Hook, Body, and CTA.
2. The Hook must be highly viral (1 sentence).
3. The Body must elaborate on the video content (based on thumbnail/name).
4. Outline EXACTLY ${hashtagCount} relevant hashtags WITHOUT the # symbol.

Seed: ${Date.now()}-${postIndex}-${Math.random().toString(36).substring(7)}`

  const parts: any[] = [{ text: `Analyze this video thumbnail and create caption #${postIndex + 1}. Write a ${captionLength} ${randomTone} caption in ENGLISH or HINGLISH only (based on video vibe). Generate EXACTLY ${hashtagCount} hashtags related to the VIDEO CONTENT shown.` }]
  
  if (thumbnail) {
    parts.unshift({ inline_data: { mime_type: 'image/jpeg', data: thumbnail } })
  }

  const requestBody = {
    contents: [{ role: 'user', parts }],
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 1.0, topP: 0.95, topK: 40 },
    tools: [{
      functionDeclarations: [{
        name: 'generate_video_caption',
        description: 'Generate viral caption in English or Hinglish based on video analysis',
          parameters: {
          type: 'OBJECT',
          properties: {
            hook: { type: 'STRING', description: 'A scroll-stopping opening hook sentence' },
            body: { type: 'STRING', description: `Main caption body text exploring the content (${captionLength} length)` },
            cta: { type: 'STRING', description: 'A short call to action sentence (e.g. comment below, share)' },
            hashtags: { type: 'ARRAY', items: { type: 'STRING' }, description: `Exactly ${hashtagCount} hashtags without # symbol` },
            detected_content: { type: 'STRING', description: 'What you detected in the thumbnail' },
            language_used: { type: 'STRING', description: 'Detected dominant language/slang' }
          },
          required: ['hook', 'body', 'cta', 'hashtags', 'language_used']
        }
      }]
    }],
    toolConfig: { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: ['generate_video_caption'] } }
  }

  try {
    console.log(`Generating video-aware caption with Gemini (thumbnail: ${thumbnail ? 'yes' : 'no'})`)
    
    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Gemini API error:', response.status, errorText)
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    const functionCall = data.candidates?.[0]?.content?.parts?.find((p: any) => p.functionCall)?.functionCall
    
    let resultCaption = `${categoryName} 🔥`
    let resultHashtags = ['viral', 'trending', 'reels', 'fyp', 'explore', 'foryou', 'content', 'video'].slice(0, hashtagCount)

    if (functionCall?.args) {
      console.log('Video content detected:', functionCall.args.detected_content || 'N/A')
      console.log('Language used:', functionCall.args.language_used || 'N/A')
      
      let hook = functionCall.args.hook || '';
      let body = functionCall.args.body || `${categoryName} 🔥`;
      let cta = functionCall.args.cta || '';
      
      resultCaption = (hook ? hook + '\n\n' : '') + body + (cta ? '\n\n' + cta : '');
      
      let hashtags = functionCall.args.hashtags || []
      if (hashtags.length > hashtagCount) {
        hashtags = hashtags.slice(0, hashtagCount)
      } else if (hashtags.length < hashtagCount) {
        const fillers = ['viral', 'trending', 'reels', 'fyp', 'explore', 'foryou', 'content', 'video', 'love', 'instagood']
        while (hashtags.length < hashtagCount && fillers.length > 0) {
          const filler = fillers.shift()
          if (filler && !hashtags.includes(filler)) {
            hashtags.push(filler)
          }
        }
      }
      resultHashtags = hashtags;
    } else {
      const textPart = data.candidates?.[0]?.content?.parts?.find((p: any) => p.text)?.text
      if (textPart) {
        resultCaption = textPart.trim();
      }
    }

    // Unify injection logic here (applies to both structured and unstructured results)
    let finalCaption = resultCaption;
    const isEveryNPostsBranding = brandingLines?.frequency !== 'every';
    const brandingInterval = brandingLines?.interval || 3;
    if (brandingLines?.enabled && (!isEveryNPostsBranding || postIndex % brandingInterval === 0)) {
      finalCaption += '\n\n' + (brandingLines.text || 'DM for credit/removal');
    }

    const isEveryNPostsAffiliate = affiliateLinks?.frequency !== 'every';
    const affiliateInterval = affiliateLinks?.interval || 3;
    if (affiliateLinks?.enabled && (!isEveryNPostsAffiliate || postIndex % affiliateInterval === 0) && affiliateLinks.links?.length > 0) {
      const link = affiliateLinks.links[postIndex % affiliateLinks.links.length];
      finalCaption += '\n\n🔗 ' + link;
    }

    return {
      caption: finalCaption.trim(),
      hashtags: resultHashtags
    }
  } catch (err) {
    console.error('Gemini caption error:', err)
    return { 
      caption: `${categoryName} 🔥`, 
      hashtags: ['viral', 'trending', 'reels'].slice(0, hashtagCount) 
    }
  }
}

// ============ Main Handler ============

async function refreshYouTubeTokenIfNeeded(supabase: any, ytChannel: any): Promise<string> {
  const now = new Date()
  const expiresAt = new Date(ytChannel.token_expires_at)
  
  // Refresh if expires in less than 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    console.log(`YouTube token for ${ytChannel.channel_name} is expiring soon. Refreshing...`)
    
    // Call our own youtube-oauth function to refresh
    const { data: refreshResult, error: refreshError } = await supabase.functions.invoke('youtube-oauth', {
      body: { action: 'refresh-token', refreshToken: ytChannel.refresh_token }
    })
    
    if (refreshError || !refreshResult?.access_token) {
      throw new Error(`Failed to refresh YouTube token: ${refreshError?.message || 'No access token returned'}`)
    }
    
    // Update the database
    await supabase.from('youtube_channels').update({
      access_token: refreshResult.access_token,
      token_expires_at: refreshResult.expires_at,
      updated_at: new Date().toISOString()
    }).eq('id', ytChannel.id)
    
    return refreshResult.access_token
  }
  
  return ytChannel.access_token
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`Auto-poster running at ${new Date().toISOString()}`)

    // Check if a specific post ID was requested (for "Post Now" feature)
    let requestBody: { postId?: string; forcePublic?: boolean } = {}
    try {
      requestBody = await req.json()
    } catch {
      // No body or invalid JSON is fine
    }
    
    const forcePublic = requestBody.forcePublic === true
    console.log(`Force public mode: ${forcePublic}`)

    let pendingPosts: ScheduledPost[] = []

    if (requestBody.postId) {
      // Process specific post (for "Post Now" - marked as 'processing')
      console.log(`Processing specific post: ${requestBody.postId}`)
      const { data, error } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('id', requestBody.postId)
        .eq('status', 'processing')
        .single()
      
      if (error || !data) {
        console.log('Post not found or already processed')
        return new Response(JSON.stringify({ message: 'Post not found or already processed', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      pendingPosts = [data]
    } else {
      // Normal cron behavior - get pending posts that are due
      const { data, error: fetchError } = await supabase
        .from('scheduled_posts')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_time', new Date().toISOString())
        .order('scheduled_time', { ascending: true })
        .limit(5)
      
      if (fetchError) throw fetchError
      pendingPosts = data || []
    }

    if (!pendingPosts.length) {
      console.log('No pending posts to process')
      return new Response(JSON.stringify({ message: 'No pending posts', processed: 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    console.log(`Found ${pendingPosts.length} posts to process`)
    const results = []

    for (const post of pendingPosts as ScheduledPost[]) {
      console.log(`\n--- Processing post ${post.id} ---`)
      
      try {
        let fbPage: FacebookPage | null = null
        if (post.facebook_page_id) {
          const { data: page, error: pageError } = await supabase
            .from('facebook_pages')
            .select('*')
            .eq('id', post.facebook_page_id)
            .single()
          if (!pageError && page) fbPage = page as FacebookPage
        }
        let caption = post.caption || ''
        let hashtags = post.hashtags || []

        // Download video with metadata (duration, resolution) first - we need it for AI caption
        console.log('Downloading video:', post.video_url)
        let videoResult = await downloadVideoWithMetadata(post.video_url)

        // Fetch campaign branding info
        const { data: campaign } = await supabase.from('campaigns').select('*').eq('id', post.campaign_id).single()

        // Apply visual branding (logo) if enabled
        if (campaign?.branding_logo_url) {
          const watermarkedBlob = await applyWatermark(videoResult.blob, campaign.branding_logo_url)
          videoResult.blob = watermarkedBlob
        }

        // Generate AI caption using video thumbnail and metadata
        if (post.needs_ai_caption || !caption) {
          // Fetch user's Gemini API key if available
          let userGeminiKey: string | null = null
          if (campaign?.user_id) {
            const { data: apiKeyData } = await supabase
              .from('user_api_keys')
              .select('api_key')
              .eq('user_id', campaign.user_id)
              .eq('key_name', 'gemini')
              .single()
            userGeminiKey = apiKeyData?.api_key || null
          }
          
          // Get caption settings from campaign
          const captionLength = (campaign?.caption_length as 'short' | 'medium' | 'long') || 'medium'
          const hashtagCount = campaign?.hashtag_count || 8
          console.log(`Caption settings: length=${captionLength}, hashtags=${hashtagCount}`)
          
          // Get thumbnail for AI analysis
          const fileId = getFileId(post.video_url)
          let thumbnail: string | null = null
          if (fileId) {
            try {
              const accessToken = await getGoogleAccessToken()
              thumbnail = await getVideoThumbnailBase64(fileId, accessToken)
            } catch (err) {
              console.log('Could not get thumbnail for AI:', err)
            }
          }
          const { count: historicalPostsCount } = await supabase
            .from('scheduled_posts')
            .select('*', { count: 'exact', head: true })
            .eq('campaign_id', post.campaign_id)
            .eq('status', 'posted')

          const aiResult = await generateVideoAwareCaption(
            campaign?.description || '', 
            videoResult.metadata, 
            thumbnail,
            historicalPostsCount || 0,
            userGeminiKey,
            captionLength, 
            hashtagCount,
            campaign?.targeting_country,
            campaign?.targeting_tone,
            campaign?.branding_lines,
            campaign?.affiliate_links
          )
          caption = aiResult.caption
          hashtags = aiResult.hashtags
        }
        
        // Check video quality - REJECT if below 720p (no retry for this video)
        if (!videoResult.qualityValid) {
          const resolution = videoResult.metadata.height || 0
          const errorMsg = `REJECTED: Video quality too low (${resolution}p). Minimum 720p required. This video will not be retried.`
          console.log(`🚫 Rejecting post - ${errorMsg}`)
          await supabase.from('scheduled_posts').update({ 
            status: 'rejected', 
            error_message: errorMsg, 
            actual_post_time: new Date().toISOString(), 
            caption, 
            hashtags 
          }).eq('id', post.id)
          results.push({ id: post.id, status: 'rejected', error: errorMsg })
          continue
        }
        
        // Check for extreme aspect ratios - REJECT (no retry)
        if (videoResult.aspectRatioIssue === 'extreme') {
          const ratio = videoResult.originalAspectRatio.toFixed(2)
          const errorMsg = `REJECTED: Extreme aspect ratio (${ratio}). Video is too wide or too tall for Facebook. This video will not be retried.`
          console.log(`🚫 Rejecting post - ${errorMsg}`)
          await supabase.from('scheduled_posts').update({ 
            status: 'rejected', 
            error_message: errorMsg, 
            actual_post_time: new Date().toISOString(), 
            caption, 
            hashtags 
          }).eq('id', post.id)
          results.push({ id: post.id, status: 'rejected', error: errorMsg })
          continue
        }
        
        // Log aspect ratio warning if needs padding (FB may auto-adjust)
        if (videoResult.aspectRatioIssue === 'needs_padding') {
          console.log(`⚠️ Aspect ratio ${videoResult.originalAspectRatio.toFixed(2)} may need adjustment. Facebook may add letterboxing.`)
        }

        const fullCaption = hashtags.length > 0 ? `${caption}\n\n${hashtags.map(h => `#${h}`).join(' ')}` : caption
        const isReel = videoResult.isReel
        const uploadType = isReel ? 'Reel' : 'Long Video'
        
        let allSuccess = true
        let errors: string[] = []
        let postUpdates: any = { 
          actual_post_time: new Date().toISOString(), 
          caption, 
          hashtags, 
          post_type: isReel ? 'reel' : 'video' 
        }
        
        // Ensure we load campaign data if not loaded by the prompt logic
        const { data: campaignTitle } = await supabase.from('campaigns').select('title, user_id').eq('id', post.campaign_id).single()
        
        const pConf = post.platforms || { facebook: true, instagram: false, youtube: false }

        // 1. Facebook
        if (pConf.facebook && post.facebook_page_id) {
          const { data: page, error: pageError } = await supabase
            .from('facebook_pages')
            .select('*')
            .eq('id', post.facebook_page_id)
            .single()
            
          if (pageError || !page) {
            allSuccess = false; errors.push("FB Page not found.")
          } else {
            console.log(`Uploading as ${uploadType} to Facebook: ${page.page_name}...`)
            const fbResult = await uploadVideoToFacebook(page.page_id, page.access_token, videoResult.blob, fullCaption, isReel)
            if ('error' in fbResult) {
              allSuccess = false; errors.push(`FB: ${fbResult.error.message}`)
            } else {
              postUpdates.facebook_post_id = fbResult.id
              postUpdates.permalink_url = fbResult.permalinkUrl || null
            }
          }
        }

        // 2. Instagram
        if (pConf.instagram && post.instagram_account_id) {
          const { data: igAcc, error: igError } = await supabase
            .from('instagram_accounts')
            .select('*, facebook_pages(access_token)')
            .eq('id', post.instagram_account_id)
            .single()
            
          if (igError || !igAcc) {
            allSuccess = false; errors.push("IG Account not found.")
          } else {
            const fbToken = igAcc.facebook_pages?.access_token
            if (!fbToken) {
              allSuccess = false; errors.push("IG Error: Linked FB token not found.")
            } else {
              console.log(`Uploading to Instagram: ${igAcc.instagram_username}...`)
              const res = await uploadVideoToInstagram(supabase, igAcc.instagram_account_id, fbToken, videoResult.blob, fullCaption, post.id)
              if ('error' in res) {
                allSuccess = false; errors.push(`IG: ${res.error.message}`)
              } else {
                postUpdates.instagram_media_id = res.id
                if (!postUpdates.permalink_url && res.permalinkUrl) postUpdates.permalink_url = res.permalinkUrl
              }
            }
          }
        }

        // 3. YouTube
        if (pConf.youtube && post.youtube_channel_id) {
           const { data: ytChannel, error: ytError } = await supabase
            .from('youtube_channels')
            .select('*')
            .eq('id', post.youtube_channel_id)
            .single()
            
           if (ytError || !ytChannel) {
             allSuccess = false; errors.push("YT Channel not found.")
           } else {
              try {
                const activeToken = await refreshYouTubeTokenIfNeeded(supabase, ytChannel)
                console.log(`Uploading to YouTube: ${ytChannel.channel_name}...`)
                const res = await uploadVideoToYouTube(ytChannel.channel_id, activeToken, videoResult.blob, campaign?.title || 'Shorts', fullCaption, hashtags, isReel)
                if ('error' in res) {
                  allSuccess = false; errors.push(`YT: ${res.error.message}`)
                } else {
                  postUpdates.youtube_video_id = res.id
                  if (!postUpdates.permalink_url && res.permalinkUrl) postUpdates.permalink_url = res.permalinkUrl
                }
              } catch (ytErr) {
                allSuccess = false; errors.push(`YT Refresh: ${ytErr instanceof Error ? ytErr.message : String(ytErr)}`)
              }
           }
        }
        
        if (!allSuccess && errors.length > 0) {
          postUpdates.status = 'failed'
          postUpdates.error_message = errors.join(' | ')
          await supabase.from('scheduled_posts').update(postUpdates).eq('id', post.id)
          results.push({ id: post.id, status: 'failed', error: postUpdates.error_message })
        } else {
          postUpdates.status = 'posted'
          await supabase.from('scheduled_posts').update(postUpdates).eq('id', post.id)
          results.push({ id: post.id, status: 'posted', updates: postUpdates })
        }

      } catch (error) {
        console.error(`Error processing post ${post.id}:`, error)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await supabase.from('scheduled_posts').update({ status: 'failed', error_message: errorMessage, actual_post_time: new Date().toISOString() }).eq('id', post.id)
        results.push({ id: post.id, status: 'failed', error: errorMessage })
      }
    }

    console.log('Processing complete:', results)
    return new Response(JSON.stringify({ message: 'Processing complete', processed: results.length, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    console.error('Auto-poster error:', error)
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
