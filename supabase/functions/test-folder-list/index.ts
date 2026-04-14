import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Convert PEM to ArrayBuffer for crypto import
function pemToArrayBuffer(pem: string): ArrayBuffer {
  // Handle different formats of the private key
  let base64 = pem
  
  // If it's a full PEM format, extract just the base64 part
  if (pem.includes('-----BEGIN')) {
    base64 = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, '')
      .replace(/-----END PRIVATE KEY-----/g, '')
  }
  
  // Handle escaped newlines (JSON format: \\n or \n)
  base64 = base64.replace(/\\n/g, '').replace(/\n/g, '').replace(/\s/g, '')
  
  const binaryString = atob(base64)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes.buffer
}

// Import the private key for signing
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

// Create JWT for Google API authentication
async function createServiceAccountJWT(email: string, privateKey: string): Promise<string> {
  const header = { alg: 'RS256', typ: 'JWT' }
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: email,
    scope: 'https://www.googleapis.com/auth/drive.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  }

  const encoder = new TextEncoder()
  const headerB64 = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const claimB64 = btoa(JSON.stringify(claim)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
  const unsignedToken = `${headerB64}.${claimB64}`

  const key = await importPrivateKey(privateKey)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    encoder.encode(unsignedToken)
  )

  const signatureB64 = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

  return `${unsignedToken}.${signatureB64}`
}

// Get access token using service account
async function getAccessToken(email: string, privateKey: string): Promise<string> {
  const jwt = await createServiceAccountJWT(email, privateKey)
  
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Failed to get access token: ${error}`)
  }

  const data = await response.json()
  return data.access_token
}

// Extract folder ID from Google Drive URL
function extractFolderId(url: string): string | null {
  // Format: https://drive.google.com/drive/folders/FOLDER_ID
  const folderMatch = url.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch) return folderMatch[1]
  
  // Direct folder ID
  if (/^[a-zA-Z0-9_-]+$/.test(url)) return url
  
  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { folderUrl } = await req.json()
    
    if (!folderUrl) {
      return new Response(
        JSON.stringify({ error: 'folderUrl is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const folderId = extractFolderId(folderUrl)
    if (!folderId) {
      return new Response(
        JSON.stringify({ error: 'Invalid folder URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`Testing folder access for: ${folderId}`)

    const serviceEmail = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')
    const privateKey = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY')

    if (!serviceEmail || !privateKey) {
      return new Response(
        JSON.stringify({ error: 'Google service account not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get access token
    const accessToken = await getAccessToken(serviceEmail, privateKey)
    console.log('Got access token')

    // First, get folder metadata
    const folderMetaUrl = `https://www.googleapis.com/drive/v3/files/${folderId}?fields=id,name,mimeType`
    const folderResp = await fetch(folderMetaUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!folderResp.ok) {
      const error = await folderResp.text()
      console.error('Folder access error:', error)
      return new Response(
        JSON.stringify({ 
          error: 'Cannot access folder',
          details: folderResp.status === 404 ? 'Folder not found or not shared with service account' : error,
          serviceEmail
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const folderMeta = await folderResp.json()
    console.log('Folder metadata:', folderMeta)

    // List all video files in the folder
    const query = `'${folderId}' in parents and (mimeType contains 'video/' or mimeType = 'application/vnd.google-apps.shortcut') and trashed = false`
    const listUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name,mimeType,size,shortcutDetails)&pageSize=100`
    
    const listResp = await fetch(listUrl, {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    })

    if (!listResp.ok) {
      const error = await listResp.text()
      console.error('List files error:', error)
      return new Response(
        JSON.stringify({ error: 'Failed to list files', details: error }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const listData = await listResp.json()
    console.log(`Found ${listData.files?.length || 0} video files`)

    // Resolve shortcuts to get actual video info
    const files = await Promise.all((listData.files || []).map(async (file: any) => {
      if (file.mimeType === 'application/vnd.google-apps.shortcut' && file.shortcutDetails?.targetId) {
        // Get the actual file metadata
        const targetUrl = `https://www.googleapis.com/drive/v3/files/${file.shortcutDetails.targetId}?fields=id,name,mimeType,size`
        const targetResp = await fetch(targetUrl, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        })
        if (targetResp.ok) {
          const targetMeta = await targetResp.json()
          return {
            ...targetMeta,
            originalName: file.name,
            isShortcut: true,
            shortcutId: file.id
          }
        }
      }
      return { ...file, isShortcut: false }
    }))

    return new Response(
      JSON.stringify({
        success: true,
        folder: {
          id: folderMeta.id,
          name: folderMeta.name
        },
        files: files,
        totalCount: files.length,
        message: `Found ${files.length} video(s) in folder "${folderMeta.name}"`
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
