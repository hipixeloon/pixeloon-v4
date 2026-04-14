import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

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
  const processed = pem.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
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

// ============ Folder Operations ============

function extractFolderId(url: string): string | null {
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]
  if (/^[a-zA-Z0-9_-]+$/.test(url)) return url
  return null
}

interface DriveFile {
  id: string
  name: string
  mimeType: string
  size?: string
  shortcutDetails?: { targetId: string, targetMimeType: string }
}

interface VideoInfo {
  id: string
  name: string
  mimeType: string
  size: number
  driveUrl: string
  isShortcut: boolean
  folderPath: string
  width?: number
  height?: number
  durationMs?: number
  isLowQuality?: boolean
}

interface DriveFileWithMeta extends DriveFile {
  videoMediaMetadata?: {
    width?: number
    height?: number
    durationMillis?: string
  }
}

// Fast parallel folder listing with video metadata for quality filtering
async function listFolderContents(folderId: string, accessToken: string): Promise<DriveFileWithMeta[]> {
  const files: DriveFileWithMeta[] = []
  let pageToken: string | undefined
  
  do {
    const query = `'${folderId}' in parents and trashed = false`
    let url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=nextPageToken,files(id,name,mimeType,size,shortcutDetails,videoMediaMetadata)&pageSize=1000`
    if (pageToken) url += `&pageToken=${pageToken}`
    
    const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } })
    if (!resp.ok) throw new Error(`Failed to list: ${resp.status}`)
    
    const data = await resp.json()
    files.push(...(data.files || []))
    pageToken = data.nextPageToken
  } while (pageToken)
  
  return files
}

// Check if video is at least 720p
function isHighQuality(width?: number, height?: number): boolean {
  if (!width || !height) return true // Allow if no metadata (will be checked during posting)
  const minDimension = Math.min(width, height)
  return minDimension >= 720
}

// Resolve multiple shortcuts in parallel with video metadata
async function resolveShortcuts(shortcuts: DriveFile[], accessToken: string, filterLowQuality: boolean): Promise<VideoInfo[]> {
  const BATCH_SIZE = 50
  const videos: VideoInfo[] = []
  
  for (let i = 0; i < shortcuts.length; i += BATCH_SIZE) {
    const batch = shortcuts.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map(async (file) => {
        try {
          const targetId = file.shortcutDetails?.targetId
          if (!targetId) return null
          
          const resp = await fetch(
            `https://www.googleapis.com/drive/v3/files/${targetId}?fields=id,name,mimeType,size,videoMediaMetadata`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          )
          
          if (!resp.ok) return null
          const meta = await resp.json()
          
          if (meta.mimeType?.startsWith('video/')) {
            const width = meta.videoMediaMetadata?.width
            const height = meta.videoMediaMetadata?.height
            const isLowQuality = !isHighQuality(width, height)
            
            if (filterLowQuality && isLowQuality) return null
            
            return {
              id: meta.id,
              name: file.name,
              mimeType: meta.mimeType,
              size: parseInt(meta.size || '0', 10),
              driveUrl: `https://drive.google.com/file/d/${meta.id}/view`,
              isShortcut: true,
              folderPath: '',
              width,
              height,
              durationMs: meta.videoMediaMetadata?.durationMillis ? parseInt(meta.videoMediaMetadata.durationMillis) : undefined,
              isLowQuality
            } as VideoInfo
          }
        } catch { /* skip failed shortcuts */ }
        return null
      })
    )
    
    videos.push(...results.filter((v): v is VideoInfo => v !== null))
  }
  
  return videos
}

// FAST recursive scan with parallel subfolder processing and quality filtering
async function scanFolderFast(
  folderId: string, 
  accessToken: string,
  folderPath: string = '',
  maxDepth: number = 10,
  concurrency: number = 10,
  filterLowQuality: boolean = true
): Promise<{ videos: VideoInfo[], foldersScanned: number, lowQualitySkipped: number }> {
  if (maxDepth <= 0) return { videos: [], foldersScanned: 0, lowQualitySkipped: 0 }

  const files = await listFolderContents(folderId, accessToken)
  
  const videos: VideoInfo[] = []
  const subfolders: { id: string, name: string }[] = []
  const shortcuts: DriveFile[] = []
  let lowQualitySkipped = 0
  
  // Categorize files in single pass
  for (const file of files) {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      subfolders.push({ id: file.id, name: file.name })
    } else if (file.mimeType === 'application/vnd.google-apps.shortcut') {
      if (file.shortcutDetails?.targetMimeType === 'application/vnd.google-apps.folder') {
        subfolders.push({ id: file.shortcutDetails.targetId, name: file.name })
      } else if (file.shortcutDetails?.targetMimeType?.startsWith('video/') || !file.shortcutDetails?.targetMimeType) {
        shortcuts.push(file)
      }
    } else if (file.mimeType?.startsWith('video/')) {
      const width = file.videoMediaMetadata?.width
      const height = file.videoMediaMetadata?.height
      const isLowQuality = !isHighQuality(width, height)
      
      if (filterLowQuality && isLowQuality) {
        lowQualitySkipped++
        continue
      }
      
      videos.push({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: parseInt(file.size || '0', 10),
        driveUrl: `https://drive.google.com/file/d/${file.id}/view`,
        isShortcut: false,
        folderPath,
        width,
        height,
        durationMs: file.videoMediaMetadata?.durationMillis ? parseInt(file.videoMediaMetadata.durationMillis) : undefined,
        isLowQuality
      })
    }
  }
  
  // Resolve video shortcuts in parallel (with quality filtering)
  const shortcutVideos = await resolveShortcuts(shortcuts, accessToken, filterLowQuality)
  shortcutVideos.forEach(v => { v.folderPath = folderPath })
  videos.push(...shortcutVideos)
  
  let foldersScanned = 1
  
  // Process subfolders in parallel batches
  for (let i = 0; i < subfolders.length; i += concurrency) {
    const batch = subfolders.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(subfolder => {
        const subPath = folderPath ? `${folderPath}/${subfolder.name}` : subfolder.name
        return scanFolderFast(subfolder.id, accessToken, subPath, maxDepth - 1, concurrency, filterLowQuality)
      })
    )
    
    for (const result of results) {
      videos.push(...result.videos)
      foldersScanned += result.foldersScanned
      lowQualitySkipped += result.lowQualitySkipped
    }
  }
  
  return { videos, foldersScanned, lowQualitySkipped }
}

async function getFolderMetadata(folderId: string, accessToken: string): Promise<{ id: string, name: string }> {
  const resp = await fetch(
    `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  )

  if (!resp.ok) {
    if (resp.status === 404) {
      throw new Error('Folder not found. Make sure the folder is shared with the service account.')
    }
    throw new Error(`Cannot access folder: ${resp.status}`)
  }

  return await resp.json()
}

// ============ Main Handler ============

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { folderId, folderUrl, recursive = true, countOnly = false, filterLowQuality = true } = await req.json()
    
    let resolvedFolderId = folderId
    if (!resolvedFolderId && folderUrl) {
      resolvedFolderId = extractFolderId(folderUrl)
    }
    
    if (!resolvedFolderId) {
      return new Response(
        JSON.stringify({ error: 'folderId or folderUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const startTime = Date.now()
    console.log(`Listing videos in folder: ${resolvedFolderId}, recursive: ${recursive}, filterLowQuality: ${filterLowQuality}`)

    const accessToken = await getGoogleAccessToken()
    const folderMeta = await getFolderMetadata(resolvedFolderId, accessToken)
    console.log('Folder:', folderMeta.name)
    
    // Fast parallel scan with quality filtering
    const { videos, foldersScanned, lowQualitySkipped } = await scanFolderFast(
      resolvedFolderId, 
      accessToken, 
      folderMeta.name,
      recursive ? 10 : 1,
      10,
      filterLowQuality
    )
    
    const elapsed = Date.now() - startTime
    console.log(`Found ${videos.length} HD videos, skipped ${lowQualitySkipped} low-quality in ${foldersScanned} folders (${elapsed}ms)`)

    // Sort by folder path then name
    videos.sort((a, b) => {
      const pathCompare = a.folderPath.localeCompare(b.folderPath)
      if (pathCompare !== 0) return pathCompare
      return a.name.localeCompare(b.name)
    })

    return new Response(
      JSON.stringify({
        success: true,
        folderId: resolvedFolderId,
        folderName: folderMeta.name,
        videos: countOnly ? [] : videos,
        totalCount: videos.length,
        lowQualitySkipped,
        foldersScanned,
        recursive,
        elapsedMs: elapsed
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: unknown) {
    console.error('Error:', error)
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
